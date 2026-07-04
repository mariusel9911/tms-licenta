import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  const log = req.log ?? logger;
  log.error({ err, method: req.method, url: req.url }, 'Unhandled error');
  res.status(500).json({ success: false, error: 'Internal server error' });
};
