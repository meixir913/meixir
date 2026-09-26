# Hire Me ECE — Career Dashboard

A career dashboard for early childhood educators in Australia. It's available in English, 简体中文, Tiếng Việt, नेपाली and हिन्दी (language switcher in the sidebar). Cover letters and interviews stay in English, because centres hire in English, but the AI explains its alignment map and interview feedback in the reader's language.

**To try it on your own computer, follow [RUN-LOCALLY.md](RUN-LOCALLY.md).**

It has these parts:

| Area | What it does |
|---|---|
| **Log in / Sign up** | Email-and-password accounts, or **Continue with Google / Facebook**. After signing up, people log in with their new details. Forgot-password emails a reset link. Everything a job seeker saves belongs to their account, so it follows them to any device. |
| **Overview** | New jobs today, pipeline overview, upcoming interviews, profile strength, and interview score trend. |
| **Job Vacancies** | Individual job ads, collected every morning from job boards, large providers' career sites, SEEK / Indeed alert emails and Facebook group posts. Filter by state, job type (Cert III, Diploma, ECT, Room Leader, Director, OSHC), employment type and channel, then save a job to your applications in one click. **Get job alerts** sends a daily email digest and/or instant notifications when new jobs match. See [Job feed](#job-feed-job-vacancies). |
| **Centres Hiring** | Starts from the centres rather than the ads. **Hiring now** lists every approved service in the ACECQA national register whose own website shows open roles (many centres never post on SEEK). **Find a centre** searches the whole register by name, suburb or postcode, shows whether each centre is hiring, and starts a cover letter for it, even one that hasn't advertised. See [Centre scanner](#centre-scanner). |
| **Applications** | Kanban board (Saved → Applied → Interviewing → Offer / Not selected) with drag and drop. Paste a posting and **Auto-fill** pulls out the title, centre, pay, pedagogical approach, requirements and key phrases. |
| **Cover Letter** | Four steps on the left, the letter on the right. (1) **Resume:** choose one of the resumes saved in My Profile, or upload a new one. (2) **Centre and role:** pick a saved job and the centre name, suburb, state, job title, job type and employment fill in. The centre's curriculum, philosophy and programs are then read automatically: from its website (entered, remembered from before, found by the centre scanner, or found with the search API), or from the job ad when there's no website. Pasting a website address reads it straight away. (3) An **alignment map** puts each thing the centre values next to the evidence from your resume, rated strong, partial or gap, and you choose which points to use. (4) The letter is written from those points and shaped by the state (e.g. VEYLDF in Victoria) and job type (e.g. teacher registration for ECTs). It never makes up experience. |
| **Interview Prep** | A face-to-face mock interview with **Robin**, an animated AI hiring lead. Robin reads each question aloud and moves its mouth as it talks. You answer by speaking (the browser turns your speech into text) or by typing, with your own camera on screen like a video call. The questions match the role and the centre's philosophy. At the end you get a score, strengths, things to work on, and a stronger model answer for each question. |
| **My Profile** | A library of resumes (one per kind of role, one marked default). Uploading a resume fills in the profile automatically: name, contact details, qualification, years of experience, certifications, age groups, strengths and philosophy. Anything already typed is kept. Also holds job preferences, which set the Job Vacancies filters and job alerts. |

Each account's profile, resumes, saved jobs, letters and interview history are stored on the server under that account (Upstash Redis in production, the `data/` folder locally) and cached in the browser. Passwords are hashed with scrypt; sessions use an httpOnly cookie.

**To put it online, follow [DEPLOY.md](DEPLOY.md).**

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

## Job feed (Job Vacancies)

The feed is shared by everyone who uses the site. A scheduled job collects new listings every morning (`vercel.json` runs `/api/cron/collect` at 20:00 UTC, which is 6am AEST). Each listing is checked to be an early childhood role, tagged with its state and role level, and de-duplicated, so an ad seen on several channels shows once. Jobs older than 60 days are dropped.

| Channel | How it's collected | To turn it on |
|---|---|---|
| **Job boards** | Official search APIs from [Adzuna](https://developer.adzuna.com), [Jooble](https://jooble.org/api/about) and [Careerjet](https://www.careerjet.com.au/partners/api). They aggregate Australian ads from many sites, including many that also appear on SEEK and Indeed. Each run searches 15 role keywords (Cert III, Diploma, ECT, Room Leader, Educational Leader, Director, cook, kindergarten, OSHC, family day care and more) over several result pages, plus every large provider by name. | Get free keys and set `ADZUNA_APP_ID` + `ADZUNA_APP_KEY`, `JOOBLE_API_KEY` and/or `CAREERJET_AFFID`. Use all three for the widest coverage. |
| **Large providers' career sites** | Every provider in `lib/feed/sources/providers.ts` is read automatically each morning: the collector finds the careers page from the provider's website and reads its jobs from schema.org `JobPosting` data (on the page or on each job page), a public recruitment-system feed (Workable, SmartRecruiters, Lever, Greenhouse), SEEK links, or the page text. Included: Goodstart, G8 Education, Affinity, Guardian, Only About Children, Busy Bees, Nido, C&K, Explorers, Where We Grow, Aspire, Green Leaves, YMCA, Little Zak's, Story House, Oz Education, Inspire, Montessori Academy, Kool Beanz, Young Academics, KU and Camp Australia. | Works out of the box. After the first run, the source list on Job Vacancies shows how many jobs each provider gave, or why it gave none (for example "jobs are on PageUp, which has no public feed"). For those, set a specific `feed` or `careersUrl` for that provider; their ads are still found on the job boards by name. |
| **SEEK & Indeed** | SEEK and Indeed have no public job API and their terms prohibit scraping. Instead, subscribe an inbox to their **job alert emails**. The alerts are forwarded to `/api/ingest/email`, where Claude pulls out each job. LinkedIn and EthicalJobs alerts work the same way. | Set `INBOUND_EMAIL_TOKEN`, point an inbound-email service (Postmark, SendGrid Inbound Parse, Mailgun Routes or Cloudflare Email Workers) at `https://<your-site>/api/ingest/email?token=<INBOUND_EMAIL_TOKEN>`, then create SEEK and Indeed alerts (e.g. "early childhood educator", each state) sent to that address. |
| **Facebook groups** | Facebook closed its Groups API in 2024 and doesn't allow scraping, so jobs from groups are shared by people: paste a post into **Share a job post** on the Vacancies page and Claude turns it into a listing. | Works out of the box. Set `FEED_ADMIN_KEY` if you want only your team to add posts. |

**Imported batches.** Jobs collected another way, for example with Claude's Indeed connector, can be committed as JSON files in `lib/feed/imports/` (see `index.ts` there). They appear in Job Vacancies next to the collected jobs, each linking back to its original ad, until they're older than 60 days. The first batch (`indeed-2026-09-25.json`) has about 440 current ECE jobs from capital cities and about 50 regional centres in every state and territory, including roles at Goodstart, G8, Affinity, Guardian, OAC, Busy Bees, Nido, C&K, Explorers, Story House, YMCA, Little Zak's, Montessori Academy, Kool Beanz and Green Leaves.

**Storage.** On a normal server data is saved under `data/`. Vercel and other serverless hosts can't write files, so connect Upstash Redis there (DEPLOY.md, step 4).

**Running the collector.** On Vercel, set `CRON_SECRET` and the cron in `vercel.json` runs daily. Anywhere else, call it from a crontab:

```bash
0 6 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" https://<your-site>/api/cron/collect
```

Until a channel is connected, the Job Vacancies page shows a few clearly marked sample jobs.

## Centre scanner

Many centres advertise only on their own website. The scanner (`lib/centres/`) covers every approved service in Australia:

1. **Register:** downloads ACECQA's national register (one CSV per state, about 17,000 services) and refreshes it weekly.
2. **Websites:** the register has no website column. With a search API key (`BRAVE_SEARCH_API_KEY` or `GOOGLE_PLACES_API_KEY`) each site is looked up by name and suburb. Without one, the scanner tries the web addresses the centre's name suggests (e.g. `wattlegroveelc.com.au`) and only accepts a site that shows the centre's phone number from the register, or its distinctive name. A provider with three or more services gets one lookup for its main site. Directories, social media and job boards are never taken as a centre's own website.
3. **Careers pages:** each website is checked politely. The scanner respects `robots.txt`, identifies itself as `HireMeECE-CentreScanner`, and uses short timeouts with a few sites at a time. It finds the careers page and reads roles from:
   - schema.org `JobPosting` data
   - public recruitment-system feeds (Workable, Lever, Greenhouse, SmartRecruiters)
   - SEEK links
   - failing those, the page text, read by Claude

   Sites that use other recruitment systems (PageUp, ELMO, Employment Hero, JobAdder and others) are listed with a link. Pages saying "no current vacancies" are recorded as such.
4. **Results:** open roles join Vacancies, and the **Centres Hiring** page lists every centre with roles or a recruitment page.

**Current snapshot (26 September 2026).** All 18,178 approved services were scanned: 2,815 of 7,985 website lookups matched a site by name (1,835 separate websites, since providers share one), 258 centres were hiring, 318 said they had no openings, and 211 roles were added to Job Vacancies with links to each centre's own careers page. A search API key would find many of the ~5,000 websites name matching missed.

**Full scan from your own computer.** `scripts/scan-centres.ts` runs the whole process in one go (a few hours for all ~18,000 services) and saves progress so it can be restarted; `scripts/export-centres.ts` then writes the results to `lib/centres/snapshot.json` (shown on Centres Hiring until the live scanner has data, and used as its starting point) and the roles found to `lib/feed/imports/`:

```bash
npx tsx --conditions=react-server scripts/scan-centres.ts centre-scan
npx tsx --conditions=react-server scripts/export-centres.ts centre-scan
```

Each run does a bounded amount of work (`CENTRE_LOOKUPS_PER_RUN`, `CENTRE_SCANS_PER_RUN`) and is triggered by `/api/cron/centres`. Run it hourly until the first pass is done; DEPLOY.md shows how.

## Matching the Hire Me ECE brand

All colours come from the tokens at the top of `app/globals.css` (`brand` is the primary colour, `leaf` the secondary). Change those values to restyle the whole app, including the robot interviewer.

## How it's built

- **Next.js 16 (App Router) + React 19 + Tailwind CSS 4**, TypeScript.
- **Claude via the official `@anthropic-ai/sdk`** (`lib/claude.ts`):
  - Cover letters and interviewer turns are **streamed** to the browser. The interviewer runs at low effort so replies come back quickly, like a real conversation.
  - Job-posting analysis and interview feedback use **structured outputs** (JSON schema), so the UI always gets well-formed data.
  - **Server-side refusal fallbacks** (`fallbacks: "default"`) are turned on, so if a request is declined it is retried on a fallback model automatically.
- Prompts live in `lib/prompts.ts`, and the ECE vocabulary (philosophies, frameworks, roles) lives in `lib/ece.ts`. Edit these to change the letter style, the kinds of interview questions, or the state frameworks (`lib/jobtypes.ts`).

```
app/
  page.tsx                 Overview
  login/ signup/           Log in and sign up
  forgot-password/ reset-password/
  vacancies/               Job Vacancies: shared daily ECE job feed and job alerts
  centres/                 Centres Hiring: hiring now + find a centre in the register
  applications/            Applications tracker (kanban)
  letters/                 Cover Letter (steps on the left: resume → centre and role → alignment → write; letter on the right)
  interview/               Interview room + feedback
  profile/                 My Profile (resume library, automatic fill from resume)
  api/letter               POST → streamed cover letter
  api/alignment            POST → alignment map (resume vs centre)
  api/auth/*               signup, login, logout, me, forgot, reset
  api/auth/oauth/[provider]  Continue with Google / Facebook (and /callback)
  api/me/data              GET/PUT → the signed-in account's saved work
  api/centre-profile       POST → centre curriculum, philosophy, programs (website URL, centre name or job ad)
  api/centres/search       GET  → search the ACECQA register
  api/resume               POST → read an uploaded resume
  api/alerts               Job alert sign-up, confirm, unsubscribe
  api/analyze-job          POST → structured job facts
  api/interview            POST → streamed interviewer turn
  api/interview/feedback   POST → structured feedback report
  api/feed                 GET  → collected jobs + channel status
  api/feed/submit          POST → add a pasted job post (e.g. Facebook group)
  api/ingest/email         POST → inbound SEEK / Indeed alert emails
  api/cron/collect         GET  → daily collection run
  api/cron/centres         GET  → centre scanner run
  api/centres              GET  → centre scanner results
  centres/                 Centres Hiring page
components/                AppShell, RobotAvatar, JobForm, UI kit
lib/                       Claude client, prompts, demo content, storage, speech hooks
lib/feed/                  Job feed: sources, ECE classifier, de-duplication, storage
lib/centres/               Centre scanner: ACECQA register, website finder, careers page scanner
lib/alerts/                Job alerts: matching, email digest, push notifications
lib/i18n.tsx, lib/messages/  Interface languages
lib/kv.ts                  Storage (Upstash Redis or local files)
lib/rate-limit.ts          Hourly per-visitor limits on the AI features
tests/                     Job feed and centre scanner tests (npm test)
```

## Ideas for next steps
- User accounts and cloud sync (e.g. Supabase or Postgres) so data follows the user across devices.
- Export letters as PDF/DOCX on your own letterhead.
- A realistic talking-head avatar (e.g. HeyGen, D-ID or Tavus) in place of the SVG robot, using the same `/api/interview` conversation.
