const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://admin:admin@cluster0.mjuhihb.mongodb.net/smartadmin?retryWrites=true&w=majority';

async function testConnection() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected successfully!');
    
    // List collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\nCollections in database:');
    collections.forEach(col => console.log(' -', col.name));
    
    // Count documents
    const connectionsCount = await mongoose.connection.db.collection('clientconnections').countDocuments();
    const messagesCount = await mongoose.connection.db.collection('messages').countDocuments();
    
    console.log('\nDocument counts:');
    console.log(' - clientconnections:', connectionsCount);
    console.log(' - messages:', messagesCount);
    
    // Show sample connection
    const sampleConnection = await mongoose.connection.db.collection('clientconnections').findOne();
    console.log('\nSample connection:');
    console.log(JSON.stringify(sampleConnection, null, 2));
    
    // Show sample message
    const sampleMessage = await mongoose.connection.db.collection('messages').findOne();
    console.log('\nSample message:');
    console.log(JSON.stringify(sampleMessage, null, 2));
    
    await mongoose.disconnect();
    console.log('\n✓ Test completed!');
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

testConnection();
