import { Pool, PoolClient } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/smartadmin';

if (!DATABASE_URL) {
  throw new Error('Please define the DATABASE_URL environment variable');
}

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    console.log('[PostgreSQL] Creating new connection pool...');
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: 20, // Maximum number of clients in the pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('connect', () => {
      console.log('[PostgreSQL] New client connected to the pool');
    });

    pool.on('error', (err) => {
      console.error('[PostgreSQL] Unexpected error on idle client:', err);
    });
  }
  return pool;
}

// Export function to get database connection
export async function connectToDatabase(): Promise<PoolClient> {
  try {
    const pool = getPool();
    const client = await pool.connect();
    console.log('[PostgreSQL] Connected to database successfully');
    
    // Ensure the message_logs table exists
    await ensureTablesExist(client);
    
    return client;
  } catch (error) {
    console.error('[PostgreSQL] Connection error:', error);
    throw new Error('Failed to connect to PostgreSQL database');
  }
}

// Create tables if they don't exist
async function ensureTablesExist(client: PoolClient): Promise<void> {
  try {
    // Create message_logs table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS message_logs (
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
    `;
    
    await client.query(createTableQuery);
    
    // Create task_whitelist table
    const createWhitelistTableQuery = `
      CREATE TABLE IF NOT EXISTS task_whitelist (
        id SERIAL PRIMARY KEY,
        type VARCHAR(10) NOT NULL CHECK (type IN ('ip', 'email')),
        value VARCHAR(255) NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(type, value)
      );
    `;
    
    await client.query(createWhitelistTableQuery);
    
    // Create task_queue table
    const createTaskQueueQuery = `
      CREATE TABLE IF NOT EXISTS task_queue (
        id SERIAL PRIMARY KEY,
        task_id VARCHAR(255) NOT NULL UNIQUE,
        email VARCHAR(255),
        ip VARCHAR(255),
        status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
        object_data JSONB,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    
    await client.query(createTaskQueueQuery);
    
    // Create unique constraint and indexes for better performance
    const createIndexQueries = [
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_message_logs_message_id_unique ON message_logs(message_id);',
      'CREATE INDEX IF NOT EXISTS idx_message_logs_client_id ON message_logs(client_id);',
      'CREATE INDEX IF NOT EXISTS idx_message_logs_timestamp ON message_logs(timestamp);',
      'CREATE INDEX IF NOT EXISTS idx_message_logs_type ON message_logs(type);',
      'CREATE INDEX IF NOT EXISTS idx_message_logs_command ON message_logs(command);',
      'CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at);',
      
      // Task whitelist indexes
      'CREATE INDEX IF NOT EXISTS idx_task_whitelist_type_value ON task_whitelist(type, value);',
      'CREATE INDEX IF NOT EXISTS idx_task_whitelist_created_at ON task_whitelist(created_at);',
      
      // Task queue indexes
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_task_queue_task_id ON task_queue(task_id);',
      'CREATE INDEX IF NOT EXISTS idx_task_queue_status ON task_queue(status);',
      'CREATE INDEX IF NOT EXISTS idx_task_queue_email ON task_queue(email);',
      'CREATE INDEX IF NOT EXISTS idx_task_queue_ip ON task_queue(ip);',
      'CREATE INDEX IF NOT EXISTS idx_task_queue_created_at ON task_queue(created_at);'
    ];
    
    for (const query of createIndexQueries) {
      await client.query(query);
    }
    
    console.log('✅ All database tables and indexes created successfully');
  } catch (error) {
    console.error('❌ Error creating database tables:', error);
    throw error;
  }
}

// Legacy export for compatibility
export default connectToDatabase;
