# 🔌 DBeaver Connection Guide for PostgreSQL

**Database:** claude_context  
**Location:** Docker container (claude-context-postgres)

---

## 📋 Connection Details

### **Basic Connection Information**

```
Host:        localhost
Port:        5533
Database:    claude_context
Username:    postgres
Password:    code-context-secure-password
```

### **Full Connection URL**
```
jdbc:postgresql://localhost:5533/claude_context
```

**With credentials:**
```
jdbc:postgresql://localhost:5533/claude_context?user=postgres&password=code-context-secure-password
```

---

## 🚀 Quick Setup in DBeaver

### **Step 1: Create New Database Connection**

1. Open DBeaver
2. Click **Database** → **New Database Connection** (or `Ctrl+Shift+D`)
3. Select **PostgreSQL** from the list
4. Click **Next**

### **Step 2: Enter Connection Details**

In the **Main** tab:

| Field | Value |
|-------|-------|
| **Host:** | `localhost` |
| **Port:** | `5533` |
| **Database:** | `claude_context` |
| **Username:** | `postgres` |
| **Password:** | `code-context-secure-password` |
| **Show all databases:** | ✅ (Optional, to see other DBs) |

### **Step 3: Test Connection**

1. Click **Test Connection** button
2. If prompted to download PostgreSQL driver, click **Download**
3. You should see: **Connected** ✅

### **Step 4: Save and Connect**

1. Click **Finish**
2. The connection will appear in the **Database Navigator**
3. Expand it to see schemas and tables

---

## 🔧 Advanced Configuration

### **Connection URL (Manual)**

If you prefer to use the connection URL directly:

1. In DBeaver, select your PostgreSQL connection
2. Right-click → **Edit Connection**
3. Go to **Main** tab
4. Click **Use URL** checkbox
5. Enter:
   ```
   jdbc:postgresql://localhost:5533/claude_context
   ```

---

## 📊 Schema Information

### **Default Schema**
The database uses the `claude_context` schema (not `public`).

### **Key Tables (Once Created)**
- `chunks_*` - Vector chunks for different collections
- `projects` - Project metadata
- `datasets` - Dataset information
- `web_pages` - Crawled web pages
- `ingestion_jobs` - Job tracking

### **View Schema in DBeaver**

1. Connect to the database
2. Expand: `claude_context` → `Schemas` → `claude_context`
3. Expand `Tables` to see all tables
4. Expand `Views` to see all views
5. Expand `Functions` to see stored procedures

---

## 🔍 Quick Queries to Explore

### **1. List All Tables**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'claude_context'
ORDER BY table_name;
```

### **2. Check pgvector Extension**
```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

### **3. View Table Structures**
```sql
SELECT 
    table_name,
    column_name,
    data_type,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'claude_context'
ORDER BY table_name, ordinal_position;
```

### **4. Count Records by Project**
```sql
SELECT 
    project,
    COUNT(*) as chunk_count
FROM claude_context.chunks_atlas
GROUP BY project;
```

### **5. Check Recent Ingestion Jobs**
```sql
SELECT 
    id,
    project,
    dataset,
    status,
    started_at,
    completed_at
FROM claude_context.ingestion_jobs
ORDER BY started_at DESC
LIMIT 10;
```

---

## 🛠️ Troubleshooting

### **Issue: Connection Refused**

**Check if container is running:**
```bash
docker ps | grep postgres
```

**Should show:**
```
claude-context-postgres   Up ...   0.0.0.0:5533->5432/tcp
```

**If not running, start it:**
```bash
cd services
docker-compose up -d postgres
```

---

### **Issue: Authentication Failed**

**Verify the password:**
```bash
docker exec claude-context-postgres psql -U postgres -d claude_context -c "SELECT version();"
```

**If this works, the password is correct.**

---

### **Issue: Database Does Not Exist**

**Check if database exists:**
```bash
docker exec claude-context-postgres psql -U postgres -l | grep claude_context
```

**If it doesn't exist, it will be created automatically on first ingestion.**

---

### **Issue: Can't See Tables**

**Check schema:**
1. In DBeaver, make sure you're looking at the `claude_context` schema
2. Not the `public` schema

**List schemas:**
```sql
SELECT schema_name FROM information_schema.schemata;
```

---

## 🎨 DBeaver Tips

### **1. Enable SQL Editor**
- Right-click database → **SQL Editor** → **New SQL Script**
- Or press `Ctrl+\`

### **2. View Table Data**
- Right-click table → **View Data**
- Or double-click the table

### **3. View Table Structure**
- Right-click table → **Properties** → **Columns** tab

### **4. Export Data**
- Right-click table → **Export Data**
- Choose format (CSV, JSON, SQL, etc.)

### **5. Import Data**
- Right-click table → **Import Data**
- Choose source file format

---

## 🔐 Security Note

**Default Password:** `code-context-secure-password`

**To Change Password:**

1. Check your `.env` file or environment variable:
   ```bash
   echo $POSTGRES_PASSWORD
   ```

2. Or check docker-compose:
   ```bash
   grep POSTGRES_PASSWORD services/docker-compose.yml
   ```

3. Update password in docker-compose.yml:
   ```yaml
   POSTGRES_PASSWORD: your-new-password
   ```

4. Restart container:
   ```bash
   docker-compose restart postgres
   ```

5. Update DBeaver connection with new password

---

## 📈 Useful DBeaver Views

### **Database Navigator Tree**
```
claude-context-postgres (PostgreSQL)
└── Databases
    └── claude_context
        ├── Schemas
        │   └── claude_context
        │       ├── Tables
        │       │   ├── chunks_*
        │       │   ├── projects
        │       │   ├── datasets
        │       │   └── ...
        │       ├── Views
        │       ├── Functions
        │       └── ...
        └── ...
```

### **ER Diagram**
1. Right-click database → **View Diagram**
2. Or select multiple tables → Right-click → **View ER Diagram**

---

## 🚀 Quick Connection Test

### **Using psql (CLI)**
```bash
psql -h localhost -p 5533 -U postgres -d claude_context
```

**Password:** `code-context-secure-password`

### **Using DBeaver SQL Editor**
```sql
-- Test connection
SELECT version();

-- List databases
\l

-- List schemas
\dn

-- List tables
\dt claude_context.*
```

---

## 📝 Connection Summary Card

```
╔════════════════════════════════════════════════╗
║  DBeaver PostgreSQL Connection Details        ║
╠════════════════════════════════════════════════╣
║  Host:     localhost                          ║
║  Port:     5533                               ║
║  Database: claude_context                     ║
║  User:     postgres                           ║
║  Password: code-context-secure-password        ║
║                                               ║
║  JDBC URL:                                    ║
║  jdbc:postgresql://localhost:5533/           ║
║               claude_context                  ║
╚════════════════════════════════════════════════╝
```

---

## ✅ Verification Checklist

Before connecting:
- [ ] Docker container is running (`docker ps | grep postgres`)
- [ ] Port 5533 is accessible
- [ ] PostgreSQL is healthy (`docker logs claude-context-postgres | tail -5`)
- [ ] Password is correct (default: `code-context-secure-password`)

After connecting:
- [ ] Can see database in navigator
- [ ] Can see `claude_context` schema
- [ ] Can execute test query (`SELECT version();`)
- [ ] Can browse tables (if any exist)

---

## 🎯 Next Steps

1. **Connect** to the database using DBeaver
2. **Explore** the `claude_context` schema
3. **Run queries** to inspect data
4. **Monitor** ingestion jobs and chunks
5. **Visualize** data relationships with ER diagrams

---

**Happy Database Exploration! 🚀**

For issues, check:
- Container logs: `docker logs claude-context-postgres`
- Connection test: `docker exec claude-context-postgres pg_isready -U postgres`
- Port access: `netstat -tuln | grep 5533`

