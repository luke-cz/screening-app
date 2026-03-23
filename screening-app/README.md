# Inbound AI Screening for Ashby

A lightweight screening layer that plugs into Ashby. When a candidate applies, the app pulls the resume and job description, generates a rubric, scores the candidate, and moves them to the right stage with a recruiter-friendly summary.

## What it does

- Listens for new applications via Ashby webhooks
- Pulls resume text (PDFs supported)
- Pulls job descriptions from Ashby and generates a rubric automatically
- Scores candidates with consistent, explainable output
- Writes a private note to Ashby and moves the candidate to the correct stage

## How decisions are made

- **Must-haves** are hard requirements (missing any triggers reject)
- **Nice-to-haves** improve the score
- **Dealbreakers** force reject regardless of score

Verdict rules:
- Pass: score >= 70
- Review: score 40–69
- Reject: score < 40 or dealbreaker hit

## Stage mapping

- Pass -> AI Screen
- Review -> Application Review
- Reject -> Archived

## Stack

- Next.js (App Router)
- Anthropic Claude
- Ashby Webhooks + API
- TypeScript

---

## Quick start (local)

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

---

## Ashby setup (short)

1. Create an API key in Ashby with:
   - candidates:read
   - candidates:write
   - jobs:read
2. Create a webhook:
   - URL: https://screening-app-black.vercel.app/api/ashby-webhook
   - Event: applicationSubmitted
   - Secret token -> save as `ASHBY_WEBHOOK_SECRET`
3. Add env vars in Vercel:
   - ANTHROPIC_API_KEY
   - ASHBY_API_KEY
   - ASHBY_WEBHOOK_SECRET
   - ASHBY_JOB_BOARD_NAME=yeifinance

---

## Key endpoints

- `POST /api/ashby-webhook` – inbound applications
- `POST /api/ashby-rescreen` – rescreen latest applicants
- `GET /api/jobs` – list published roles

---

## Notes

- Results and rubrics are currently stored in memory (no DB yet)
- The app relies on Ashby as the system of record
