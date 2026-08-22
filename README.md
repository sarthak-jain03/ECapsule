# ReachInbox Email Job Scheduler

A **production-grade email scheduling service + dashboard** built with TypeScript, Express, BullMQ, Redis, MySQL, React, and Tailwind CSS.

---

## 🏗 Architecture Overview

```
┌─────────────────────┐     ┌──────────────────────────────────────────────┐
│   React Frontend    │────▶│         Express Backend (API)                │
│  (Vite + Tailwind)  │     │                                              │
│                     │     │  ┌──────────────┐  ┌───────────────────────┐ │
│  • Login (Google)   │     │  │  Scheduler   │  │   Auth (Passport.js)  │ │
│  • Dashboard        │     │  │  Service     │  │   Google OAuth + JWT  │ │
│  • Compose Email    │     │  └──────┬───────┘  └───────────────────────┘ │
│  • Scheduled/Sent   │     │         │                                    │
└─────────────────────┘     └─────────┼────────────────────────────────────┘
                                      │
                          ┌───────────▼──────────────┐
                          │     BullMQ Queue          │
                          │   (Delayed Jobs)          │
                          └───────────┬──────────────┘
                                      │
              ┌───────────────────────┼────────────────────────┐
              │                       │                        │
    ┌─────────▼──────────┐  ┌────────▼─────────┐   ┌─────────▼──────────┐
    │       MySQL         │  │      Redis        │   │   BullMQ Worker    │
    │  (Source of Truth)  │  │  (Job Queue +     │   │  (Concurrency: 5)  │
    │                     │  │   Rate Counters)  │   │                    │
    │  • Users            │  │                   │   │  • Idempotency     │
    │  • EmailCampaigns   │  │  • Job persistence│   │  • Rate limiting   │
    │  • EmailJobs        │  │  • Rate limit     │   │  • Ethereal SMTP   │
    │                     │  │    counters        │   │  • Error handling  │
    └─────────────────────┘  └───────────────────┘   └────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v18+
- **Docker Desktop** (for Redis & PostgreSQL)
- **Google Cloud Console** project with OAuth 2.0 credentials

### 1. Start Infrastructure

```bash
docker-compose up -d
```

This starts MySQL (port 3307) and Redis (port 6379).

### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Copy env and configure
cp .env.example .env
# Edit .env with your Google OAuth credentials

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend runs at `http://localhost:5173`, backend at `http://localhost:3001`.

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services → Credentials**
4. Configure **OAuth Consent Screen** (External, add your email as test user)
5. Create **OAuth 2.0 Client ID** (Web Application)
   - **Authorized redirect URIs**: `http://localhost:3001/auth/google/callback`
6. Copy **Client ID** and **Client Secret** into `backend/.env`

### 5. Ethereal Email

Ethereal credentials are **auto-generated** on first startup. Check the backend console output for the generated credentials and preview URLs.

To use fixed credentials, create an account at [ethereal.email](https://ethereal.email) and set `SMTP_USER` and `SMTP_PASS` in `.env`.

---

## ⚙️ Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend server port |
| `DATABASE_URL` | - | MySQL connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `GOOGLE_CLIENT_ID` | - | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | - | Google OAuth Client Secret |
| `JWT_SECRET` | - | JWT signing secret |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for CORS |
| `WORKER_CONCURRENCY` | `5` | Number of concurrent worker threads |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | `2000` | Minimum 2s delay between email sends |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Per-sender hourly rate limit |

---

## 🔧 How Scheduling Works

### Job Lifecycle

1. **Schedule**: User submits campaign via API → creates `EmailCampaign` + `EmailJob` records in MySQL → adds BullMQ delayed jobs to Redis
2. **Process**: At scheduled time, BullMQ worker picks up the job
3. **Rate Check**: Worker checks per-sender Redis counter (Lua script, atomic)
4. **Send**: If allowed, sends via Ethereal SMTP → updates DB status to `SENT`
5. **Rate Limited**: If limit exceeded, job is re-queued with delay to next hour window

### Delay Calculation

For a campaign with N recipients, starting at `startTime` with `delayBetweenEmails` seconds:
- Recipient 0: `startTime + 0`
- Recipient 1: `startTime + delay`
- Recipient 2: `startTime + 2 * delay`
- ...
- Recipient N: `startTime + N * delay`

---

## 🔒 Persistence & Restart Recovery

### Dual Persistence Strategy

- **MySQL** = Source of truth for all email job state
- **Redis** = BullMQ's internal job store (persists across restarts with `appendonly yes`)

### On Server Restart

1. BullMQ reconnects to Redis → delayed jobs in Redis are automatically picked up
2. Recovery service queries MySQL for `SCHEDULED`/`QUEUED` jobs with future `scheduledAt`
3. For each, checks if a matching BullMQ job exists in Redis
4. If missing (e.g., Redis was also restarted), re-creates the delayed job
5. Past-due jobs are scheduled for immediate processing

### Idempotency

- Each `EmailJob` has a unique `idempotencyKey = SHA256(campaignId + recipientEmail)`
- Before sending, the worker checks DB status — if already `SENT`, it skips
- This prevents duplicate sends even under retry scenarios

---

## 🚦 Rate Limiting & Concurrency

### Worker Concurrency
- Configurable via `WORKER_CONCURRENCY` (default: 5)
- BullMQ processes up to 5 jobs in parallel

### Delay Between Emails
- **Minimum 2 seconds** between consecutive email sends
- Implemented via BullMQ's `limiter: { max: 1, duration: 2000 }`
- Configurable via `MIN_DELAY_BETWEEN_EMAILS_MS`

### Per-Sender Hourly Rate Limiting
- Uses **Redis atomic counters** with Lua scripts for safety across workers
- Key pattern: `ratelimit:{sender}:{hourWindow}`
- `hourWindow = Math.floor(Date.now() / 3600000)` → unique per clock-hour
- TTL auto-expires at end of hour window
- When limit exceeded: job is **re-queued** with delay to next hour (NOT dropped)
- Configurable via `MAX_EMAILS_PER_HOUR_PER_SENDER` (default: 100)

### Under Load (1000+ emails)
- Jobs fan out with incremental delays based on position
- Rate limiter naturally throttles to `MAX_EMAILS_PER_HOUR_PER_SENDER`
- Excess jobs queue up and process in subsequent hour windows
- Order is preserved as much as possible

---

## ✅ Features Implemented

### Backend
- [x] Email scheduling via REST API
- [x] BullMQ delayed jobs (no cron)
- [x] MySQL persistence (Prisma ORM)
- [x] Restart recovery (re-queues missing jobs)
- [x] Idempotency (unique keys, status checks)
- [x] Per-sender hourly rate limiting (Redis Lua scripts)
- [x] Configurable worker concurrency
- [x] Configurable delay between emails
- [x] Ethereal Email (fake SMTP) integration
- [x] Google OAuth authentication
- [x] JWT-based session management
- [x] CSV file parsing for email lists
- [x] Campaign and job tracking

### Frontend
- [x] Google OAuth login page
- [x] Dashboard with Scheduled/Sent tabs
- [x] Email counts in sidebar
- [x] Compose page with rich form
- [x] CSV/text file upload with email parsing
- [x] Email recipient chips with overflow
- [x] Schedule popover with quick options
- [x] Delay and hourly limit configuration
- [x] Email detail slide-out panel
- [x] Loading states
- [x] Empty states
- [x] Auto-refresh (10s intervals)
- [x] Toast notifications
- [x] Responsive design
- [x] Status badges (color-coded)

---

## 📁 Project Structure

```
reachinbox-scheduler/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database models
│   ├── src/
│   │   ├── config/                # DB, Redis, Queue, env config
│   │   ├── controllers/           # Auth + Email route handlers
│   │   ├── middleware/             # JWT auth, error handling
│   │   ├── routes/                # Express routes
│   │   ├── services/              # Business logic
│   │   │   ├── emailService.ts    # Nodemailer + Ethereal
│   │   │   ├── rateLimiterService.ts  # Redis atomic counters
│   │   │   └── schedulerService.ts    # Campaign scheduling + recovery
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── workers/
│   │   │   └── emailWorker.ts     # BullMQ worker
│   │   └── index.ts               # Entry point
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── context/               # React auth context
│   │   ├── pages/                 # Login, Dashboard, Compose
│   │   ├── services/              # API client (Axios)
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── App.tsx                # Routes + providers
│   │   └── main.tsx               # Entry point
│   ├── tailwind.config.js
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Backend | TypeScript, Express.js |
| Queue | BullMQ (Redis-backed) |
| Database | MySQL (Prisma ORM) |
| SMTP | Ethereal Email (Nodemailer) |
| Auth | Google OAuth 2.0 (Passport.js) + JWT |
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS v3 |
| Infra | Docker (Redis + PostgreSQL) |

---

## ⚠️ Assumptions & Trade-offs

1. **Rich Text Editor**: Used a simple textarea with a decorative toolbar instead of a full WYSIWYG editor (e.g., TipTap) for simplicity. The body is sent as-is (HTML or plain text).
2. **Sender Emails**: Hardcoded sender options in the dropdown. In production, these would come from the database.
3. **Rate Limiting Window**: Uses fixed-window hourly rate limiting. A sliding window would be more precise but adds complexity.
4. **Ethereal Credentials**: Auto-generated on startup if not provided. For persistent preview URLs, use fixed credentials from ethereal.email.
5. **Search**: The search bar in the dashboard is decorative. Full-text search would require additional implementation.
