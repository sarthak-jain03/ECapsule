# ECapsule

ECapsule is a production-grade distributed email scheduling and dispatch service. The platform features an Express API backend backed by MySQL and Redis, a resilient background queue powered by BullMQ, and an interactive React management dashboard.

---


##  Architecture Overview

The system design focuses on high availability, persistence across failures, and strict compliance with delivery constraints (rate limits and concurrency caps).

```
 ┌──────────────────────┐      ┌──────────────────────────────────────────────┐
 │    React Frontend    │ ───▶ │            Express Backend (API)             │
 │  (Vite / Tailwind)   │      │                                              │
 │                      │      │  ┌──────────────┐   ┌──────────────────────┐ │
 │  • Google Login      │      │  │  Scheduler   │   │  Auth (Passport.js)  │ │
 │  • Status Dashboard  │      │  │  Coordinator │   │  Google OAuth + JWT  │ │
 │  • Compose Editor    │      │  └──────┬───────┘   └──────────────────────┘ │
 └──────────────────────┘      └─────────┼────────────────────────────────────┘
                                         │
                             ┌───────────▼───────────┐
                             │     BullMQ Queue      │
                             │  (Redis Job Storage)  │
                             └───────────┬───────────┘
                                         │
               ┌─────────────────────────┼────────────────────────┐
               │                         │                        │
     ┌─────────▼──────────┐    ┌─────────▼──────────┐   ┌─────────▼──────────┐
     │       MySQL        │    │       Redis        │   │   BullMQ Worker    │
     │  (Source of Truth) │    │   (Job State &     │   │ (Concurrency Cap)  │
     │                    │    │   Rate Counters)   │   │                    │
     │ • User Accounts    │    │                    │   │ • Deduplication    │
     │ • Email Campaigns  │    │ • Atomic Counters  │   │ • Rate Throttling  │
     │ • Dispatch Logs    │    │ • State Storage    │   │ • Nodemailer SMTP  │
     └────────────────────┘    └────────────────────┘   └────────────────────┘
```

### 1. Scheduling Engine
When a user schedules an email campaign targeting $N$ recipients, the system computes individual dispatch schedules to spread out sending load:
- **Delay Computation**: For recipient $i$ (where $0 \le i < N$), the target dispatch time is calculated as:
  $$scheduledAt = startTime + i \times delayBetweenEmails$$
- **Prisma Transactions**: The backend saves the `EmailCampaign` metadata and inserts $N$ separate `EmailJob` records into MySQL with `status: 'SCHEDULED'`.
- **BullMQ Delayed Queueing**: Each job is immediately queued in BullMQ (via Redis) with a calculated `delay` parameter (in milliseconds):
  $$delay = \max(0, scheduledAt - Date.now())$$
  BullMQ natively manages the timing of these delayed jobs, removing the need for database-polling cron tasks.

### 2. Dual Persistence & Restart Recovery
A core design goal is ensuring no scheduled email is lost or double-sent during a server crash or database failure.
- **Dual Persistence Strategy**: MySQL represents the relational transactional source of truth, while Redis maintains BullMQ's live job queue state.
- **Recovery Coordinator**: On backend startup, a recovery service performs a reconciliation sweep:
  1. Queries MySQL for all jobs with active/non-final states (`SCHEDULED`, `QUEUED`, `RATE_LIMITED`).
  2. For each job, queries the Redis queue using `emailQueue.getJob(jobId)`.
  3. If a job is missing from Redis (e.g. if Redis lost state or crashed), the service re-queues it in BullMQ using the remaining delay relative to its original `scheduledAt`. Jobs whose dispatch time has already passed are queued with a delay of `0` for immediate dispatch.
- **Idempotency Safeguard**: Each `EmailJob` contains a unique `idempotencyKey` computed as `SHA256(campaignId + recipientEmail)`. Before sending, the worker performs a check against MySQL; if the status is already `SENT`, the dispatch step is skipped.

### 3. Concurrency & Rate Limiting
Delivery flow is controlled at three distinct levels:
- **Worker Concurrency**: The worker pool is configured with a set concurrency level (controlled by `WORKER_CONCURRENCY` in `.env`, defaults to 5), allowing up to 5 sends in parallel.
- **Consecutive Send Delay**: To prevent spam filters from flagging rapid SMTP traffic, a token-bucket rate limiter is applied directly to the BullMQ worker configuration:
  ```typescript
  limiter: { max: 1, duration: env.MIN_DELAY_BETWEEN_EMAILS_MS }
  ```
  This guarantees a minimum duration (e.g. 2000ms) between consecutive delivery operations across the worker nodes.
- **Hourly Sender Rate Limiting**: Hourly limits are enforced per-sender address using an atomic Redis Lua script:
  - **Key Structure**: Redis counters are bound to hourly epoch buckets: `ratelimit:{sender}:{hourEpoch}` where `hourEpoch = Math.floor(Date.now() / 3600000)`.
  - **Lua Execution**: The worker runs a Lua script to increment the sender's bucket counter and set a TTL matching the remainder of the clock hour.
  - **Re-queue on Limit**: If the count exceeds the sender's hourly limit, the script blocks the send. The worker then decrements the counter (so skipped attempts do not consume quota), updates the MySQL job status to `RATE_LIMITED`, and creates a new retry job in BullMQ delayed by the exact milliseconds remaining until the next clock hour.

---

## 🛠 Tech Stack

| Layer | Technologies Used |
|---|---|
| **Backend** | Node.js, Express, TypeScript, Prisma ORM |
| **Database** | MySQL |
| **Cache & Queue** | Redis, BullMQ |
| **Mail Delivery** | Nodemailer, Ethereal SMTP |
| **Authentication** | Passport.js (Google OAuth 2.0), JWT |
| **Frontend** | React 18, Vite, Tailwind CSS v3, Axios |

---

##  Getting Started

### Prerequisites
- Node.js (v18 or higher)
- Docker Desktop

### 1. Spin up Infrastructure
Run the following command in the project root to start MySQL (port 3307) and Redis (port 6379):
```bash
docker-compose up -d
```

### 2. Configure Backend env
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Create your `.env` file:
   ```bash
   cp .env.example .env
   ```
3. Edit `backend/.env` and update the database URL, Google Client credentials, and rate limit settings as required.

### 3. Run Backend Migrations & Start Server
Run the database migrations and generate the client, then start the Express server (which also boots up the BullMQ workers and the startup recovery coordinator):
```bash
# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Start the dev server
npm run dev
```

### 4. Configure & Start Frontend
1. Navigate to the frontend folder:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite dev server:
   ```bash
   npm run dev
   ```
The dashboard will be available at `http://localhost:5173`. API requests are automatically proxied to the backend at `http://localhost:3001`.

---

##  Ethereal Email Sandbox
For local testing without real SMTP accounts, Ethereal Email sandbox is integrated:
- On backend startup, if `SMTP_USER` and `SMTP_PASS` are left empty in `.env`, the server **automatically generates** a temporary Ethereal account.
- Look at the backend terminal logs to see the generated credentials and a link to log in to the sandbox.
- When an email is successfully sent, its details drawer in the dashboard will display a direct **Ethereal Preview URL** where you can view the formatted email body as received.

To use a persistent Ethereal inbox, create an account at [ethereal.email](https://ethereal.email) and define `SMTP_USER` and `SMTP_PASS` in your `.env`.

---

##  Environment Variables

The backend relies on the following configurations in `backend/.env`:

| Key | Default | Description |
|---|---|---|
| `PORT` | `3001` | Express backend port |
| `DATABASE_URL` | - | MySQL connection string (e.g. `mysql://user:pass@localhost:3307/db`) |
| `REDIS_HOST` | `localhost` | Redis server hostname |
| `REDIS_PORT` | `6379` | Redis server port |
| `GOOGLE_CLIENT_ID` | - | Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | - | Client Secret from Google Cloud Console |
| `JWT_SECRET` | - | Key used to sign JWT session cookies |
| `WORKER_CONCURRENCY` | `5` | Maximum parallel jobs processed by a single BullMQ worker |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | `2000` | Minimum throttle delay between consecutive sends (consecutive safety delay) |
| `MAX_EMAILS_PER_HOUR_PER_SENDER`| `100` | Max messages sent by a single email address in one clock hour |

---

##  Feature Implementation Map

### Backend
-  **Queue Coordinator**: Runs BullMQ scheduler handling delayed execution.
-  **Reconciliation Agent**: Self-heals missing Redis queue state using MySQL on restart.
-  **Atomic Rate Limiter**: Fixed-window sender limiters written in Redis Lua script.
-  **SMTP Dispatcher**: Nodemailer backend with integrated Ethereal mock provider.
-  **Google Authentication**: OAuth 2.0 login callback generating signed JWT cookies.
-  **CSV/TXT Parser**: Ingests, validates, and parses uploaded list files.
-  **Idempotency Check**: Unique composite constraints and pre-send MySQL status verifications.

### Frontend
-  **OAuth Landing**: Login view directing to Google Auth.
-  **Status Dashboard**: Separate list views for pending/scheduled campaigns and sent logs.
-  **Real-time Counters**: Sidebar panel showing running stats of job counts.
-  **Campaign Editor**: Email body composition, recipient tag management, and file upload parsing.
-  **Deployment Control**: Interactive inputs for custom send delay intervals and hourly caps.
-  **Inspection Drawer**: Slide-out panel to inspect body contents, dispatch times, error diagnostics, and Ethereal preview links.

---

##  Walkthrough Video
Refer to the demo video below to see the application in action:

https://drive.google.com/file/d/1KvltDsAlcJJ-dwF8tAXV-8foVnzcd07h/view?usp=sharing

![ECapsule Walkthrough Demo](assets/demo.gif)

---

##  Author
### Sarthak Jain
### sarthakjain4452gmail.com
