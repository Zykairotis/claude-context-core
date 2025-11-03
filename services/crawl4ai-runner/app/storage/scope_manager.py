"""
Scope management for knowledge island isolation.

This module provides three-tier scope management:
- Global: Shared knowledge across all projects
- Project: All datasets within a project
- Local: Per-dataset within a project

Scopes enable flexible access control and data isolation for retrieval.
"""

import os
import uuid
from enum import Enum
from typing import Optional, Dict, Any


class ScopeLevel(str, Enum):
    """Knowledge scope levels."""
    GLOBAL = "global"
    PROJECT = "project"
    LOCAL = "local"


class ScopeManager:
    """
    Manages knowledge scope for storage and retrieval.
    
    This class handles collection naming, scope resolution,
    and filter generation for database queries.
    """
    
    def __init__(self, default_scope: Optional[str] = None):
        """
        Initialize scope manager.
        
        Args:
            default_scope: Default scope level (default: from env or 'local')
        """
        self.default_scope = ScopeLevel(
            default_scope or os.getenv("DEFAULT_SCOPE", "local")
        )
    
    def resolve_scope(
        self,
        project: Optional[str] = None,
        dataset: Optional[str] = None,
        requested_scope: Optional[str] = None,
    ) -> ScopeLevel:
        """
        Determine the appropriate scope level.
        
        Logic:
        - If requested_scope is 'global', return global
        - If project AND dataset provided:
            - requested_scope='local' or default -> local
            - requested_scope='project' -> project
        - If only project provided -> project
        - Otherwise -> global
        
        Args:
            project: Project name
            dataset: Dataset name
            requested_scope: Requested scope level
            
        Returns:
            Resolved ScopeLevel
        """
        # Handle explicit global request
        if requested_scope == "global":
            return ScopeLevel.GLOBAL
        
        # Convert requested_scope to enum if valid
        scope_enum = None
        if requested_scope:
            try:
                scope_enum = ScopeLevel(requested_scope)
            except ValueError:
                pass
        
        # Determine scope based on available context
        if project and dataset:
            # Both project and dataset: can be local or project
            if scope_enum == ScopeLevel.PROJECT:
                return ScopeLevel.PROJECT
            else:
                return ScopeLevel.LOCAL
        elif project:
            # Only project: must be project scope
            return ScopeLevel.PROJECT
        else:
            # No context: global scope
            return ScopeLevel.GLOBAL
    
    def get_collection_name(
        self,
        project: Optional[str] = None,
        dataset: Optional[str] = None,
        scope: Optional[ScopeLevel] = None,
    ) -> str:
        """
        Generate collection name based on scope.
        
        Collection naming:
        - Global: 'global_knowledge'
        - Project: 'project_{sanitized_project_name}'
        - Local: 'project_{sanitized_project}_dataset_{sanitized_dataset}'
        
        Args:
            project: Project name
            dataset: Dataset name
            scope: Scope level (auto-resolved if not provided)
            
        Returns:
            Collection name string
        """
        if scope is None:
            scope = self.resolve_scope(project, dataset)
        
        if scope == ScopeLevel.GLOBAL:
            return "global_knowledge"
        elif scope == ScopeLevel.PROJECT:
            if not project:
                raise ValueError("Project name required for project scope")
            return f"project_{self._sanitize_name(project)}"
        else:  # LOCAL
            if not project or not dataset:
                raise ValueError("Project and dataset names required for local scope")
            return (
                f"project_{self._sanitize_name(project)}_"
                f"dataset_{self._sanitize_name(dataset)}"
            )
    
    def get_project_id(self, project: Optional[str]) -> str:
        """
        Generate deterministic UUID for project.
        
        Args:
            project: Project name
            
        Returns:
            UUID string
        """
        if not project:
            return str(uuid.uuid5(uuid.NAMESPACE_DNS, "default"))
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, project))
    
    def get_dataset_id(self, dataset: Optional[str]) -> str:
        """
        Generate deterministic UUID for dataset.
        
        Args:
            dataset: Dataset name
            
        Returns:
            UUID string
        """
        if not dataset:
            return str(uuid.uuid5(uuid.NAMESPACE_DNS, "default"))
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, dataset))
    
    def filter_by_scope(
        self,
        scope: ScopeLevel,
        project_id: Optional[str] = None,
        dataset_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate database filter for scope.
        
        Filters:
        - Global: scope='global'
        - Project: scope='project' AND project_id=X
        - Local: scope='local' AND project_id=X AND dataset_id=Y
        
        Args:
            scope: Scope level
            project_id: Project UUID
            dataset_id: Dataset UUID
            
        Returns:
            Dict with filter conditions
        """
        filters = {"scope": scope.value}
        
        if scope == ScopeLevel.PROJECT:
            if not project_id:
                raise ValueError("Project ID required for project scope filter")
            filters["project_id"] = project_id
        elif scope == ScopeLevel.LOCAL:
            if not project_id or not dataset_id:
                raise ValueError("Project and dataset IDs required for local scope filter")
            filters["project_id"] = project_id
            filters["dataset_id"] = dataset_id
        
        return filters
    
    def get_accessible_scopes(
        self,
        project: Optional[str] = None,
        dataset: Optional[str] = None,
        include_global: bool = True,
    ) -> list[ScopeLevel]:
        """
        Get list of accessible scopes given context.
        
        Access rules:
        - With project + dataset: can access local, project, global
        - With project only: can access project, global
        - No context: can access global only
        
        Args:
            project: Project name
            dataset: Dataset name
            include_global: Whether to include global scope (default: True)
            
        Returns:
            List of accessible ScopeLevel enums
        """
        scopes = []
        
        if project and dataset:
            scopes.append(ScopeLevel.LOCAL)
            scopes.append(ScopeLevel.PROJECT)
        elif project:
            scopes.append(ScopeLevel.PROJECT)
        
        if include_global:
            scopes.append(ScopeLevel.GLOBAL)
        
        return scopes if scopes else [ScopeLevel.GLOBAL]
    
    @staticmethod
    def _sanitize_name(name: str) -> str:
        """
        Sanitize name for use in collection identifiers.
        
        Replace non-alphanumeric characters with underscores and lowercase.
        
        Args:
            name: Name to sanitize
            
        Returns:
            Sanitized name
        """
        import re
        # Replace non-alphanumeric with underscore
        sanitized = re.sub(r'[^a-zA-Z0-9]', '_', name)
        # Remove consecutive underscores
        sanitized = re.sub(r'_+', '_', sanitized)
        # Remove leading/trailing underscores
        sanitized = sanitized.strip('_')
        # Lowercase
        return sanitized.lower()


__all__ = ["ScopeLevel", "ScopeManager"]

