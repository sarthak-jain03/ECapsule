export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface EmailJob {
  id: string;
  recipientEmail: string;
  subject: string;
  senderEmail: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'RATE_LIMITED';
  etherealPreviewUrl?: string | null;
  errorMessage?: string | null;
  campaignId: string;
}

export interface EmailStats {
  scheduled: number;
  sent: number;
  failed: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ScheduleEmailPayload {
  recipients: string[];
  subject: string;
  body: string;
  senderEmail: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface CsvParseResponse {
  emails: string[];
  count: number;
}
