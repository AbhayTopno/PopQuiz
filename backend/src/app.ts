import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import cookieParser from 'cookie-parser';
import quizRoutes from './routes/quizRoutes.js';

const app = express();

app.use(
  cors({
    origin: process.env.NEXT_API,
    credentials: true,
  }),
);

// Add basic middleware
app.use(express.json());
app.use(cookieParser());

// Add routes here
app.use('/api/auth', userRoutes);
app.use('/api/quiz', quizRoutes);

export default app;
