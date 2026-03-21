# Inbound Auto-Screening

AI-powered candidate screening with Ashby integration.

## Stack

- **Next.js 14** (App Router)
- **Anthropic Claude** - scoring engine
- **Ashby** - ATS integration via webhook
- **TypeScript**

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
|   |-- rubrics.ts           # Per-role rubric store
|   |-- results.ts           # Results store
|   `-- webhookStatus.ts     # Webhook status + counters
`-- types/
    `-- index.ts             # Shared types
```

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

Open [http://localhost:3000](http://localhost:3000)

---

## Ashby integration setup

### 1. Get your API key
In Ashby: **Settings -> Integrations -> API Keys** -> create a key with:
- `application:read`
- `application:write`
- `jobs:read` (to pull job descriptions automatically)

### 2. Register the webhook
In Ashby: **Settings -> Integrations -> Webhooks** -> add:
- URL: `https://screening-app-black.vercel.app/api/ashby-webhook`
- Event: `applicationSubmitted` (keep `applicationCreated` checked if you already use it)
- Copy the signing secret -> set as `ASHBY_WEBHOOK_SECRET`

### 3. Test with ngrok (local dev)
```bash
ngrok http 3000
# Use the ngrok URL as your webhook endpoint in Ashby
```

### What happens on a new inbound
1. Ashby fires `applicationSubmitted` to `/api/ashby-webhook`
2. Webhook verifies HMAC signature
3. Resume text is fetched from Ashby
4. Job description is pulled from Ashby (via Jobs API or the public job board)
5. Rubric is looked up by `jobId` (auto-created if unknown)
6. If rubric is empty, it is auto-generated from the job description
7. Claude scores the candidate (0-100, 4 dimensions)
8. Result is saved locally
9. Verdict + score pushed back to Ashby as a private note + stage change:
   - **Pass** -> moves to "Recruiter Screen"
   - **Review** -> moves to "Application Review"
   - **Reject** -> moves to "Archived"

### Job descriptions
Set `ASHBY_JOB_BOARD_NAME` to your Ashby jobs page name (from `https://jobs.ashbyhq.com/<name>`).
If set, the app pulls `descriptionPlain` from the public job board API. It also tries the Ashby Jobs API as a fallback.

---

## Per-role rubrics

Edit `src/lib/rubrics.ts` to add rubrics for your roles:

```ts
const DEFAULT_RUBRICS: Record<string, Rubric> = {
  "ashby-job-id-here": {
    jobId: "ashby-job-id-here",
    jobTitle: "Senior Frontend Engineer",
    criteria: {
      mustHaves: ["5+ years React", "TypeScript", "Team leadership"],
      niceToHaves: ["Next.js", "GraphQL"],
      dealbreakers: ["Requires visa sponsorship"],
    },
    passThreshold: 70,
    reviewThreshold: 40,
  },
};
```

**Production**: replace the in-memory store with a DB (Postgres, Supabase, etc.) - the interface is the same.

---

## API reference

### `POST /api/screen`
Manual screening endpoint.

```json
{
  "candidate": {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "jobId": "my-job-id",
    "jobTitle": "Senior Frontend Engineer",
    "resumeText": "..."
  },
  "rubric": {
    "mustHaves": ["5+ years React"],
    "niceToHaves": ["GraphQL"],
    "dealbreakers": []
  }
}
```

Response:
```json
{
  "success": true,
  "result": {
    "overallScore": 82,
    "verdict": "pass",
    "dealbreakerHit": false,
    "dimensions": [],
    "summary": "...",
    "rejectionReason": null
  }
}
```

### `GET /api/results`
Returns all screening results (newest first).

### `GET /api/webhook-status`
Returns latest webhook activity and counts.

### `POST /api/ashby-webhook`
Ashby webhook endpoint - not meant to be called manually.

---

## Productionising checklist

- [ ] Replace in-memory stores (`rubrics.ts`, `results.ts`) with a real DB
- [ ] Add PDF parsing for resume extraction (add `pdf-parse`)
- [ ] Add auth to the dashboard
- [ ] Add email notifications on new Pass candidates (Resend/Postmark)
- [ ] Add retry logic for Ashby API calls
- [ ] Deploy to Vercel / Railway / Fly.io
- [ ] Set `ASHBY_WEBHOOK_SECRET` in production env
