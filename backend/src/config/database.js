import mongoose from 'mongoose';

export async function connectDatabase() {
  const { MONGODB_URI } = process.env;
  if (!MONGODB_URI) {
    console.log('MONGODB_URI is not set; starting the API without a database connection.');
    return false;
  }
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB.');
  return true;
}
