# Hire Me ECE — Job Seeker Dashboard

A dashboard for early childhood educators in Australia who are looking for work. It has these parts:

| Area | What it does |
|---|---|
| **Dashboard** | New jobs today, pipeline overview, upcoming interviews, profile strength, and interview score trend. |
| **ECE Job Feed** | Early childhood jobs collected every morning from job boards, large providers' career sites, SEEK / Indeed alert emails and Facebook group posts. Filter by state, role (Cert III, Diploma, ECT, Room Leader, Director, OSHC) and channel, then save a job to your tracker in one click. See [Job feed](#job-feed). |
| **My Applications** | Kanban board (Saved → Applied → Interviewing → Offer / Not selected) with drag and drop. Paste a posting and **Auto-fill** pulls out the title, centre, pay, pedagogical approach, requirements and key phrases. |
| **Cover Letter AI** | Writes a cover letter for one specific centre from the job description, **the centre's own programs and philosophy** (Reggio, Montessori, bush kinder, emergent curriculum, Aboriginal and Torres Strait Islander perspectives, EYLF and NQS, etc.), and your profile. It streams in live, you can edit it in place, then copy, download or save it. It won't make up experience you don't have. |
| **Interview Prep** | A face-to-face mock interview with **Robin**, an animated AI hiring lead. Robin reads each question aloud and moves its mouth as it talks. You answer by speaking (the browser turns your speech into text) or by typing, with your own camera on screen like a video call. The questions match the role and the centre's philosophy. At the end you get a score, strengths, things to work on, and a stronger model answer for each question. |
| **My Profile** | Your qualification (Cert III, Diploma, ECT), WWCC and teacher registration, first aid and other certifications, age groups, strengths, philosophy and resume. All of the AI features use it. |

Everything a job seeker enters is stored **only in their own browser** (localStorage). The server doesn't keep any user data. It only passes each request on to Claude.

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

With no API key the app runs in **demo mode**: sample letters, a scripted interviewer, sample feedback and sample jobs in the feed. That way you can click through the whole app before connecting Claude.

Optional: set `CLAUDE_MODEL` to use a different Claude model (default `claude-opus-5`).

### Browser support for the interview room
- **Robin's voice** uses the Web Speech API (`speechSynthesis`), which works in all modern browsers. You can pick a different voice on the setup screen.
- **Speaking your answers** uses `SpeechRecognition`, which works in Chrome, Edge and Safari. In Firefox you type your answers instead.
- The camera preview stays on your device. It is never recorded or uploaded.

## Job feed

The feed is shared by everyone who uses the site. A scheduled job collects new listings every morning (`vercel.json` runs `/api/cron/collect` at 20:00 UTC, which is 6am AEST). Each listing is checked to be an early childhood role, tagged with its state and role level, and de-duplicated, so an ad seen on several channels shows once. Jobs older than 30 days are dropped.

| Channel | How it's collected | To turn it on |
|---|---|---|
| **Job boards** | Official search APIs from [Adzuna](https://developer.adzuna.com) and [Jooble](https://jooble.org/api/about). Both aggregate Australian ads from many sites, including many that also appear on SEEK and Indeed. | Get free keys and set `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` and/or `JOOBLE_API_KEY`. |
| **Large providers' career sites** | Reads each provider's job feed directly: RSS, a public applicant-tracking-system feed (Workable, SmartRecruiters, Lever, Greenhouse), or the schema.org `JobPosting` data that career sites add for Google Jobs. | Goodstart, G8, Affinity, Guardian, OAC, Busy Bees, Nido, Young Academics, KU, C&K and Camp Australia are listed in `lib/feed/sources/providers.ts` with `feed: null`. For each one, open its careers page, see which feed it offers, and fill in `feed`. |
| **SEEK & Indeed** | SEEK and Indeed have no public job API and their terms prohibit scraping. Instead, subscribe an inbox to their **job alert emails**. The alerts are forwarded to `/api/ingest/email`, where Claude pulls out each job. LinkedIn and EthicalJobs alerts work the same way. | Set `INBOUND_EMAIL_TOKEN`, point an inbound-email service (Postmark, SendGrid Inbound Parse, Mailgun Routes or Cloudflare Email Workers) at `https://<your-site>/api/ingest/email?token=<INBOUND_EMAIL_TOKEN>`, then create SEEK and Indeed alerts (e.g. "early childhood educator", each state) sent to that address. |
| **Facebook groups** | Facebook closed its Groups API in 2024 and doesn't allow scraping, so jobs from groups are shared by people: paste a post into **Share a job post** on the Job Feed page and Claude turns it into a listing. | Works out of the box. Set `FEED_ADMIN_KEY` if you want only your team to add posts. |

**Storage.** On a normal server the feed is saved to `data/job-feed.json`. Vercel and other serverless hosts can't write files, so there set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (free [Upstash](https://upstash.com) Redis) instead.

**Running the collector.** On Vercel, set `CRON_SECRET` and the cron in `vercel.json` runs daily. Anywhere else, call it from a crontab:

```bash
0 6 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/cron/collect
```

Until a channel is connected, the Job Feed page shows a few clearly marked sample jobs.

## Matching the Hire Me ECE brand

All colours come from the tokens at the top of `app/globals.css` (`brand` is the primary colour, `leaf` the secondary). Change those values to restyle the whole app, including the robot interviewer.

## How it's built

- **Next.js 16 (App Router) + React 19 + Tailwind CSS 4**, TypeScript.
- **Claude via the official `@anthropic-ai/sdk`** (`lib/claude.ts`):
  - Cover letters and interviewer turns are **streamed** to the browser. The interviewer runs at low effort so replies come back quickly, like a real conversation.
  - Job-posting analysis and interview feedback use **structured outputs** (JSON schema), so the UI always gets well-formed data.
  - **Server-side refusal fallbacks** (`fallbacks: "default"`) are turned on, so if a request is declined it is retried on a fallback model automatically.
- Prompts live in `lib/prompts.ts`, and the ECE vocabulary (philosophies, frameworks, roles) lives in `lib/ece.ts`. Edit these to change the letter style, the kinds of interview questions, or the provincial frameworks.

```
app/
  page.tsx                 Dashboard
  job-feed/                Shared daily ECE job feed
  jobs/                    My Applications tracker (kanban)
  cover-letter/            Cover Letter AI
  interview/               Interview room + feedback
  profile/                 Candidate profile
  api/cover-letter         POST → streamed letter
  api/analyze-job          POST → structured job facts
  api/interview            POST → streamed interviewer turn
  api/interview/feedback   POST → structured feedback report
  api/feed                 GET  → collected jobs + channel status
  api/feed/submit          POST → add a pasted job post (e.g. Facebook group)
  api/ingest/email         POST → inbound SEEK / Indeed alert emails
  api/cron/collect         GET  → daily collection run
components/                AppShell, RobotAvatar, JobForm, UI kit
lib/                       Claude client, prompts, demo content, storage, speech hooks
lib/feed/                  Job feed: sources, ECE classifier, de-duplication, storage
tests/                     Job feed tests (npm test)
```

## Ideas for next steps
- User accounts and cloud sync (e.g. Supabase or Postgres) so data follows the user across devices.
- Export letters as PDF/DOCX on your own letterhead.
- A realistic talking-head avatar (e.g. HeyGen, D-ID or Tavus) in place of the SVG robot, using the same `/api/interview` conversation.
