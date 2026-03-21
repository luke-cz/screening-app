# Inbound Auto-Screening for Ashby

This project is a lightweight AI screening layer that plugs into Ashby. When a candidate applies, Ashby sends a webhook to this app, the resume is analyzed against the role, and the candidate is routed to the right stage with a short, recruiter-friendly summary.

## What it does

- Listens for new inbound applications from Ashby
- Pulls the resume and job description automatically
- Generates a rubric from the job description the first time a role appears
- Screens the candidate with consistent scoring and evidence
- Writes a private note back to Ashby and moves the candidate to the right stage

## How it decides

- **Must-haves** are enforced as hard requirements
- **Nice-to-haves** improve the score but are not required
- **Dealbreakers** force a reject even if scores are high

Verdict rules:
- Pass: score >= 70
- Review: score 40-69
- Reject: score < 40 or dealbreaker hit

## Stage mapping in Ashby

- **Pass** -> AI Screen
- **Review** -> Application Review
- **Reject** -> Archived

## Stack

- Next.js 14 (App Router)
- Anthropic Claude (screening engine)
- Ashby Webhooks + API
- TypeScript

---

## Quick start

```bash
# 1. Install
npm install

# 2. Set env vars
cp .env.local.example .env.local
# -> Fill in ANTHROPIC_API_KEY, ASHBY_API_KEY, ASHBY_WEBHOOK_SECRET, ASHBY_JOB_BOARD_NAME

# 3. Dev
npm run dev
```

Open http://localhost:3000

---

## Ashby setup

### 1. Create an API key
Ashby -> Settings -> Integrations -> API Keys

Required permissions:
- candidates:read (applications + resumes)
- candidates:write (notes + stage changes)
- jobs:read (to pull job descriptions)

### 2. Register the webhook
Ashby -> Settings -> Integrations -> Webhooks -> Add

Use:
- URL: https://screening-app-black.vercel.app/api/ashby-webhook
- Event: applicationSubmitted
- Secret token: generate one and set it in Vercel as `ASHBY_WEBHOOK_SECRET`

### 3. Environment variables (Vercel)
- ANTHROPIC_API_KEY
- ASHBY_API_KEY
- ASHBY_WEBHOOK_SECRET
- ASHBY_JOB_BOARD_NAME = yeifinance

---

## How it works (technical)

1. Ashby fires `applicationSubmitted` to `/api/ashby-webhook`
2. Webhook verifies HMAC signature
3. Resume text is fetched from Ashby
4. Job description is pulled from Ashby (public job board or Jobs API)
5. If no rubric exists yet, one is generated from the job description
6. Claude scores the candidate (0-100 with 4 dimensions)
7. Result is saved and pushed back to Ashby as a private note + stage move

---

## Project structure

```
src/
|-- app/
|   |-- api/
|   |   |-- screen/          # POST /api/screen - manual screening
|   |   |-- ashby-webhook/   # POST /api/ashby-webhook - Ashby inbound
|   |   |-- webhook-status/  # GET /api/webhook-status - last webhook stats
|   |   `-- results/         # GET /api/results - fetch all results
|   |-- page.tsx             # Dashboard UI
|   `-- globals.css
|-- lib/
|   |-- screener.ts          # AI scoring engine (Claude)
|   |-- ashby.ts             # Ashby API + webhook verification
|   |-- rubricGenerator.ts   # Auto-rubric from job descriptions
|   |-- rubrics.ts           # Per-role rubric store
|   |-- results.ts           # Results store
|   `-- webhookStatus.ts     # Webhook status + counters
`-- types/
    `-- index.ts             # Shared types
```

---

## Notes

- The current data store is in-memory for speed. For production, swap in a database.
- Idempotency is in-memory. For scale, store processed application IDs in a DB.

---

## API endpoints

- `POST /api/screen` - manual screening (UI)
- `POST /api/ashby-webhook` - Ashby inbound webhook
- `POST /api/ashby-rescreen` - rescreen latest Ashby applicants
- `GET /api/results` - list screening results
- `GET /api/webhook-status` - recent webhook activity

---

## Roadmap

- Persistent DB (rubrics + results)
- PDF parsing for resume extraction
- Auth gate for dashboard
- Notifications for Pass candidates
