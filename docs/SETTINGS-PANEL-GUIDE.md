# Settings Panel Development Guide

**Date**: November 4, 2025  
**For**: Frontend Settings Panel Implementation

---

## Overview

This guide provides everything you need to implement the settings panel for mesh canvas nodes.

---

## 📁 Key Files

### Documentation
- **`/docs/API-ENDPOINTS.md`** - Complete API reference (all endpoints documented)
- **`/docs/SETTINGS-PANEL-GUIDE.md`** - This file

### Frontend Types
- **`/ui/src/types/settings.ts`** - All settings types and validation
- **`/ui/src/types/index.ts`** - Base types (NodeMetadata, EdgeMetadata, etc.)

### API Client
- **`/ui/src/lib/api.ts`** - React Query hooks for all operations

### Backend Routes
- **`/services/api-server/src/routes/mesh.ts`** - Mesh API implementation
- **`/services/api-server/src/routes/projects.ts`** - Projects API implementation

---

## 🎨 Node Types & Settings

### Available Node Types

```typescript
type NodeType = 
  | 'github'      // GitHub repository ingestion
  | 'webcrawler'  // Web page crawler
  | 'vectordb'    // Vector database
  | 'reranker'    // Reranker service
  | 'llm'         // LLM service
  | 'dashboard'   // Dashboard/metrics
```

### Settings Structure

Each node stores its settings in the `data` field:

```typescript
interface NodeMetadata {
  id: string;
  type: NodeType;
  label: string;
  status: 'idle' | 'queued' | 'running' | 'ok' | 'failed' | 'warning';
  position: { x: number; y: number };
  data: Record<string, unknown>;  // ← Settings go here
  createdAt: string;
  updatedAt: string;
}
```

---

## 🔧 Implementation Steps

### Step 1: Import Types

```typescript
import type { NodeSettings, GitHubNodeSettings, WebCrawlerNodeSettings } from '@types/settings';
import { getDefaultSettings, validateSettings } from '@types/settings';
```

### Step 2: Create Settings Panel Component

```typescript
interface SettingsPanelProps {
  nodeId: string;
  nodeType: NodeType;
  currentSettings: NodeSettings;
  onSave: (settings: NodeSettings) => void;
  onClose: () => void;
}

export function SettingsPanel({ nodeId, nodeType, currentSettings, onSave, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState(currentSettings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleSave = () => {
    const validationErrors = validateSettings(settings);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    onSave(settings);
    onClose();
  };
  
  // Render settings form based on nodeType
  return (
    <div className="settings-panel">
      <h2>Settings: {settings.label}</h2>
      {renderSettingsForm(nodeType, settings, setSettings, errors)}
      <button onClick={handleSave}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
}
```

### Step 3: Render Type-Specific Forms

```typescript
function renderSettingsForm(
  nodeType: NodeType,
  settings: NodeSettings,
  setSettings: (s: NodeSettings) => void,
  errors: Record<string, string>
) {
  switch (nodeType) {
    case 'github':
      return <GitHubSettingsForm 
        settings={settings as GitHubNodeSettings}
        onChange={setSettings}
        errors={errors}
      />;
    
    case 'webcrawler':
      return <WebCrawlerSettingsForm 
        settings={settings as WebCrawlerNodeSettings}
        onChange={setSettings}
        errors={errors}
      />;
    
    // ... other types
    
    default:
      return <div>Unknown node type</div>;
  }
}
```

### Step 4: Use API Client to Save

```typescript
import { apiClient } from '@lib/api';
import { useUpdateNode } from '@lib/api';

function MyComponent() {
  const updateNode = useUpdateNode();
  
  const handleSaveSettings = async (nodeId: string, settings: NodeSettings) => {
    try {
      await updateNode.mutateAsync({
        nodeId,
        updates: {
          data: settings,
          label: settings.label
        }
      });
      
      toast.success('Settings saved!');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };
}
```

---

## 📝 Example: GitHub Node Settings Form

```typescript
import type { GitHubNodeSettings } from '@types/settings';

interface GitHubSettingsFormProps {
  settings: GitHubNodeSettings;
  onChange: (settings: GitHubNodeSettings) => void;
  errors: Record<string, string>;
}

export function GitHubSettingsForm({ settings, onChange, errors }: GitHubSettingsFormProps) {
  const updateField = (field: keyof GitHubNodeSettings, value: any) => {
    onChange({ ...settings, [field]: value });
  };
  
  return (
    <form>
      {/* Label */}
      <TextField
        label="Node Label"
        value={settings.label}
        onChange={(e) => updateField('label', e.target.value)}
        fullWidth
      />
      
      {/* Repository */}
      <TextField
        label="Repository"
        placeholder="github.com/owner/repo"
        value={settings.repo}
        onChange={(e) => updateField('repo', e.target.value)}
        error={!!errors.repo}
        helperText={errors.repo}
        fullWidth
        required
      />
      
      {/* Branch */}
      <TextField
        label="Branch"
        value={settings.branch}
        onChange={(e) => updateField('branch', e.target.value)}
        fullWidth
        required
      />
      
      {/* Dataset */}
      <TextField
        label="Dataset"
        placeholder="my-dataset (optional)"
        value={settings.dataset || ''}
        onChange={(e) => updateField('dataset', e.target.value)}
        fullWidth
      />
      
      {/* Scope */}
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
      
      {/* File Filters */}
      <Typography variant="subtitle2">File Filters</Typography>
      
      <TextField
        label="Include Patterns"
        placeholder="*.ts, *.tsx"
        value={settings.fileFilters?.include?.join(', ') || ''}
        onChange={(e) => updateField('fileFilters', {
          ...settings.fileFilters,
          include: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
        })}
        fullWidth
      />
      
      <TextField
        label="Exclude Patterns"
        placeholder="node_modules/**, *.test.ts"
        value={settings.fileFilters?.exclude?.join(', ') || ''}
        onChange={(e) => updateField('fileFilters', {
          ...settings.fileFilters,
          exclude: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
        })}
        fullWidth
      />
      
      {/* Auto Reindex */}
      <FormControlLabel
        control={
          <Checkbox
            checked={settings.autoReindex || false}
            onChange={(e) => updateField('autoReindex', e.target.checked)}
          />
        }
        label="Auto-reindex on changes"
      />
    </form>
  );
}
```

---

## 🔌 API Integration

### Update Node Settings

```typescript
// Using React Query hook
const updateNode = useUpdateNode();

await updateNode.mutateAsync({
  nodeId: 'node-123',
  updates: {
    label: 'My Updated Node',
    data: {
      repo: 'github.com/user/repo',
      branch: 'main',
      // ... other settings
    }
  }
});
```

### Direct API Call

```typescript
const response = await fetch('http://localhost:3030/api/nodes/node-123', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    label: 'My Updated Node',
    data: {
      repo: 'github.com/user/repo',
      branch: 'main'
    }
  })
});
```

---

## ✅ Validation

### Built-in Validation

```typescript
import { validateSettings } from '@types/settings';

const settings: GitHubNodeSettings = {
  type: 'github',
  label: 'My Repo',
  repo: 'invalid-format',  // ❌ Wrong format
  branch: ''  // ❌ Required
};

const errors = validateSettings(settings);
// {
//   repo: 'Repository must be in format: github.com/owner/repo',
//   branch: 'Branch is required'
// }
```

### Custom Validation

```typescript
const validateGitHubSettings = (settings: GitHubNodeSettings): string[] => {
  const errors: string[] = [];
  
  if (!settings.repo.startsWith('github.com/')) {
    errors.push('Repository must be a GitHub URL');
  }
  
  if (settings.maxPages && settings.maxPages > 1000) {
    errors.push('Max pages cannot exceed 1000');
  }
  
  return errors;
};
```

---

## 🎨 UI Components Recommendations

### Material-UI Components to Use

```typescript
import {
  TextField,
  Select,
  MenuItem,
  Checkbox,
  FormControlLabel,
  FormControl,
  InputLabel,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Typography,
  Switch,
  Slider,
  Chip
} from '@mui/material';
```

### Layout Structure

```tsx
<Drawer anchor="right" open={isOpen} onClose={onClose}>
  <Box sx={{ width: 400, p: 3 }}>
    {/* Header */}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
      <Typography variant="h6">Node Settings</Typography>
      <IconButton onClick={onClose}>
        <CloseIcon />
      </IconButton>
    </Box>
    
    <Divider sx={{ mb: 3 }} />
    
    {/* Settings Form */}
    <Stack spacing={2}>
      {/* Basic Settings */}
      <Accordion defaultExpanded>
        <AccordionSummary>Basic Settings</AccordionSummary>
        <AccordionDetails>
          {/* Fields */}
        </AccordionDetails>
      </Accordion>
      
      {/* Advanced Settings */}
      <Accordion>
        <AccordionSummary>Advanced Settings</AccordionSummary>
        <AccordionDetails>
          {/* Fields */}
        </AccordionDetails>
      </Accordion>
    </Stack>
    
    {/* Actions */}
    <Box sx={{ display: 'flex', gap: 1, mt: 3 }}>
      <Button variant="contained" onClick={handleSave}>
        Save Changes
      </Button>
      <Button variant="outlined" onClick={handleReset}>
        Reset
      </Button>
    </Box>
  </Box>
</Drawer>
```

---

## 🔄 State Management

### Using Zustand Store

```typescript
// Add to your store
interface Store {
  // ... existing state
  settingsPanel: {
    isOpen: boolean;
    nodeId: string | null;
    nodeType: NodeType | null;
  };
  openSettingsPanel: (nodeId: string, nodeType: NodeType) => void;
  closeSettingsPanel: () => void;
}

// Usage in component
const { settingsPanel, openSettingsPanel, closeSettingsPanel } = useRealtimeStore();

// Open settings when node is double-clicked
const onNodeDoubleClick = (event: any, node: Node) => {
  openSettingsPanel(node.id, node.data.type);
};
```

---

## 🧪 Testing

### Test Checklist

- [ ] All node types render correct form
- [ ] Validation shows errors correctly
- [ ] Settings save to API successfully
- [ ] Settings persist after page reload
- [ ] Form resets work correctly
- [ ] Invalid values are prevented
- [ ] Optional fields work correctly
- [ ] Advanced settings toggle works
- [ ] Help text is displayed
- [ ] Error messages are clear

### Example Test

```typescript
describe('GitHubSettingsForm', () => {
  it('validates repository format', () => {
    const settings: GitHubNodeSettings = {
      type: 'github',
      label: 'Test',
      repo: 'invalid',
      branch: 'main'
    };
    
    const errors = validateSettings(settings);
    expect(errors.repo).toBe('Repository must be in format: github.com/owner/repo');
  });
  
  it('saves settings via API', async () => {
    const { result } = renderHook(() => useUpdateNode());
    
    await act(async () => {
      await result.current.mutateAsync({
        nodeId: 'node-1',
        updates: { data: settings }
      });
    });
    
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3030/api/nodes/node-1',
      expect.objectContaining({ method: 'PATCH' })
    );
  });
});
```

---

## 📚 References

- **API Docs**: `/docs/API-ENDPOINTS.md`
- **Settings Types**: `/ui/src/types/settings.ts`
- **API Client**: `/ui/src/lib/api.ts`
- **Material-UI**: https://mui.com/
- **React Query**: https://tanstack.com/query/latest

---

## 🚀 Quick Start

1. **Read the API docs**
   ```bash
   cat docs/API-ENDPOINTS.md
   ```

2. **Check the types**
   ```bash
   cat ui/src/types/settings.ts
   ```

3. **Create your settings form component**
   ```bash
   touch ui/src/components/settings/SettingsPanel.tsx
   ```

4. **Import and use**
   ```typescript
   import { SettingsPanel } from '@components/settings/SettingsPanel';
   import type { NodeSettings } from '@types/settings';
   ```

---

## 💡 Pro Tips

1. **Use default settings**: Call `getDefaultSettings(nodeType)` when creating new nodes
2. **Validate early**: Validate on blur, not just on submit
3. **Show help text**: Add descriptions to complex fields
4. **Group related settings**: Use accordions for better UX
5. **Autosave**: Consider debounced autosave for better UX
6. **Keyboard shortcuts**: Add Cmd+S to save, Escape to close
7. **Dirty state**: Show unsaved changes indicator
8. **Confirmation**: Ask before discarding unsaved changes

---

## 🐛 Common Issues

### Issue: Settings not persisting
**Solution**: Make sure you're calling `updateNode.mutateAsync()` and awaiting the result

### Issue: Validation not working
**Solution**: Check that you're passing the correct node type to `validateSettings()`

### Issue: Form not updating
**Solution**: Ensure you're using controlled components with proper `value` and `onChange`

### Issue: API returns 404
**Solution**: Verify API server is running and mesh routes are mounted at `/api`

---

**Ready to build!** You have all the types, validation, and API integration you need. 🎉
