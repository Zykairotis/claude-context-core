/**
 * Settings Panel - Node-specific configuration
 * Dynamically renders settings based on node type
 */

import { useState, useEffect } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Stack,
  Divider,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Checkbox,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Chip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import type { NodeMetadata, NodeType } from '@types';
import type { NodeSettings } from '../../types/settings';
import { getDefaultSettings, validateSettings } from '../../types/settings';
import { useUpdateNode } from '@lib/api';
import { toast } from '@lib/toast';

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  node: NodeMetadata | null;
}

export function SettingsPanel({ open, onClose, node }: SettingsPanelProps) {
  const [settings, setSettings] = useState<NodeSettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  const updateNode = useUpdateNode();

  // Load node settings when panel opens
  useEffect(() => {
    if (node && open) {
      const nodeSettings = node.data as NodeSettings || getDefaultSettings(node.type as NodeType);
      setSettings({
        ...nodeSettings,
        type: node.type as any,
        label: node.label,
      });
      setErrors({});
      setIsDirty(false);
    }
  }, [node, open]);

  const handleClose = () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Are you sure you want to close?')) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!node || !settings) return;

    // Validate settings
    const validationErrors = validateSettings(settings);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error('Please fix validation errors');
      return;
    }

    try {
      await updateNode.mutateAsync({
        nodeId: node.id,
        updates: {
          label: settings.label,
          data: settings,
        },
      });

      toast.success('Settings saved successfully!');
      setIsDirty(false);
      onClose();
    } catch (error) {
      toast.error('Failed to save settings');
      console.error('Failed to save settings:', error);
    }
  };

  const handleReset = () => {
    if (node) {
      const defaultSettings = getDefaultSettings(node.type as NodeType);
      setSettings({
        ...defaultSettings,
        label: node.label,
      });
      setErrors({});
      setIsDirty(true);
    }
  };

  const updateField = (field: string, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value } as NodeSettings);
    setIsDirty(true);
    // Clear error for this field
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  if (!node || !settings) {
    return null;
  }

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{
        sx: {
          width: 450,
          backgroundColor: 'background.paper',
        },
      }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">Node Settings</Typography>
            <Typography variant="caption" color="text.secondary">
              {node.type} · {node.id.slice(0, 8)}
            </Typography>
          </Box>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider />

        {/* Content */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
          <Stack spacing={2}>
            {/* Dirty indicator */}
            {isDirty && (
              <Alert severity="info" sx={{ mb: 1 }}>
                You have unsaved changes
              </Alert>
            )}

            {/* Validation errors */}
            {Object.keys(errors).length > 0 && (
              <Alert severity="error">
                Please fix {Object.keys(errors).length} validation error(s)
              </Alert>
            )}

            {/* Basic Settings */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Basic Settings</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={2}>
                  <TextField
                    label="Node Label"
                    value={settings.label}
                    onChange={(e) => updateField('label', e.target.value)}
                    fullWidth
                    required
                  />

                  <TextField
                    label="Description"
                    value={settings.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Optional description"
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            {/* Type-specific settings */}
            {renderTypeSpecificSettings(settings, updateField, errors)}
          </Stack>
        </Box>

        {/* Actions */}
        <Divider />
        <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!isDirty || updateNode.isPending}
            fullWidth
          >
            {updateNode.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={handleReset}
            disabled={updateNode.isPending}
          >
            Reset
          </Button>
        </Box>
      </Box>
    </Drawer>
  );
}

// Render settings specific to each node type
function renderTypeSpecificSettings(
  settings: NodeSettings,
  updateField: (field: string, value: any) => void,
  errors: Record<string, string>
) {
  switch (settings.type) {
    case 'github':
      return (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>GitHub Settings</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <TextField
                label="Repository"
                value={settings.repo}
                onChange={(e) => updateField('repo', e.target.value)}
                placeholder="github.com/owner/repo"
                fullWidth
                required
                error={!!errors.repo}
                helperText={errors.repo || 'Format: github.com/owner/repo'}
              />

              <TextField
                label="Branch"
                value={settings.branch}
                onChange={(e) => updateField('branch', e.target.value)}
                placeholder="main"
                fullWidth
                required
              />

              <TextField
                label="Dataset"
                value={settings.dataset || ''}
                onChange={(e) => updateField('dataset', e.target.value)}
                placeholder="my-dataset (optional)"
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel>Scope</InputLabel>
                <Select
                  value={settings.scope || 'project'}
                  onChange={(e) => updateField('scope', e.target.value)}
                >
                  <MenuItem value="global">Global</MenuItem>
                  <MenuItem value="project">Project</MenuItem>
                  <MenuItem value="local">Local</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Include Patterns"
                value={settings.fileFilters?.include?.join(', ') || '*'}
                onChange={(e) => updateField('fileFilters', {
                  ...settings.fileFilters,
                  include: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                placeholder="*.ts, *.tsx"
                fullWidth
                helperText="Comma-separated patterns"
              />

              <TextField
                label="Exclude Patterns"
                value={settings.fileFilters?.exclude?.join(', ') || ''}
                onChange={(e) => updateField('fileFilters', {
                  ...settings.fileFilters,
                  exclude: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                })}
                placeholder="node_modules/**, *.min.js"
                fullWidth
                helperText="Comma-separated patterns"
              />
            </Stack>
          </AccordionDetails>
        </Accordion>
      );

    case 'webcrawler':
      return (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Web Crawler Settings</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <TextField
                label="Start URL"
                value={settings.startUrl}
                onChange={(e) => updateField('startUrl', e.target.value)}
                placeholder="https://example.com"
                fullWidth
                required
                error={!!errors.startUrl}
                helperText={errors.startUrl}
              />

              <TextField
                label="Max Pages"
                type="number"
                value={settings.maxPages}
                onChange={(e) => updateField('maxPages', parseInt(e.target.value))}
                fullWidth
                required
                inputProps={{ min: 1, max: 1000 }}
              />

              <TextField
                label="Max Depth"
                type="number"
                value={settings.maxDepth}
                onChange={(e) => updateField('maxDepth', parseInt(e.target.value))}
                fullWidth
                required
                inputProps={{ min: 1, max: 10 }}
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.sameDomainOnly}
                    onChange={(e) => updateField('sameDomainOnly', e.target.checked)}
                  />
                }
                label="Same domain only"
              />

              <FormControlLabel
                control={
                  <Checkbox
                    checked={settings.extractCodeExamples}
                    onChange={(e) => updateField('extractCodeExamples', e.target.checked)}
                  />
                }
                label="Extract code examples"
              />
            </Stack>
          </AccordionDetails>
        </Accordion>
      );

    case 'vectordb':
      return (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Vector Database Settings</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Stack spacing={2}>
              <TextField
                label="URL"
                value={settings.url}
                onChange={(e) => updateField('url', e.target.value)}
                placeholder="http://localhost:6333"
                fullWidth
                required
              />

              <TextField
                label="Collection Name"
                value={settings.collectionName}
                onChange={(e) => updateField('collectionName', e.target.value)}
                fullWidth
                required
              />

              <TextField
                label="Embedding Model"
                value={settings.embeddingModel}
                onChange={(e) => updateField('embeddingModel', e.target.value)}
                fullWidth
              />

              <TextField
                label="Dimension"
                type="number"
                value={settings.dimension}
                onChange={(e) => updateField('dimension', parseInt(e.target.value))}
                fullWidth
                inputProps={{ min: 1, max: 4096 }}
              />

              <FormControl fullWidth>
                <InputLabel>Distance Metric</InputLabel>
                <Select
                  value={settings.distanceMetric}
                  onChange={(e) => updateField('distanceMetric', e.target.value)}
                >
                  <MenuItem value="cosine">Cosine</MenuItem>
                  <MenuItem value="euclidean">Euclidean</MenuItem>
                  <MenuItem value="dot">Dot Product</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </AccordionDetails>
        </Accordion>
      );

    default:
      return (
        <Alert severity="info">
          Settings for {settings.type} nodes are not yet implemented.
          <br />
          <Typography variant="caption" component="div" sx={{ mt: 1 }}>
            Current data: <pre>{JSON.stringify(settings, null, 2)}</pre>
          </Typography>
        </Alert>
      );
  }
}
