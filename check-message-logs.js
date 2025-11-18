const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uparceladmin:%23parcel1012@18.143.26.43:5432/smartadmin'
});

async function checkMessageLogs() {
  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    
    // Check if table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'message_logs'
      )
    `);
    console.log('message_logs table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Get total count
      const countResult = await client.query('SELECT COUNT(*) FROM message_logs');
      console.log('Total message_logs entries:', countResult.rows[0].count);
      
      // Get recent entries
      const recentResult = await client.query(`
        SELECT command, type, data, timestamp, client_id
        FROM message_logs 
        ORDER BY timestamp DESC 
        LIMIT 10
      `);
      console.log('Recent entries:');
      recentResult.rows.forEach(row => {
        console.log(`- ${row.command} (${row.type}) from ${row.client_id} at ${row.timestamp}`);
        if (row.command === 'message-log') {
          console.log('  Data:', JSON.stringify(row.data, null, 2));
        }
      });
      
      // Check for message-log specifically
      const messageLogResult = await client.query(`
        SELECT COUNT(*) FROM message_logs WHERE command = 'message-log'
      `);
      console.log('Message-log entries count:', messageLogResult.rows[0].count);
      
      // Show table schema
      const schemaResult = await client.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'message_logs'
        ORDER BY ordinal_position
      `);
      console.log('Table schema:');
      schemaResult.rows.forEach(col => {
        console.log(`  ${col.column_name}: ${col.data_type}`);
      });
    }
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Database error:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkMessageLogs();