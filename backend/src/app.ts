import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.ts';
import cookieParser from 'cookie-parser';
import quizRoutes from './routes/quizRoutes.js';

const app = express();

app.use(
  cors({
    origin: 'http://localhost:3000', // Allow requests from this origin
    credentials: true, // If you're using cookies or auth headers
  }),
);

// Add basic middleware
app.use(express.json());
app.use(cookieParser());

// Add routes here
app.use('/api/auth', userRoutes);
app.use('/api/quiz', quizRoutes);

export default app;
