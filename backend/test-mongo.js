// Quick MongoDB connectivity diagnostic
// Run: node test-mongo.js
// Reads MONGO_URI from .env. Does not print full URI (to avoid leaking secrets).
import dotenv from 'dotenv';
dotenv.config();
import mongoose from 'mongoose';

const { MONGO_URI } = process.env;
if(!MONGO_URI){
  console.error('MONGO_URI is empty. Set it in .env first.');
  process.exit(1);
}

function maskUri(uri){
  try{
    // Avoid printing credentials; mask between // and @ if present
    return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^@]+)@/, '$1***:***@');
  }catch{ return '***'; }
}

console.log('Attempting MongoDB connection to', maskUri(MONGO_URI));

(async () => {
  try {
    const conn = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000,
      family: 4
    });
    const { host, port, db } = conn.connection;
    console.log('✅ Connected successfully');
    console.log('Host:', host, 'Port:', port, 'DB name:', db?.namespace || db?.name);
  } catch (err) {
    console.error('❌ Connection failed');
    // Common auth hints
    if(/auth/i.test(err.message)){
      console.error('Hint: Check username/password, database name, and user roles (readWrite).');
      console.error('If using Atlas: ensure IP is whitelisted and password special chars are URL-encoded.');
    }
    console.error('Raw error message:', err.message);
  } finally {
    await mongoose.disconnect().catch(()=>{});
    process.exit(0);
  }
})();
