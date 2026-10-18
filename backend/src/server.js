import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/database.js';

const port = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDatabase();
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('The API will start, but requirement requests will return 503 until MongoDB is available.');
  }
  app.listen(port, () => console.log(`API server is running at http://localhost:${port}`));
}

startServer().catch((error) => {
  console.error('Could not start the API server:', error.message);
  process.exit(1);
});
