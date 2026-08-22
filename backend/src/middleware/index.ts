import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { UserPayload } from '../types';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {

    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    if (!token) {
      token = req.cookies?.token;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as UserPayload;
    (req as any).userId = decoded.id;
    (req as any).userPayload = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function getUserId(req: Request): string {
  return (req as any).userId;
}

export function getUserPayload(req: Request): UserPayload {
  return (req as any).userPayload;
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  console.error('Unhandled error:', err.message);

  if (err.name === 'ValidationError') {
    res.status(400).json({ error: err.message });
    return;
  }

  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  res.status(500).json({
    error: env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
}
