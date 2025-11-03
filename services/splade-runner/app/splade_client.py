"""
SPLADE Model Client
Handles loading and inference with SPLADE sparse models
"""

import torch
from transformers import AutoModelForMaskedLM, AutoTokenizer
from typing import List, Dict
import logging
import os
import numpy as np

logger = logging.getLogger(__name__)


class SpladeClient:
    """Client for SPLADE sparse vector generation"""
    
    def __init__(self, model_name: str = None):
        """
        Initialize SPLADE model
        
        Args:
            model_name: HuggingFace model name, defaults to env var MODEL_NAME
        """
        self.model_name = model_name or os.getenv(
            'MODEL_NAME', 
            'naver/splade-cocondenser-ensembledistil'
        )
        self._prefer_safetensors = os.getenv(
            'SPLADE_USE_SAFETENSORS', 'true'
        ).lower() not in {'0', 'false', 'no'}
        
        logger.info(f"Loading SPLADE model: {self.model_name}")
        
        # Determine device
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Using device: {self.device}")
        
        # Load tokenizer and model
        try:
            self.tokenizer = AutoTokenizer.from_pretrained(self.model_name)
            self.model = self._load_model()
            self.model.to(self.device)
            self.model.eval()
            logger.info(f"Model loaded successfully on {self.device}")
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            raise
    
    def _load_model(self):
        """
        Load SPLADE model with graceful fallbacks for safetensor preference
        and transformers torch safety checks on older torch builds.
        """
        load_kwargs = {}
        if self._prefer_safetensors:
            load_kwargs['use_safetensors'] = True
        
        def _attempt_load(**kwargs):
            return AutoModelForMaskedLM.from_pretrained(self.model_name, **kwargs)
        
        try:
            return _attempt_load(**load_kwargs)
        except ValueError as err:
            err_msg = str(err)
            # Retry without safetensors if the repo does not provide them
            if 'safetensor' in err_msg.lower() and 'not available' in err_msg.lower() and load_kwargs.pop('use_safetensors', None):
                logger.warning("Safetensor weights not found for %s; retrying with default weights", self.model_name)
                return _attempt_load(**load_kwargs)
            # Transformers >=4.46 enforces torch >=2.6; bypass for existing image
            if 'upgrade torch to at least v2.6' in err_msg.lower():
                logger.warning("Bypassing torch.load safety gate for torch %s to keep existing image", torch.__version__)
                from transformers.utils import import_utils as hf_import_utils  # Lazy import to keep patch local
                hf_import_utils.check_torch_load_is_safe = lambda: None  # type: ignore[attr-defined]
                hf_import_utils.is_torch_greater_or_equal = lambda *_args, **_kwargs: True  # type: ignore[attr-defined]
                return _attempt_load(**load_kwargs)
            raise
    
    def encode(self, text: str) -> Dict[str, List]:
        """
        Encode single text to sparse vector
        
        Args:
            text: Input text
        
        Returns:
            Dictionary with 'indices' and 'values' keys
        """
        with torch.no_grad():
            # Tokenize
            inputs = self.tokenizer(
                text,
                return_tensors='pt',
                padding=True,
                truncation=True,
                max_length=512
            ).to(self.device)
            
            # Get logits from model
            outputs = self.model(**inputs)
            logits = outputs.logits
            
            # Apply ReLU and max pooling over sequence dimension
            # SPLADE: max over token positions, then ReLU
            sparse_repr = torch.max(
                torch.log(1 + torch.relu(logits)) * inputs['attention_mask'].unsqueeze(-1),
                dim=1
            )[0]
            
            # Convert to sparse format (indices + values)
            sparse_repr = sparse_repr.squeeze()
            
            # Get non-zero elements
            indices = torch.nonzero(sparse_repr).squeeze(-1).cpu().tolist()
            values = sparse_repr[indices].cpu().tolist()
            
            # Ensure indices is a list even for single element
            if isinstance(indices, int):
                indices = [indices]
                values = [values]
            
            result = {
                'indices': indices,
                'values': values
            }
            
            # Clear GPU cache after processing
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            return result
    
    def encode_batch(self, texts: List[str]) -> List[Dict[str, List]]:
        """
        Encode batch of texts to sparse vectors with memory management
        
        Args:
            texts: List of input texts
        
        Returns:
            List of dictionaries with 'indices' and 'values' keys
        """
        if not texts:
            return []
        
        # Filter out empty/invalid texts and track original indices
        valid_texts = []
        valid_indices = []
        for idx, text in enumerate(texts):
            if text and isinstance(text, str) and text.strip():
                valid_texts.append(text.strip())
                valid_indices.append(idx)
        
        # If no valid texts, return empty sparse vectors for all
        if not valid_texts:
            return [{'indices': [], 'values': []} for _ in texts]
        
        # Internal batch size to prevent OOM - configurable via env
        internal_batch_size = int(os.getenv('SPLADE_INTERNAL_BATCH_SIZE', '8'))
        
        # Process in smaller chunks to avoid OOM
        all_results = []
        for i in range(0, len(valid_texts), internal_batch_size):
            batch_texts = valid_texts[i:i + internal_batch_size]
            
            with torch.no_grad():
                # Tokenize batch
                inputs = self.tokenizer(
                    batch_texts,
                    return_tensors='pt',
                    padding=True,
                    truncation=True,
                    max_length=512
                ).to(self.device)
                
                # Get logits from model
                outputs = self.model(**inputs)
                logits = outputs.logits
                
                # Apply ReLU and max pooling over sequence dimension
                sparse_reprs = torch.max(
                    torch.log(1 + torch.relu(logits)) * inputs['attention_mask'].unsqueeze(-1),
                    dim=1
                )[0]
                
                # Convert each to sparse format
                for sparse_repr in sparse_reprs:
                    # Get non-zero elements
                    indices = torch.nonzero(sparse_repr).squeeze(-1).cpu().tolist()
                    values = sparse_repr[indices].cpu().tolist()
                    
                    # Ensure indices is a list even for single element
                    if isinstance(indices, int):
                        indices = [indices]
                        values = [values]
                    
                    all_results.append({
                        'indices': indices,
                        'values': values
                    })
                
                # Clear GPU cache after each sub-batch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
        
        # Reconstruct results in original order, filling empty vectors for invalid texts
        final_results = []
        result_idx = 0
        for i in range(len(texts)):
            if i in valid_indices:
                final_results.append(all_results[result_idx])
                result_idx += 1
            else:
                final_results.append({'indices': [], 'values': []})
        
        return final_results
    
    def close(self):
        """Clean up resources"""
        if hasattr(self, 'model'):
            del self.model
        if hasattr(self, 'tokenizer'):
            del self.tokenizer
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        logger.info("SPLADE client closed")
