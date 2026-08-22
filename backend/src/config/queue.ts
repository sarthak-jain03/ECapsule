import { Queue } from 'bullmq';
import { redisConnection } from './redis';

export const EMAIL_QUEUE_NAME = 'email-queue';

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600,
    },
    removeOnFail: {
      count: 5000,
    },
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('Queue error:', err.message);
});

console.log('BullMQ email queue initialized');
