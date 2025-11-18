const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uparceladmin:%23parcel1012@18.143.26.43:5432/smartadmin'
});

async function checkSchema() {
  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    
    // Show table schema first
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
    
    // Get total count
    const countResult = await client.query('SELECT COUNT(*) FROM message_logs');
    console.log('Total message_logs entries:', countResult.rows[0].count);
    
    // Get recent entries using correct column names
    const recentResult = await client.query(`
      SELECT * FROM message_logs 
      ORDER BY timestamp DESC 
      LIMIT 5
    `);
    console.log('Recent entries:');
    recentResult.rows.forEach((row, index) => {
      console.log(`${index + 1}. Row:`, JSON.stringify(row, null, 2));
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Database error:', error.message);
    console.error('Stack:', error.stack);
  }
}

checkSchema();