import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { emailQueue, EMAIL_QUEUE_NAME } from '../config/queue';
import { env } from '../config/env';
import prisma from '../config/prisma';
import { sendEmail } from '../services/emailService';
import { checkRateLimit, decrementRateLimit } from '../services/rateLimiterService';
import { EmailJobData } from '../types';

export function startEmailWorker(): Worker {
  const worker = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const { jobId, recipientEmail, senderEmail, subject, body, idempotencyKey, hourlyLimit } = job.data;

      console.log(`Processing job ${jobId} → ${recipientEmail}`);

      const dbJob = await prisma.emailJob.findUnique({
        where: { id: jobId },
      });

      if (!dbJob) {
        console.log(` Job ${jobId} not found in DB, skipping`);
        return { status: 'skipped', reason: 'not_found' };
      }

      if (dbJob.status === 'SENT') {
        console.log(` Job ${jobId} already sent, skipping (idempotent)`);
        return { status: 'skipped', reason: 'already_sent' };
      }

      const effectiveLimit = hourlyLimit || env.MAX_EMAILS_PER_HOUR_PER_SENDER;
      const rateLimitResult = await checkRateLimit(senderEmail, effectiveLimit);

      if (!rateLimitResult.allowed) {
        console.log(
          `Rate limited: ${senderEmail} (${rateLimitResult.currentCount}/${rateLimitResult.maxAllowed}). ` +
          `Rescheduling in ${Math.ceil((rateLimitResult.retryAfterMs || 0) / 1000)}s`
        );

        await decrementRateLimit(senderEmail);

        await prisma.emailJob.update({
          where: { id: jobId },
          data: { status: 'RATE_LIMITED', retryCount: { increment: 1 } },
        });

        const delayMs = rateLimitResult.retryAfterMs || 3600000;

        await emailQueue.add('send-email', job.data, {
          delay: delayMs,
          jobId: `${jobId}-retry-${Date.now()}`,
        });

        return { status: 'rate_limited', retryAfterMs: delayMs };
      }

      await prisma.emailJob.update({
        where: { id: jobId },
        data: { status: 'SENDING' },
      });

      try {
        const result = await sendEmail(recipientEmail, senderEmail, subject, body);

        await prisma.emailJob.update({
          where: { id: jobId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            etherealPreviewUrl: result.previewUrl,
          },
        });

        await prisma.emailCampaign.update({
          where: { id: dbJob.campaignId },
          data: { sentCount: { increment: 1 } },
        });

        const campaign = await prisma.emailCampaign.findUnique({
          where: { id: dbJob.campaignId },
        });

        if (campaign && campaign.sentCount + campaign.failedCount >= campaign.totalRecipients) {
          await prisma.emailCampaign.update({
            where: { id: campaign.id },
            data: { status: 'COMPLETED' },
          });
        }

        console.log(`Job ${jobId} sent to ${recipientEmail} | Preview: ${result.previewUrl}`);

        return { status: 'sent', messageId: result.messageId, previewUrl: result.previewUrl };
      } catch (sendError) {

        const errorMessage = (sendError as Error).message;

        await prisma.emailJob.update({
          where: { id: jobId },
          data: {
            status: 'FAILED',
            errorMessage,
            retryCount: { increment: 1 },
          },
        });

        await prisma.emailCampaign.update({
          where: { id: dbJob.campaignId },
          data: { failedCount: { increment: 1 } },
        });

        console.error(`Job ${jobId} failed: ${errorMessage}`);
        throw sendError;
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: env.WORKER_CONCURRENCY,
      limiter: {
        max: 1,
        duration: env.MIN_DELAY_BETWEEN_EMAILS_MS,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`Worker completed job: ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Worker failed job: ${job?.id} — ${err.message}`);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err.message);
  });

  console.log(
    `Email worker started (concurrency: ${env.WORKER_CONCURRENCY}, ` +
    `delay: ${env.MIN_DELAY_BETWEEN_EMAILS_MS}ms, ` +
    `rate limit: ${env.MAX_EMAILS_PER_HOUR_PER_SENDER}/hr/sender)`
  );

  return worker;
}
