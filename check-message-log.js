const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://uparceladmin:%23parcel1012@18.143.26.43:5432/smartadmin'
});

async function checkMessageLogEntries() {
  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();
    
    // Check for message-log specifically
    const messageLogResult = await client.query(`
      SELECT COUNT(*) FROM message_logs WHERE command = 'message-log'
    `);
    console.log('Message-log entries count:', messageLogResult.rows[0].count);
    
    // Check all unique commands
    const commandsResult = await client.query(`
      SELECT command, COUNT(*) as count 
      FROM message_logs 
      GROUP BY command 
      ORDER BY count DESC
    `);
    console.log('Commands in database:');
    commandsResult.rows.forEach(row => {
      console.log(`  ${row.command}: ${row.count} entries`);
    });
    
    // Check if any message-log entries exist
    if (messageLogResult.rows[0].count > 0) {
      const sampleResult = await client.query(`
        SELECT * FROM message_logs 
        WHERE command = 'message-log' 
        ORDER BY timestamp DESC 
        LIMIT 3
      `);
      console.log('Sample message-log entries:');
      sampleResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. Message-log:`, JSON.stringify(row, null, 2));
      });
    } else {
      console.log('No message-log entries found in database.');
    }
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Database error:', error.message);
  }
}

checkMessageLogEntries();