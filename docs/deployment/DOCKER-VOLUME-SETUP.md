# Docker Volume Setup for Local Indexing

## Problem

The API server runs in a Docker container and cannot access your host filesystem by default. This causes local path indexing to fail with:

```
ENOENT: no such file or directory, scandir '/path/to/your/code'
```

## Solution

Mount your home directory (or specific directories) as volumes in the API server container.

### Quick Fix

Edit `/services/docker-compose.yml` and add volumes to the `api-server` service:

```yaml
  api-server:
    # ... existing config ...
    volumes:
      - /home/YOUR_USERNAME:/home/YOUR_USERNAME:ro  # Mount home directory read-only
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Replace `YOUR_USERNAME` with your actual username (e.g., `mewtwo`).

### Restart API Server

```bash
cd /path/to/claude-context-core/services
docker-compose up -d api-server
```

### Test

```bash
# Test with curl
curl -X POST http://localhost:3030/projects/test/ingest/local \
  -H "Content-Type: application/json" \
  -d '{"path":"/home/YOUR_USERNAME/your-project"}'

# Or use the MCP tool
claudeContext.indexLocal({ path: "/home/YOUR_USERNAME/your-project" })
```

## Alternative: Mount Specific Directories

If you don't want to mount your entire home directory, mount only specific project directories:

```yaml
  api-server:
    volumes:
      - /home/YOUR_USERNAME/projects:/home/YOUR_USERNAME/projects:ro
      - /home/YOUR_USERNAME/workspace:/home/YOUR_USERNAME/workspace:ro
```

## Security Notes

- **Read-only mounts** (`:ro`) are recommended for safety
- The API server can only read files, not modify them
- Consider what directories you expose to the container
- Never mount sensitive directories like `~/.ssh` or `~/.gnupg`

## Permissions

The container runs as root by default, so it can read any files your user can read. If you have permission issues, check:

```bash
# Check file permissions
ls -la /path/to/your/code

# Ensure files are readable
chmod -R +r /path/to/your/code
```

## Troubleshooting

### "ENOENT" error persists after adding volume

1. **Verify volume is mounted:**
   ```bash
   docker inspect claude-context-api-server --format='{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
   ```

2. **Check container can see files:**
   ```bash
   docker exec claude-context-api-server ls -la /home/YOUR_USERNAME/your-project
   ```

3. **Restart container:**
   ```bash
   docker-compose restart api-server
   ```

### "Permission denied" error

The container may not have read access:

```bash
# Make files readable
chmod -R +r /path/to/your/code

# Or change ownership (not recommended)
sudo chown -R $(id -u):$(id -g) /path/to/your/code
```

### Path doesn't exist in container

Make sure you're using the **same path** in both:
- The volume mount source (left side of `:`)
- The indexLocal path parameter

Example:
```yaml
volumes:
  - /home/mewtwo/projects:/home/mewtwo/projects:ro
```

```typescript
claudeContext.indexLocal({ path: "/home/mewtwo/projects/my-app" })
```

## Docker for Mac/Windows

On Mac and Windows, Docker Desktop automatically mounts common directories. You may not need to add explicit volume mounts for paths under:
- `/Users` (Mac)
- `C:\Users` (Windows/WSL)

Check Docker Desktop settings → Resources → File Sharing to see what's already shared.

## Production Deployment

For production, consider:

1. **Dedicated mount point:**
   ```yaml
   volumes:
     - /var/lib/codebases:/codebases:ro
   ```

2. **Multiple specific mounts:**
   ```yaml
   volumes:
     - /opt/project1:/opt/project1:ro
     - /opt/project2:/opt/project2:ro
   ```

3. **Network file systems:**
   - NFS mounts for shared codebases
   - Git clones inside the container
   - Use `indexGitHub` instead of `indexLocal`

## When to Use `indexGitHub` Instead

If you're having trouble with volume mounts, consider using `claudeContext.indexGitHub` which clones repositories inside the container:

```typescript
// Instead of indexLocal with volumes
claudeContext.indexGitHub({
  repo: "github.com/user/repo",
  branch: "main"
})
```

This avoids volume mount complexity but requires:
- Repository is on GitHub
- Network access from container
- Disk space inside container

## Summary

✅ **Local Development:** Mount `/home/YOUR_USERNAME`  
✅ **Production:** Mount specific project directories  
✅ **Alternative:** Use `indexGitHub` for remote repositories  
❌ **Don't:** Mount sensitive directories or entire filesystem  
