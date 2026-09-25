# Putting Hire Me ECE online

This guide takes the dashboard from GitHub to a live website such as **app.hiremeece.au**, which you can link to from hiremeece.au. It takes about 30–45 minutes. You don't need to write any code.

The site is hosted on **Vercel**, made by the company behind Next.js, the framework the dashboard uses.

---

## 1. Collect your keys

Keep these in a note while you work. Treat each one like a password.

| Key | What it's for | Where to get it | Needed? |
|---|---|---|---|
| **Anthropic API key** | The AI: cover letters, Robin the interviewer, feedback, reading job posts | [console.anthropic.com](https://console.anthropic.com) → *API Keys* → *Create Key*. Add a payment method and, under *Limits*, set a monthly spend limit. | Yes |
| **Brave Search API key** | Finding each centre's website for the Centres Hiring scanner | [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com) → subscribe to a *Search* plan → *API Keys* | Yes, for the centre scanner |
| **Cron secret** | Stops strangers from triggering the scheduled jobs | Make up a long random password, e.g. from a password manager | Yes |
| Adzuna app ID + key | More jobs in Job Vacancies | [developer.adzuna.com](https://developer.adzuna.com) → *Register* | Optional |
| Jooble key | More jobs in Job Vacancies | [jooble.org/api/about](https://jooble.org/api/about) | Optional |
| **Resend API key** | Sending the daily job alert emails | [resend.com](https://resend.com) → add and verify the domain **hiremeece.au** (it gives you DNS records to add) → *API Keys* | For email alerts |
| **Notification keys** | Pop-up job alerts on phones and computers | On your computer, run `npx web-push generate-vapid-keys` (see RUN-LOCALLY.md) and keep both keys | For notifications |

Google Places works instead of Brave for finding websites (`GOOGLE_PLACES_API_KEY`), and is often more accurate for local businesses.

## 2. Move the code to the main branch

The dashboard is on the branch `claude/job-seeker-dashboard-ai-yrv4t0`. Vercel publishes the **main** branch as your live site, so:

1. On GitHub, open **meixir913/meixir** → *Pull requests* → *New pull request*.
2. Choose base **main** and compare **claude/job-seeker-dashboard-ai-yrv4t0** → *Create pull request* → *Merge pull request*.

(Or ask Claude to open the pull request for you.)

## 3. Create the Vercel project

1. Go to [vercel.com/signup](https://vercel.com/signup) and choose **Continue with GitHub**.
2. Choose a plan. **Hobby is free but only for personal, non-commercial use.** Since this is part of your business, choose **Pro** (US$20/month at the time of writing).
3. Click **Add New… → Project**, find **meixir913/meixir**, and click **Import**. If it's not listed, click *Adjust GitHub App Permissions* and give Vercel access to that repository.
4. Leave the framework as **Next.js**. Open **Environment Variables** and add:
   - `ANTHROPIC_API_KEY`: your Anthropic key
   - `CRON_SECRET`: your made-up secret
   - `BRAVE_SEARCH_API_KEY`: your Brave key
   - `APP_URL`: `https://app.hiremeece.au`
   - `RESEND_API_KEY`, and `ALERTS_FROM_EMAIL` set to `Hire Me ECE <alerts@hiremeece.au>`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` set to `mailto:` followed by your email
   - optional: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`
5. Click **Deploy**. After a minute or two you'll get an address like `hire-me-ece.vercel.app`.

## 4. Add storage

Accounts, each job seeker's saved work, the job feed and the centre scanner all need somewhere to keep their data. Don't skip this step: without it, sign-ups are lost whenever Vercel restarts the site.

1. In your Vercel project, open the **Storage** tab → **Create** → **Upstash for Redis** (from the Marketplace) → choose the free plan and the **Sydney** region → **Connect** to this project.
2. Vercel adds the storage keys for you (`KV_REST_API_URL` and `KV_REST_API_TOKEN`).
3. Go to **Deployments** → the latest one → **⋯ → Redeploy** so the site picks up the storage.

## 5. Use your own address

1. In the Vercel project: **Settings → Domains → Add** → type `app.hiremeece.au`.
2. Vercel shows a **CNAME** record, usually `cname.vercel-dns.com`.
3. Log in to wherever hiremeece.au's DNS is managed (your domain registrar or website builder). Add a **CNAME** record with name **app** and the value Vercel showed.
4. Wait a few minutes until Vercel shows a green tick. HTTPS is set up automatically.
5. On hiremeece.au, add a button or menu link such as **Career Dashboard** pointing to `https://app.hiremeece.au`.

## 6. Scheduled jobs

`vercel.json` already runs two jobs every day:
- **06:00 AEST**: collects the job feed, sends instant notifications for new matches, and sends each subscriber's daily email digest.
- **07:30 AEST**: runs the centre scanner.

The first full pass of the centre scanner works through about 9,000 website lookups. At one run a day that takes weeks. To finish in a couple of days, run the scanner every hour for free with [cron-job.org](https://cron-job.org):

1. Create a free account → **Create cronjob**.
2. URL: `https://app.hiremeece.au/api/cron/centres`. Schedule: **every hour**.
3. Under **Advanced → Headers**, add `Authorization` with the value `Bearer YOUR_CRON_SECRET`.
4. Save. The *Centres Hiring* page shows progress.

After the first pass, the daily run is enough. It refreshes the ACECQA register weekly and re-checks websites every few days.

## 7. Check it works

- Open `https://app.hiremeece.au`. If there's no banner saying *Demo mode*, the Anthropic key is working.
- **Cover Letter AI**: generate a letter.
- **Accounts**: sign up, log out, and log back in. Try **Forgot your password?** once email is set up (the reset email is sent through Resend, like job alerts).
- **Interview Prep**: start a quick interview. Use Chrome or Edge if you want to answer by speaking.
- **Centres Hiring**: after the first scanner run, the counts start going up.

## What it costs

| Service | Cost |
|---|---|
| Vercel Pro | about US$20/month |
| Anthropic API | pay per use. A cover letter or a full mock interview typically costs a few cents to a few tens of cents. Set a monthly limit in the console. |
| Brave Search | about US$5 per 1,000 lookups: roughly US$45–85 for the first full pass, then only new centres |
| Upstash Redis | free plan is enough to start |
| cron-job.org | free |

Each visitor is limited per hour on the AI features, so the site can't be used to run up your bill. The limits are in `lib/rate-limit.ts` and can be changed with environment variables such as `RATE_LIMIT_COVER_LETTER=40`.

## Job alerts

Candidates click **Get job alerts** (on Overview or Job Vacancies) and choose states, job types, employment type and optional suburbs or keywords. They can then get:
- **A daily email** like SEEK's. They must confirm their address first, and every email has a one-click unsubscribe link, as Australia's Spam Act requires.
- **Instant notifications** on their phone or computer. On iPhone, they first add the site to the Home Screen (Share → Add to Home Screen).

## Privacy

Each job seeker's account (name, email, hashed password) and saved work (profile, resumes, saved jobs, letters and interview history) are stored in your Upstash database so they can log in from any device. Job alert sign-ups keep an email address and alert preferences, or a device's notification address, until the person unsubscribes. Resumes and centre details are sent to the AI only when someone generates a letter, alignment map or feedback. The camera preview in Interview Prep never leaves the device. You may want to say this in your site's privacy policy.
