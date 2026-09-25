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
| Adzuna app ID + key | More jobs in the job feed | [developer.adzuna.com](https://developer.adzuna.com) → *Register* | Optional |
| Jooble key | More jobs in the job feed | [jooble.org/api/about](https://jooble.org/api/about) | Optional |

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
   - optional: `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `JOOBLE_API_KEY`
5. Click **Deploy**. After a minute or two you'll get an address like `hire-me-ece.vercel.app`.

## 4. Add storage

The job feed and centre scanner need somewhere to keep their data.

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
- **06:00 AEST**: collects the job feed.
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

## Privacy

Job seekers' profiles, saved jobs, letters and interview history are stored **only in their own browser**. They're sent to the AI only when someone generates a letter or feedback, and they're not kept on the server. The camera preview in Interview Prep never leaves the device. You may want to say this in your site's privacy policy.
