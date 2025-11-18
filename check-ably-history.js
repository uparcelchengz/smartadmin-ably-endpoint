const Ably = require('ably');

const ably = new Ably.Realtime({
  key: "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU",
  clientId: "debug-client"
});

async function checkAblyHistory() {
  try {
    console.log('Connecting to Ably...');
    
    await new Promise((resolve, reject) => {
      ably.connection.on('connected', resolve);
      ably.connection.on('failed', reject);
    });
    
    console.log('Connected to Ably. Checking channel history...');
    
    const statusChannel = ably.channels.get('smartadmin-status');
    
    // Get recent messages
    const history = await statusChannel.history({ limit: 50 });
    
    console.log(`Found ${history.items.length} recent messages on smartadmin-status:`);
    
    const messageTypes = {};
    const messageLogEntries = [];
    
    history.items.forEach((msg, index) => {
      const update = msg.data;
      const messageType = update.type;
      
      // Count message types
      messageTypes[messageType] = (messageTypes[messageType] || 0) + 1;
      
      // Collect message-log entries
      if (messageType === 'message-log') {
        messageLogEntries.push({
          id: msg.id,
          clientId: update.clientId,
          timestamp: msg.timestamp,
          data: update.data
        });
      }
      
      console.log(`${index + 1}. ${messageType} from ${update.clientId} at ${new Date(msg.timestamp).toISOString()}`);
    });
    
    console.log('\nMessage type summary:');
    Object.entries(messageTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count} messages`);
    });
    
    if (messageLogEntries.length > 0) {
      console.log('\nMessage-log entries found:');
      messageLogEntries.forEach((entry, index) => {
        console.log(`${index + 1}. Client: ${entry.clientId}`);
        console.log(`   Timestamp: ${new Date(entry.timestamp).toISOString()}`);
        console.log(`   Data:`, JSON.stringify(entry.data, null, 2));
      });
    } else {
      console.log('\n❌ No message-log entries found in Ably channel history');
      console.log('This suggests your Electron client is not sending message-log type updates yet');
    }
    
    ably.close();
  } catch (error) {
    console.error('Ably error:', error.message);
  }
}

checkAblyHistory();