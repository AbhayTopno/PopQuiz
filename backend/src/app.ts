import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes.js';
import quizRoutes from './routes/quizRoutes.js';

const app = express();

const escapeRegexSpecials = (value: string) => value.replace(/[-/\\^$+?.()|[\]{}]/g, '\\$&');

const resolveCorsOrigin = () => {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) {
    return { allowAll: true, origins: [] as string[] };
  }

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const allowAll = origins.includes('*');
  return { allowAll, origins };
};

const { allowAll, origins } = resolveCorsOrigin();

app.use(
  cors({
    origin: (requestOrigin, callback) => {
      if (!requestOrigin) {
        return callback(null, true);
      }

      if (allowAll) {
        return callback(null, true);
      }

      const normalizedRequest = requestOrigin.toLowerCase();

      const isAllowed = origins.some((allowedOrigin) => {
        if (allowedOrigin === '*') {
          return true;
        }

        if (allowedOrigin.includes('*')) {
          const pattern = `^${escapeRegexSpecials(allowedOrigin).replace(/\\\*/g, '.*')}$`;
          return new RegExp(pattern, 'i').test(normalizedRequest);
        }

        return allowedOrigin.toLowerCase() === normalizedRequest;
      });

      if (isAllowed) {
        return callback(null, true);
      }

      return callback(new Error(`Origin ${requestOrigin} not allowed by CORS policy`));
    },
    credentials: true,
  }),
);

// Add basic middleware
app.use(express.json());

// Add routes here
app.use('/api/auth', userRoutes);
app.use('/api/quiz', quizRoutes);

export default app;
