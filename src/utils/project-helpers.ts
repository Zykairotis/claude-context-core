import { Pool, PoolClient } from 'pg';

/**
 * Sentinel value to represent "all projects" scope
 * Used internally to bypass project-specific filtering
 */
export const ALL_PROJECTS_SENTINEL = '__ALL_PROJECTS__';

export interface Project {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  isGlobal: boolean;
}

export interface Dataset {
  id: string;
  name: string;
  projectId: string;
  description?: string;
  isGlobal: boolean;
}

/**
 * Get or create a project by name
 */
export async function getOrCreateProject(
  client: PoolClient | Pool,
  name: string,
  description?: string
): Promise<{ id: string; name: string }> {
  try {
    // Try to get existing project
    const selectResult = await client.query(
      'SELECT id, name FROM claude_context.projects WHERE name = $1',
      [name]
    );

    if (selectResult.rows.length > 0) {
      return {
        id: selectResult.rows[0].id,
        name: selectResult.rows[0].name
      };
    }

    // Create new project
    const insertResult = await client.query(
      `INSERT INTO claude_context.projects (name, description, is_active, is_global)
       VALUES ($1, $2, true, false)
       RETURNING id, name`,
      [name, description || `Project: ${name}`]
    );

    console.log(`[ProjectHelpers] ✅ Created project: ${name} (${insertResult.rows[0].id})`);

    return {
      id: insertResult.rows[0].id,
      name: insertResult.rows[0].name
    };
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to get/create project ${name}:`, error);
    throw error;
  }
}

/**
 * Get or create a dataset within a project
 */
export async function getOrCreateDataset(
  client: PoolClient | Pool,
  projectId: string,
  name: string,
  description?: string
): Promise<{ id: string; name: string }> {
  try {
    // Try to get existing dataset
    const selectResult = await client.query(
      'SELECT id, name FROM claude_context.datasets WHERE project_id = $1 AND name = $2',
      [projectId, name]
    );

    if (selectResult.rows.length > 0) {
      return {
        id: selectResult.rows[0].id,
        name: selectResult.rows[0].name
      };
    }

    // Create new dataset
    const insertResult = await client.query(
      `INSERT INTO claude_context.datasets (project_id, name, description, status, is_global)
       VALUES ($1, $2, $3, 'active', false)
       RETURNING id, name`,
      [projectId, name, description || `Dataset: ${name}`]
    );

    console.log(`[ProjectHelpers] ✅ Created dataset: ${name} (${insertResult.rows[0].id})`);

    return {
      id: insertResult.rows[0].id,
      name: insertResult.rows[0].name
    };
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to get/create dataset ${name}:`, error);
    throw error;
  }
}

/**
 * Get all dataset IDs across all projects
 * @param includeGlobal Whether to include global datasets (default: true)
 */
export async function getAllDatasetIds(
  client: PoolClient | Pool,
  includeGlobal: boolean = true
): Promise<string[]> {
  try {
    const query = includeGlobal
      ? `SELECT DISTINCT id FROM claude_context.datasets`
      : `SELECT DISTINCT id FROM claude_context.datasets WHERE is_global = false`;

    const result = await client.query(query);
    return result.rows.map(row => row.id);
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to get all dataset IDs:`, error);
    throw error;
  }
}

/**
 * Get all accessible dataset IDs for a project
 * Includes: owned datasets + shared datasets + global datasets
 * Special case: if projectId is ALL_PROJECTS_SENTINEL, returns all datasets
 */
export async function getAccessibleDatasets(
  client: PoolClient | Pool,
  projectId: string,
  includeGlobal: boolean = true
): Promise<string[]> {
  try {
    // Special case: "all" projects scope
    if (projectId === ALL_PROJECTS_SENTINEL) {
      return getAllDatasetIds(client, includeGlobal);
    }

    const query = `
      SELECT DISTINCT d.id
      FROM claude_context.datasets d
      WHERE 
        -- Owned datasets
        d.project_id = $1
        -- Shared datasets
        OR EXISTS (
          SELECT 1 FROM claude_context.project_shares ps
          WHERE ps.to_project_id = $1
            AND ps.resource_type = 'dataset'
            AND ps.resource_id = d.id
            AND ps.can_read = true
        )
        ${includeGlobal ? '-- Global datasets\nOR d.is_global = true' : ''}
    `;

    const result = await client.query(query, [projectId]);
    return result.rows.map(row => row.id);
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to get accessible datasets for project ${projectId}:`, error);
    throw error;
  }
}

/**
 * Check if a resource is accessible to a project
 */
export async function isResourceAccessible(
  client: PoolClient | Pool,
  projectId: string,
  resourceType: 'dataset' | 'document' | 'web_page',
  resourceId: string
): Promise<boolean> {
  try {
    let query: string;
    
    switch (resourceType) {
      case 'dataset':
        query = `
          SELECT EXISTS (
            SELECT 1 FROM claude_context.datasets d
            WHERE d.id = $2
              AND (
                d.project_id = $1
                OR d.is_global = true
                OR EXISTS (
                  SELECT 1 FROM claude_context.project_shares ps
                  WHERE ps.to_project_id = $1
                    AND ps.resource_type = 'dataset'
                    AND ps.resource_id = $2
                    AND ps.can_read = true
                )
              )
          ) as accessible
        `;
        break;
        
      case 'document':
        query = `
          SELECT EXISTS (
            SELECT 1 FROM claude_context.documents doc
            JOIN claude_context.datasets d ON doc.dataset_id = d.id
            WHERE doc.id = $2
              AND (
                d.project_id = $1
                OR d.is_global = true
                OR doc.is_global = true
                OR EXISTS (
                  SELECT 1 FROM claude_context.project_shares ps
                  WHERE ps.to_project_id = $1
                    AND ps.resource_type = 'document'
                    AND ps.resource_id = $2
                    AND ps.can_read = true
                )
              )
          ) as accessible
        `;
        break;
        
      case 'web_page':
        query = `
          SELECT EXISTS (
            SELECT 1 FROM claude_context.web_pages wp
            JOIN claude_context.datasets d ON wp.dataset_id = d.id
            WHERE wp.id = $2
              AND (
                d.project_id = $1
                OR d.is_global = true
                OR wp.is_global = true
                OR EXISTS (
                  SELECT 1 FROM claude_context.project_shares ps
                  WHERE ps.to_project_id = $1
                    AND ps.resource_type = 'web_page'
                    AND ps.resource_id = $2
                    AND ps.can_read = true
                )
              )
          ) as accessible
        `;
        break;
        
      default:
        throw new Error(`Unsupported resource type: ${resourceType}`);
    }

    const result = await client.query(query, [projectId, resourceId]);
    return result.rows[0].accessible;
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to check resource accessibility:`, error);
    throw error;
  }
}

/**
 * Get project by name
 */
export async function getProjectByName(
  client: PoolClient | Pool,
  name: string
): Promise<Project | null> {
  try {
    const result = await client.query(
      `SELECT id, name, description, is_active as "isActive", is_global as "isGlobal"
       FROM claude_context.projects
       WHERE name = $1`,
      [name]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to get project ${name}:`, error);
    throw error;
  }
}

/**
 * Get project by ID
 */
export async function getProjectById(
  client: PoolClient | Pool,
  id: string
): Promise<Project | null> {
  try {
    const result = await client.query(
      `SELECT id, name, description, is_active as "isActive", is_global as "isGlobal"
       FROM claude_context.projects
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to get project ${id}:`, error);
    throw error;
  }
}

/**
 * Share a resource with another project
 */
export async function shareResource(
  client: PoolClient | Pool,
  sourceProjectId: string,
  targetProjectId: string,
  resourceType: 'dataset' | 'document' | 'web_page',
  resourceId: string,
  permissions: { canRead?: boolean; canWrite?: boolean; canDelete?: boolean } = {}
): Promise<void> {
  try {
    await client.query(
      `INSERT INTO claude_context.project_shares 
       (from_project_id, to_project_id, resource_type, resource_id, can_read, can_write, can_delete)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (from_project_id, to_project_id, resource_type, resource_id)
       DO UPDATE SET
         can_read = EXCLUDED.can_read,
         can_write = EXCLUDED.can_write,
         can_delete = EXCLUDED.can_delete,
         shared_at = NOW()`,
      [
        sourceProjectId,
        targetProjectId,
        resourceType,
        resourceId,
        permissions.canRead !== false, // Default true
        permissions.canWrite || false,
        permissions.canDelete || false
      ]
    );

    console.log(`[ProjectHelpers] ✅ Shared ${resourceType} ${resourceId} from ${sourceProjectId} to ${targetProjectId}`);
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to share resource:`, error);
    throw error;
  }
}

/**
 * Revoke resource sharing
 */
export async function revokeResourceShare(
  client: PoolClient | Pool,
  sourceProjectId: string,
  targetProjectId: string,
  resourceType: 'dataset' | 'document' | 'web_page',
  resourceId: string
): Promise<void> {
  try {
    await client.query(
      `DELETE FROM claude_context.project_shares
       WHERE from_project_id = $1
         AND to_project_id = $2
         AND resource_type = $3
         AND resource_id = $4`,
      [sourceProjectId, targetProjectId, resourceType, resourceId]
    );

    console.log(`[ProjectHelpers] ✅ Revoked share of ${resourceType} ${resourceId}`);
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to revoke resource share:`, error);
    throw error;
  }
}

/**
 * List all datasets in a project
 */
export async function listProjectDatasets(
  client: PoolClient | Pool,
  projectId: string
): Promise<Dataset[]> {
  try {
    const result = await client.query(
      `SELECT id, name, project_id as "projectId", description, is_global as "isGlobal"
       FROM claude_context.datasets
       WHERE project_id = $1
       ORDER BY created_at DESC`,
      [projectId]
    );

    return result.rows;
  } catch (error) {
    console.error(`[ProjectHelpers] ❌ Failed to list datasets for project ${projectId}:`, error);
    throw error;
  }
}

