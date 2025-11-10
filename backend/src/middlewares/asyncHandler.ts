import type { Request, Response, NextFunction } from 'express';

type AsyncHandlerFunction<T = unknown> = (
  _req: Request,
  _res: Response,
  _next: NextFunction,
) => Promise<T> | void;

export const asyncHandler = <T = unknown>(fn: AsyncHandlerFunction<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      const currentStatus = res.statusCode;
      const status = currentStatus && currentStatus !== 200 ? currentStatus : 500;

      if (status === 500) {
        console.error('Unhandled error in async handler:', error);
      }

      res.status(status).json({ message: error.message || 'Internal Server Error' });
    });
  };
};
