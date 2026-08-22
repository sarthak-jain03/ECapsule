import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import { env } from './config/env';
import { initPassport } from './controllers/authController';
import { initEmailTransporter } from './services/emailService';
import { recoverJobs } from './services/schedulerService';
import { startEmailWorker } from './workers/emailWorker';
import { errorHandler } from './middleware';
import authRoutes from './routes/authRoutes';
import emailRoutes from './routes/emailRoutes';

const app = express();

app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

initPassport();
app.use(passport.initialize());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/auth', authRoutes);
app.use('/api/emails', emailRoutes);

app.use(errorHandler);

async function start() {
  try {
    console.log('Starting ReachInbox Email Scheduler...');
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   Port: ${env.PORT}`);

    await initEmailTransporter();

    startEmailWorker();

    await recoverJobs();

    app.listen(env.PORT, () => {
      console.log(`\nServer running at http://localhost:${env.PORT}`);
      console.log(`   Health check: http://localhost:${env.PORT}/health`);
      console.log(`   Google OAuth: http://localhost:${env.PORT}/auth/google`);
    });
  } catch (err) {
    console.error('Failed to start server:', (err as Error).message);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received, shutting down...');
  process.exit(0);
});

start();

export default app;
