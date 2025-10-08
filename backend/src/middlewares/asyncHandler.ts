import type { Request, Response, NextFunction } from 'express';

type AsyncHandlerFunction<T = unknown> = (
  _req: Request,
  _res: Response,
  _next: NextFunction,
) => Promise<T> | void;

export const asyncHandler = <T = unknown>(fn: AsyncHandlerFunction<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      res.status(500).json({ message: error.message });
    });
  };
};
