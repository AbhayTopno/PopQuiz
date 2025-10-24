import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { connectDB } from './config/db.js';
import { connectRedis, disconnectRedis } from './config/redis.js';
import { initializeSocketIO } from './services/socketio.js';

// Connect to databases
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis
    await connectRedis();

    const PORT = process.env.PORT || 4000;

    const server = http.createServer(app);

    // Initialize Socket.IO
    initializeSocketIO(server);

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔌 Socket.IO ready for connections`);
    });

    // Graceful shutdown
    const gracefulShutdown = async () => {
      console.log('\n⚠️  Shutting down gracefully...');
      try {
        await disconnectRedis();
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
