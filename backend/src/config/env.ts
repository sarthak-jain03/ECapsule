import dotenv from 'dotenv';
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || '3001', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  DATABASE_URL: process.env.DATABASE_URL || '',

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),

  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/auth/google/callback',

  JWT_SECRET: process.env.JWT_SECRET || 'dev-secret-change-me',

  SESSION_SECRET: process.env.SESSION_SECRET || 'session-secret-change-me',

  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',

  SMTP_HOST: process.env.SMTP_HOST || 'smtp.ethereal.email',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',

  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  MIN_DELAY_BETWEEN_EMAILS_MS: parseInt(process.env.MIN_DELAY_BETWEEN_EMAILS_MS || '2000', 10),
  MAX_EMAILS_PER_HOUR_PER_SENDER: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '100', 10),
};
