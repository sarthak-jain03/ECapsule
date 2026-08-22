import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { scheduleEmailCampaign } from '../services/schedulerService';
import { ScheduleEmailRequest } from '../types';
import { getUserId } from '../middleware';
import { parse } from 'csv-parse/sync';

export async function scheduleEmails(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const { recipients, subject, body, senderEmail, startTime, delayBetweenEmails, hourlyLimit } = req.body as ScheduleEmailRequest;

    if (!recipients || recipients.length === 0) {
      res.status(400).json({ error: 'At least one recipient is required' });
      return;
    }
    if (!subject) {
      res.status(400).json({ error: 'Subject is required' });
      return;
    }
    if (!body) {
      res.status(400).json({ error: 'Body is required' });
      return;
    }
    if (!senderEmail) {
      res.status(400).json({ error: 'Sender email is required' });
      return;
    }
    if (!startTime) {
      res.status(400).json({ error: 'Start time is required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validRecipients = recipients.filter((e: string) => emailRegex.test(e));

    if (validRecipients.length === 0) {
      res.status(400).json({ error: 'No valid email addresses provided' });
      return;
    }

    const result = await scheduleEmailCampaign(userId, {
      recipients: validRecipients,
      subject,
      body,
      senderEmail,
      startTime,
      delayBetweenEmails: delayBetweenEmails || 2,
      hourlyLimit: hourlyLimit || 100,
    });

    res.status(201).json({
      message: `Campaign scheduled with ${result.jobCount} emails`,
      campaignId: result.campaignId,
      jobCount: result.jobCount,
    });
  } catch (err) {
    console.error('Schedule error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to schedule emails' });
  }
}

export async function parseCsv(req: Request, res: Response): Promise<void> {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const content = file.buffer.toString('utf-8');
    const emailRegex = /[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/g;

    let emails: string[] = [];
    try {
      const records = parse(content, {
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      });

      for (const row of records) {
        for (const cell of row as string[]) {
          const found = String(cell).match(emailRegex);
          if (found) {
            emails.push(...found);
          }
        }
      }
    } catch {

      const found = content.match(emailRegex);
      if (found) {
        emails = found;
      }
    }

    emails = [...new Set(emails.map((e) => e.toLowerCase()))];

    res.json({
      emails,
      count: emails.length,
    });
  } catch (err) {
    console.error('CSV parse error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to parse CSV file' });
  }
}

export async function getScheduledEmails(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: {
          campaign: { userId },
          status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
        include: {
          campaign: {
            select: { subject: true, senderEmail: true },
          },
        },
      }),
      prisma.emailJob.count({
        where: {
          campaign: { userId },
          status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
        },
      }),
    ]);

    res.json({
      data: jobs.map((job) => ({
        id: job.id,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        senderEmail: job.senderEmail,
        body: job.body,
        scheduledAt: job.scheduledAt.toISOString(),
        status: job.status,
        campaignId: job.campaignId,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get scheduled error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch scheduled emails' });
  }
}

export async function getSentEmails(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const [jobs, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: {
          campaign: { userId },
          status: { in: ['SENT', 'FAILED'] },
        },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
        include: {
          campaign: {
            select: { subject: true, senderEmail: true },
          },
        },
      }),
      prisma.emailJob.count({
        where: {
          campaign: { userId },
          status: { in: ['SENT', 'FAILED'] },
        },
      }),
    ]);

    res.json({
      data: jobs.map((job) => ({
        id: job.id,
        recipientEmail: job.recipientEmail,
        subject: job.subject,
        senderEmail: job.senderEmail,
        body: job.body,
        scheduledAt: job.scheduledAt.toISOString(),
        sentAt: job.sentAt?.toISOString() || null,
        status: job.status,
        etherealPreviewUrl: job.etherealPreviewUrl,
        errorMessage: job.errorMessage,
        campaignId: job.campaignId,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get sent error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
}

export async function getEmailById(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    const job = await prisma.emailJob.findFirst({
      where: {
        id,
        campaign: { userId },
      },
      include: {
        campaign: true,
      },
    });

    if (!job) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }

    res.json({
      id: job.id,
      recipientEmail: job.recipientEmail,
      subject: job.subject,
      senderEmail: job.senderEmail,
      body: job.body,
      scheduledAt: job.scheduledAt.toISOString(),
      sentAt: job.sentAt?.toISOString() || null,
      status: job.status,
      etherealPreviewUrl: job.etherealPreviewUrl,
      errorMessage: job.errorMessage,
      campaignId: job.campaignId,
      campaign: {
        id: job.campaign.id,
        subject: job.campaign.subject,
        startTime: job.campaign.startTime.toISOString(),
        delayBetweenEmails: job.campaign.delayBetweenEmails,
        hourlyLimit: job.campaign.hourlyLimit,
        totalRecipients: job.campaign.totalRecipients,
        sentCount: job.campaign.sentCount,
        failedCount: job.campaign.failedCount,
        status: job.campaign.status,
      },
    });
  } catch (err) {
    console.error('Get email error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch email' });
  }
}

export async function getEmailStats(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req);

    const [scheduled, sent, failed] = await Promise.all([
      prisma.emailJob.count({
        where: {
          campaign: { userId },
          status: { in: ['SCHEDULED', 'QUEUED', 'RATE_LIMITED'] },
        },
      }),
      prisma.emailJob.count({
        where: {
          campaign: { userId },
          status: 'SENT',
        },
      }),
      prisma.emailJob.count({
        where: {
          campaign: { userId },
          status: 'FAILED',
        },
      }),
    ]);

    res.json({
      scheduled,
      sent,
      failed,
      total: scheduled + sent + failed,
    });
  } catch (err) {
    console.error('Get stats error:', (err as Error).message);
    res.status(500).json({ error: 'Failed to fetch email stats' });
  }
}
