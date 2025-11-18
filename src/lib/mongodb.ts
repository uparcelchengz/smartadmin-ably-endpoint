import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartadmin';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    console.log('[MongoDB] Using cached connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    console.log('[MongoDB] Creating new connection to:', MONGODB_URI.substring(0, 30) + '...');
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('[MongoDB] Successfully connected to database');
      return mongoose;
    }).catch((error) => {
      console.error('[MongoDB] Connection error:', error.message);
      throw error;
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log('[MongoDB] Connection established, ready state:', mongoose.connection.readyState);
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// Export function to get database instance
export async function connectToDatabase() {
  await connectDB();
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Database connection not established');
  }
  return db;
}

export default connectDB;
