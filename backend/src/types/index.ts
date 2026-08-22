export interface EmailJobData {
  jobId: string;
  campaignId: string;
  recipientEmail: string;
  senderEmail: string;
  subject: string;
  body: string;
  idempotencyKey: string;
  hourlyLimit: number;
}

export interface ScheduleEmailRequest {
  recipients: string[];
  subject: string;
  body: string;
  senderEmail: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface EmailJobResponse {
  id: string;
  recipientEmail: string;
  subject: string;
  senderEmail: string;
  scheduledAt: string;
  sentAt: string | null;
  status: string;
  etherealPreviewUrl: string | null;
  errorMessage: string | null;
}

export interface CampaignResponse {
  id: string;
  subject: string;
  body: string;
  senderEmail: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface UserPayload {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
  retryAfterMs?: number;
}
