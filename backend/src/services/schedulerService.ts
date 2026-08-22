import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { emailQueue } from '../config/queue';
import { EmailJobData, ScheduleEmailRequest } from '../types';

export async function scheduleEmailCampaign(
  userId: string,
  request: ScheduleEmailRequest
): Promise<{ campaignId: string; jobCount: number }> {
  const {
    recipients,
    subject,
    body,
    senderEmail,
    startTime,
    delayBetweenEmails,
    hourlyLimit,
  } = request;

  const campaign = await prisma.emailCampaign.create({
    data: {
      userId,
      subject,
      body,
      senderEmail,
      startTime: new Date(startTime),
      delayBetweenEmails,
      hourlyLimit,
      totalRecipients: recipients.length,
      status: 'ACTIVE',
    },
  });

  const startTimeMs = new Date(startTime).getTime();
  const now = Date.now();

  const jobRecords = recipients.map((recipientEmail, index) => {
    const scheduledAt = new Date(startTimeMs + index * delayBetweenEmails * 1000);
    const idempotencyKey = crypto
      .createHash('sha256')
      .update(`${campaign.id}:${recipientEmail}`)
      .digest('hex');

    return {
      id: uuidv4(),
      campaignId: campaign.id,
      recipientEmail,
      subject,
      body,
      senderEmail,
      scheduledAt,
      status: 'SCHEDULED' as const,
      idempotencyKey,
    };
  });

  await prisma.emailJob.createMany({
    data: jobRecords,
  });

  const bullmqJobs = await Promise.all(
    jobRecords.map(async (jobRecord, index) => {
      const delayMs = Math.max(0, startTimeMs + index * delayBetweenEmails * 1000 - now);

      const jobData: EmailJobData = {
        jobId: jobRecord.id,
        campaignId: campaign.id,
        recipientEmail: jobRecord.recipientEmail,
        senderEmail: jobRecord.senderEmail,
        subject: jobRecord.subject,
        body: jobRecord.body,
        idempotencyKey: jobRecord.idempotencyKey,
        hourlyLimit,
      };

      const bullmqJob = await emailQueue.add(
        'send-email',
        jobData,
        {
          delay: delayMs,
          jobId: jobRecord.id,
        }
      );

      return { dbId: jobRecord.id, bullmqJobId: bullmqJob.id };
    })
  );

  await Promise.all(
    bullmqJobs.map(({ dbId, bullmqJobId }) =>
      prisma.emailJob.update({
        where: { id: dbId },
        data: { bullmqJobId: bullmqJobId || undefined, status: 'QUEUED' },
      })
    )
  );

  console.log(
    `Campaign ${campaign.id} created with ${recipients.length} jobs, ` +
    `starting at ${startTime}, delay: ${delayBetweenEmails}s, limit: ${hourlyLimit}/hr`
  );

  return { campaignId: campaign.id, jobCount: recipients.length };
}

export async function recoverJobs(): Promise<number> {
  console.log('Running job recovery check...');

  const now = new Date();

  const pendingJobs = await prisma.emailJob.findMany({
    where: {
      status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
      scheduledAt: { gt: now },
    },
    include: {
      campaign: true,
    },
  });

  if (pendingJobs.length === 0) {
    console.log('No jobs to recover');
    return 0;
  }

  let recoveredCount = 0;

  for (const job of pendingJobs) {
    try {

      const existingJob = await emailQueue.getJob(job.id);
      if (existingJob) {
        continue;
      }

      const delayMs = Math.max(0, job.scheduledAt.getTime() - Date.now());

      const jobData: EmailJobData = {
        jobId: job.id,
        campaignId: job.campaignId,
        recipientEmail: job.recipientEmail,
        senderEmail: job.senderEmail,
        subject: job.subject,
        body: job.body,
        idempotencyKey: job.idempotencyKey,
        hourlyLimit: job.campaign.hourlyLimit,
      };

      await emailQueue.add('send-email', jobData, {
        delay: delayMs,
        jobId: job.id,
      });

      await prisma.emailJob.update({
        where: { id: job.id },
        data: { status: 'QUEUED' },
      });

      recoveredCount++;
    } catch (err) {
      console.error(`Failed to recover job ${job.id}:`, (err as Error).message);
    }
  }

  const pastDueJobs = await prisma.emailJob.findMany({
    where: {
      status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
      scheduledAt: { lte: now },
    },
    include: {
      campaign: true,
    },
  });

  for (const job of pastDueJobs) {
    try {
      const existingJob = await emailQueue.getJob(job.id);
      if (existingJob) continue;

      const jobData: EmailJobData = {
        jobId: job.id,
        campaignId: job.campaignId,
        recipientEmail: job.recipientEmail,
        senderEmail: job.senderEmail,
        subject: job.subject,
        body: job.body,
        idempotencyKey: job.idempotencyKey,
        hourlyLimit: job.campaign.hourlyLimit,
      };

      await emailQueue.add('send-email', jobData, {
        delay: 0,
        jobId: job.id,
      });

      await prisma.emailJob.update({
        where: { id: job.id },
        data: { status: 'QUEUED' },
      });

      recoveredCount++;
    } catch (err) {
      console.error(`Failed to recover past-due job ${job.id}:`, (err as Error).message);
    }
  }

  console.log(`Recovered ${recoveredCount} jobs`);
  return recoveredCount;
}
