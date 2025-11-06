"""Progress Mapper for smooth progress transitions across workflow phases.

Prevents progress bar jumps by mapping phase-specific progress (0-100%)
to overall progress ranges, ensuring monotonic increasing progress values.
"""

from __future__ import annotations

import logging
from typing import Dict, Tuple

LOGGER = logging.getLogger(__name__)


class ProgressMapper:
    """Maps phase-specific progress to overall progress ranges."""
    
    # Define progress ranges for each phase (start%, end%)
    PHASE_RANGES: Dict[str, Tuple[int, int]] = {
        "initializing": (0, 5),
        "discovery": (5, 15),
        "crawling": (15, 60),
        "chunking": (60, 70),
        "summarizing": (70, 80),
        "embedding": (80, 92),
        "storing": (92, 98),
        "completed": (98, 100),
        "cancelled": (0, 100),  # Keep current progress
        "failed": (0, 100),  # Keep current progress
    }
    
    def __init__(self):
        self._last_overall_progress = 0
        self._current_phase: str = "initializing"
    
    def map_progress(
        self, 
        phase: str, 
        phase_progress: int,
        *,
        force_value: int | None = None
    ) -> int:
        """
        Map phase-specific progress to overall progress.
        
        Args:
            phase: Current workflow phase
            phase_progress: Progress within the phase (0-100)
            force_value: Optional fixed value to return (bypasses mapping)
        
        Returns:
            Overall progress value (0-100), guaranteed to be >= last value
        """
        # Force value takes precedence (for completion/error states)
        if force_value is not None:
            overall = max(force_value, self._last_overall_progress)
            self._last_overall_progress = overall
            self._current_phase = phase
            return overall
        
        # Get phase range
        phase_range = self.PHASE_RANGES.get(phase)
        if not phase_range:
            LOGGER.warning(f"Unknown phase: {phase}, using current progress")
            return self._last_overall_progress
        
        start, end = phase_range
        
        # Clamp phase_progress to 0-100
        phase_progress = max(0, min(100, phase_progress))
        
        # Map to overall range
        range_size = end - start
        overall = start + int((phase_progress / 100) * range_size)
        
        # Ensure monotonic increase
        overall = max(overall, self._last_overall_progress)
        
        # Debug log for tracking
        if phase != self._current_phase or overall != self._last_overall_progress:
            LOGGER.debug(
                f"Progress: {self._current_phase}@{self._last_overall_progress}% "
                f"→ {phase}@{phase_progress}% = {overall}% overall"
            )
        
        self._last_overall_progress = overall
        self._current_phase = phase
        
        return overall
    
    def get_current_progress(self) -> int:
        """Get the last reported overall progress."""
        return self._last_overall_progress
    
    def get_current_phase(self) -> str:
        """Get the current phase."""
        return self._current_phase
    
    def reset(self) -> None:
        """Reset progress tracking (for new operations)."""
        self._last_overall_progress = 0
        self._current_phase = "initializing"
        LOGGER.debug("Progress mapper reset")


__all__ = ["ProgressMapper"]
