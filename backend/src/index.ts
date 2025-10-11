import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import { connectDB } from './config/db.js';

connectDB();

const PORT = process.env.PORT;

const server = http.createServer(app);

// Attach socket.io
const io = new Server(server, {
  cors: { origin: '*' },
});
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on ${PORT}`);
});
