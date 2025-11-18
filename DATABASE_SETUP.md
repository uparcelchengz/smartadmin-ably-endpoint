# PostgreSQL Database Setup for SmartAdmin Dashboard

This file contains the SQL commands to set up your PostgreSQL database for the SmartAdmin Dashboard.

## Requirements
- PostgreSQL 12 or higher
- Database connection string in environment variable: `DATABASE_URL`

## Environment Setup

Add this to your `.env.local` file:

```bash
# PostgreSQL Database URL
DATABASE_URL=postgresql://username:password@localhost:5432/smartadmin

# Example for local development:
# DATABASE_URL=postgresql://postgres:password@localhost:5432/smartadmin

# Example for cloud services (Supabase, Neon, etc.):
# DATABASE_URL=postgresql://user:pass@db.example.com:5432/smartadmin?sslmode=require
```

## Database Schema

The application will automatically create the required tables when it first connects, but you can also run these manually:

```sql
-- Create the smartadmin database (run as superuser)
CREATE DATABASE smartadmin;

-- Connect to the smartadmin database
\c smartadmin;

-- Create message_logs table
CREATE TABLE message_logs (
    id SERIAL PRIMARY KEY,
    message_id VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('sent', 'received')),
    channel VARCHAR(255) NOT NULL,
    command VARCHAR(255) NOT NULL,
    payload JSONB,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_message_logs_client_id ON message_logs(client_id);
CREATE INDEX idx_message_logs_timestamp ON message_logs(timestamp);
CREATE INDEX idx_message_logs_type ON message_logs(type);
CREATE INDEX idx_message_logs_command ON message_logs(command);
CREATE INDEX idx_message_logs_created_at ON message_logs(created_at);

-- Create a composite index for common queries
CREATE INDEX idx_message_logs_client_timestamp ON message_logs(client_id, timestamp DESC);
```

## Verification Queries

After setup, verify your database:

```sql
-- Check table structure
\d message_logs

-- Check indexes
\d+ message_logs

-- Sample query to test
SELECT 
    client_id,
    type,
    command,
    timestamp,
    payload
FROM message_logs 
ORDER BY timestamp DESC 
LIMIT 10;

-- Count messages by type
SELECT 
    type,
    COUNT(*) as count
FROM message_logs 
GROUP BY type;

-- Recent messages for a specific client
SELECT 
    command,
    timestamp,
    payload->>'uptime' as uptime,
    payload->>'memory' as memory
FROM message_logs 
WHERE client_id = 'your-client-id'
    AND type = 'received'
ORDER BY timestamp DESC 
LIMIT 20;
```

## Common PostgreSQL Cloud Providers

### 1. **Supabase** (Recommended for development)
- Free tier: 500MB, 2 concurrent connections
- URL format: `postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres`

### 2. **Neon** (Serverless PostgreSQL)
- Free tier: 512MB, autoscaling
- URL format: `postgresql://[user]:[password]@[endpoint]/[database]?sslmode=require`

### 3. **Railway**
- Simple deployment, pay-as-you-go
- Provides DATABASE_URL automatically

### 4. **Heroku Postgres**
- Free tier: 10,000 rows
- Integrates well with Heroku deployments

### 5. **Amazon RDS**
- Production-grade, fully managed
- Free tier: db.t3.micro for 12 months

### 6. **Google Cloud SQL**
- Highly available, automatic backups
- Pay-per-use pricing

## Local Development Setup

### Using Docker:
```bash
# Run PostgreSQL in Docker
docker run --name smartadmin-postgres \
    -e POSTGRES_PASSWORD=password \
    -e POSTGRES_DB=smartadmin \
    -p 5432:5432 \
    -d postgres:15

# Connect to the database
docker exec -it smartadmin-postgres psql -U postgres -d smartadmin
```

### Using Homebrew (macOS):
```bash
# Install PostgreSQL
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Create database
createdb smartadmin

# Connect to database
psql smartadmin
```

### Using package manager (Ubuntu/Debian):
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres createuser --interactive
sudo -u postgres createdb smartadmin
```

## Performance Optimization

For production use, consider these optimizations:

```sql
-- Partition large tables by date (for high-volume logs)
CREATE TABLE message_logs_y2025m11 PARTITION OF message_logs
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

-- Set up automatic vacuum and analyze
ALTER TABLE message_logs SET (
    autovacuum_vacuum_scale_factor = 0.1,
    autovacuum_analyze_scale_factor = 0.05
);

-- Add database-level settings for better JSON performance
-- (Run as superuser)
ALTER DATABASE smartadmin SET timezone = 'UTC';
ALTER DATABASE smartadmin SET log_statement = 'all';  -- For debugging only
```

## Monitoring

Monitor your PostgreSQL database performance:

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('smartadmin'));

-- Check table sizes
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check recent activity
SELECT 
    client_id,
    COUNT(*) as message_count,
    MAX(timestamp) as last_message
FROM message_logs 
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY client_id
ORDER BY message_count DESC;
```

## Migration from MongoDB

If you're migrating from MongoDB, the application handles the data format differences automatically. The PostgreSQL schema provides:

- **Better performance** for time-series queries
- **ACID compliance** for data integrity
- **Advanced indexing** for faster searches
- **JSON support** for flexible payload storage
- **Better analytics** capabilities with SQL

## Troubleshooting

### Common Issues:

1. **Connection refused**: Check if PostgreSQL is running and accessible
2. **Permission denied**: Ensure user has proper database permissions
3. **SSL required**: Add `?sslmode=require` to your DATABASE_URL for cloud providers
4. **Timezone issues**: Set database timezone to UTC for consistency

### Debug Connection:
```bash
# Test connection
psql $DATABASE_URL

# Or test with Node.js
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
    console.log(err ? 'Error:' + err : 'Success:' + res.rows[0].now);
    process.exit();
});
"
```