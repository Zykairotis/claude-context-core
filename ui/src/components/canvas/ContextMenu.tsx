/**
 * ContextMenu - Right-click menu for nodes and canvas
 */

import { Menu, MenuItem, ListItemIcon, ListItemText, Divider, alpha } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import EditIcon from '@mui/icons-material/Edit';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import GitHubIcon from '@mui/icons-material/GitHub';
import WebIcon from '@mui/icons-material/Web';
import StorageIcon from '@mui/icons-material/Storage';
import FilterListIcon from '@mui/icons-material/FilterList';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DashboardIcon from '@mui/icons-material/Dashboard';

interface ContextMenuProps {
  open: boolean;
  position: { top: number; left: number };
  onClose: () => void;
  type: 'node' | 'canvas' | 'edge';
  onAction: (action: string) => void;
}

export function ContextMenu({ open, position, onClose, type, onAction }: ContextMenuProps) {
  const handleAction = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <Menu
      open={open}
      onClose={onClose}
      anchorReference="anchorPosition"
      anchorPosition={position}
      sx={{
        '& .MuiPaper-root': {
          bgcolor: alpha('#000', 0.95),
          backdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid',
          borderColor: alpha('#cd853f', 0.3),
          boxShadow: `0 8px 32px ${alpha('#cd853f', 0.25)}`,
          borderRadius: 2,
          minWidth: 200,
        },
        '& .MuiMenuItem-root': {
          color: '#fff',
          fontSize: '0.875rem',
          py: 1,
          px: 2,
          '&:hover': {
            bgcolor: alpha('#cd853f', 0.15),
            borderLeft: `3px solid ${alpha('#cd853f', 0.6)}`,
            pl: '14px',
          },
        },
        '& .MuiListItemIcon-root': {
          color: '#cd853f',
          minWidth: 36,
        },
        '& .MuiDivider-root': {
          borderColor: alpha('#cd853f', 0.2),
          my: 0.5,
        },
      }}
    >
      {type === 'node' && (
        <>
          <MenuItem onClick={() => handleAction('edit')}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Node</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction('copy')}>
            <ListItemIcon>
              <ContentCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Copy</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction('duplicate')}>
            <ListItemIcon>
              <FileCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Duplicate</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction('hide')}>
            <ListItemIcon>
              <VisibilityOffIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Hide</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction('delete')}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: '#ff4444 !important' }} />
            </ListItemIcon>
            <ListItemText sx={{ color: '#ff4444' }}>Delete</ListItemText>
          </MenuItem>
        </>
      )}
      
      {type === 'canvas' && (
        <>
          {/* Add Node Section */}
          <MenuItem onClick={() => handleAction('add:github')}>
            <ListItemIcon>
              <GitHubIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add GitHub Repo</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction('add:crawler')}>
            <ListItemIcon>
              <WebIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add Web Crawler</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction('add:vectordb')}>
            <ListItemIcon>
              <StorageIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add Vector DB</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction('add:reranker')}>
            <ListItemIcon>
              <FilterListIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add Reranker</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction('add:llm')}>
            <ListItemIcon>
              <SmartToyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add LLM</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction('add:dashboard')}>
            <ListItemIcon>
              <DashboardIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add Dashboard</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction('paste')}>
            <ListItemIcon>
              <ContentPasteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Paste</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleAction('fitView')}>
            <ListItemIcon>
              <VisibilityOffIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Fit View</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction('selectAll')}>
            <ListItemIcon>
              <FileCopyIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Select All</ListItemText>
          </MenuItem>
        </>
      )}

      {type === 'edge' && (
        <>
          <MenuItem onClick={() => handleAction('editEdge')}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Edit Edge</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={() => handleAction('deleteEdge')}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: '#ff4444 !important' }} />
            </ListItemIcon>
            <ListItemText sx={{ color: '#ff4444' }}>Delete Edge</ListItemText>
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
