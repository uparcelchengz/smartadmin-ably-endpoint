// Test client to simulate an Electron app connecting to Ably
const Ably = require('ably');
const os = require('os');

const clientId = `test-client-${Date.now()}`;
const ably = new Ably.Realtime({
  key: "j5t3sA.v_O0XA:TwoToQ-v5IqoqZYEHVGGiIxbU1O0WLztVSX7CFulXVU",
  clientId: clientId
});

console.log('Starting test client:', clientId);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

ably.connection.on('connected', async () => {
  console.log('✓ Connected to Ably');
  
  // Enter presence channel with client data
  const presenceChannel = ably.channels.get('smartadmin-presence');
  const clientData = {
    clientId: clientId,
    hostname: os.hostname(),
    clientIP: '192.168.1.100',
    clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: os.platform(),
    appVersion: '1.0.0'
  };
  
  console.log('✓ Entering presence with data:', clientData);
  await presenceChannel.presence.enter(clientData);
  console.log('✓ Presence entered successfully');
  console.log('');
  console.log('Client is now online. Check the dashboard!');
  console.log('Dashboard: http://localhost:3000');
  console.log('Logs: http://localhost:3000/logs');
  console.log('');
  
  // Send some status updates
  const statusChannel = ably.channels.get('smartadmin-status');
  let counter = 0;
  
  const heartbeatInterval = setInterval(() => {
    counter++;
    const update = {
      clientId: clientId,
      type: 'heartbeat',
      timestamp: new Date().toISOString(),
      data: {
        uptime: process.uptime(),
        memory: process.memoryUsage().heapUsed
      }
    };
    
    statusChannel.publish('status-update', update);
    console.log(`[${new Date().toLocaleTimeString()}] Sent heartbeat #${counter}`);
    
    // Disconnect after 30 seconds
    if (counter >= 6) {
      console.log('');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Disconnecting client...');
      clearInterval(heartbeatInterval);
      
      presenceChannel.presence.leave().then(() => {
        console.log('✓ Left presence channel');
        ably.connection.close();
        console.log('✓ Connection closed');
        console.log('');
        console.log('Check the logs page - status should be "offline"');
        process.exit(0);
      });
    }
  }, 5000);
  
  // Listen for commands
  const controlChannel = ably.channels.get(`smartadmin-control-${clientId}`);
  controlChannel.subscribe('command', (message) => {
    console.log('');
    console.log('⚡ Received command:', message.data);
    console.log('');
  });
});

ably.connection.on('failed', (err) => {
  console.error('✗ Connection failed:', err);
  process.exit(1);
});

ably.connection.on('disconnected', () => {
  console.log('Disconnected from Ably');
});

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Received SIGINT, cleaning up...');
  
  const presenceChannel = ably.channels.get('smartadmin-presence');
  await presenceChannel.presence.leave();
  console.log('✓ Left presence channel');
  
  ably.connection.close();
  console.log('✓ Connection closed');
  process.exit(0);
});
