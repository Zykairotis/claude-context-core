/**
 * Node Icons Mapping
 * Maps node types to Material UI icons with consistent styling
 */

import GitHubIcon from '@mui/icons-material/GitHub';
import LanguageIcon from '@mui/icons-material/Language';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import StorageIcon from '@mui/icons-material/Storage';
import DataObjectIcon from '@mui/icons-material/DataObject';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import PsychologyIcon from '@mui/icons-material/Psychology';
import DashboardIcon from '@mui/icons-material/Dashboard';
import type { NodeType } from '@types';

export function getNodeIcon(type: NodeType) {
  const icons = {
    github: GitHubIcon,
    crawler: LanguageIcon,
    file: UploadFileIcon,
    dataset: StorageIcon,
    vectordb: DataObjectIcon,
    reranker: AutoFixHighIcon,
    llm: PsychologyIcon,
    dashboard: DashboardIcon,
  };
  return icons[type] || StorageIcon;
}

export function getNodeColor(type: NodeType): string {
  const colors = {
    github: '#000000',      // Black (GitHub branding)
    crawler: '#3b82f6',     // Blue (web/internet)
    vectordb: '#8b5cf6',    // Purple (data storage)
    reranker: '#06b6d4',    // Cyan (processing)
    llm: '#10b981',         // Green (AI/intelligence)
    dashboard: '#f59e0b',   // Amber (visualization)
    file: '#6366f1',        // Indigo (files)
    dataset: '#ec4899',     // Pink (data)
  };
  return colors[type] || '#64748b';
}
