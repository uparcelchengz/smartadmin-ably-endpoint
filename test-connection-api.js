// Test script to verify connection API works
async function testConnectionAPI() {
  console.log('Testing Connection API...\n');

  // Test POST - Create a connection
  console.log('1. Testing POST /api/logs/connection');
  const testConnection = {
    clientId: 'test-client-123',
    hostname: 'test-machine',
    clientIP: '192.168.1.100',
    clientTimezone: 'America/New_York',
    platform: 'win32',
    appVersion: '1.0.0',
    connectedAt: new Date(),
    status: 'online'
  };

  try {
    const postResponse = await fetch('http://localhost:3000/api/logs/connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testConnection)
    });
    
    const postData = await postResponse.json();
    console.log('✓ POST Response:', postData);
    console.log('✓ Connection created with ID:', postData.data?._id);
    console.log('');

    // Test GET - Retrieve connections
    console.log('2. Testing GET /api/logs/connection');
    const getResponse = await fetch('http://localhost:3000/api/logs/connection?limit=10');
    const getData = await getResponse.json();
    console.log('✓ GET Response:', {
      success: getData.success,
      count: getData.data?.length || 0,
      total: getData.pagination?.total
    });
    console.log('✓ Latest connections:');
    getData.data?.slice(0, 3).forEach((conn, i) => {
      console.log(`  ${i + 1}. ${conn.clientId} - ${conn.status} - ${new Date(conn.connectedAt).toLocaleString()}`);
    });
    console.log('');

    // Test PATCH - Update connection to offline
    console.log('3. Testing PATCH /api/logs/connection');
    const patchResponse = await fetch('http://localhost:3000/api/logs/connection', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'test-client-123',
        disconnectedAt: new Date()
      })
    });
    
    const patchData = await patchResponse.json();
    console.log('✓ PATCH Response:', patchData);
    if (patchData.success) {
      console.log('✓ Connection updated successfully');
      console.log('  Status:', patchData.data?.status);
      console.log('  Duration:', patchData.data?.connectionDuration, 'ms');
    } else {
      console.log('✗ PATCH failed:', patchData.error);
    }
    console.log('');

    // Final GET to verify update
    console.log('4. Final verification GET');
    const finalResponse = await fetch('http://localhost:3000/api/logs/connection?clientId=test-client-123');
    const finalData = await finalResponse.json();
    console.log('✓ Connections for test-client-123:', finalData.data?.length || 0);
    finalData.data?.forEach((conn, i) => {
      console.log(`  ${i + 1}. Status: ${conn.status}, Connected: ${new Date(conn.connectedAt).toLocaleString()}`);
    });

    console.log('\n✓ All tests completed!');
  } catch (error) {
    console.error('✗ Test failed:', error.message);
  }
}

testConnectionAPI();
