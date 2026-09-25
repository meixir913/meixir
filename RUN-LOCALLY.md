# Try the dashboard on your own computer

This runs a private copy of Hire Me ECE on your computer so you can click through everything. Nothing is published, and only you can see it. It takes about 10 minutes the first time.

## 1. Install Node.js (one time)

Go to **[nodejs.org](https://nodejs.org)**, download the **LTS** version for your computer (Mac or Windows) and install it with the default options.

## 2. Download the dashboard

1. Open **[github.com/meixir913/meixir](https://github.com/meixir913/meixir)** and sign in.
2. Click the branch menu (it says **main**) and choose **claude/job-seeker-dashboard-ai-yrv4t0**. Skip this step once the branch has been merged into main.
3. Click the green **Code** button → **Download ZIP**.
4. Unzip it, for example into your **Documents** folder.

## 3. Start it

**On a Mac**
1. Open the **Terminal** app (press ⌘ Space and type "Terminal").
2. Type `cd `, with a space after it. Then drag the unzipped folder onto the Terminal window and press **Enter**.
3. Type `npm install` and press Enter. This takes a minute or two the first time.
4. Type `npm run dev` and press Enter.

**On Windows**
1. Open the unzipped folder in File Explorer.
2. Click the address bar at the top, type `cmd` and press **Enter**. A black Command Prompt window opens in that folder.
3. Type `npm install` and press Enter. This takes a minute or two the first time.
4. Type `npm run dev` and press Enter.

When you see **Ready**, open **[http://localhost:3000](http://localhost:3000)** in Chrome or Edge.

Leave the Terminal or Command Prompt window open while you use the dashboard. To stop it, click that window and press **Ctrl + C**. Next time, you only need `npm run dev`.

## What works in the demo

Without any keys, the dashboard runs in **demo mode**:

| Feature | In demo mode |
|---|---|
| Overview, Applications, Educator Profile, language switcher | Fully working |
| Vacancies and Centres Hiring | Show clearly marked sample jobs and centres. Sharing a Facebook post works. |
| Cover Letter | Walks through all four steps with sample text: resume, centre, alignment map and letter. Word and text resumes can be uploaded. PDF resumes need the AI key. |
| Interview Rehearsal | Robin speaks and listens and asks sample questions, then shows sample feedback |
| Job alerts | You can choose your alert settings. Emails and notifications need the setup below. |

Your data stays in your browser, so it's still there next time you open the dashboard.

## Turn on the real AI (optional)

1. Create an API key at **[console.anthropic.com](https://console.anthropic.com)** and set a small monthly limit under *Limits*.
2. In the dashboard folder, make a copy of the file `.env.example` and name it `.env.local`.
3. Open `.env.local` in a text editor (TextEdit or Notepad). After `ANTHROPIC_API_KEY=`, paste your key, then save.
4. Stop the dashboard (Ctrl + C) and start it again with `npm run dev`.

The "Demo mode" banner disappears. Letters, the alignment map, reading PDF resumes and interview feedback now come from Claude.

## Try job alert notifications (optional)

1. In the Terminal or Command Prompt, run `npx web-push generate-vapid-keys`.
2. Copy the **Public Key** into `.env.local` after `NEXT_PUBLIC_VAPID_PUBLIC_KEY=`, and the **Private Key** after `VAPID_PRIVATE_KEY=`.
3. Restart with `npm run dev`. Open **Vacancies → Get job alerts**, tick **Notifications on this device**, and allow notifications when Chrome asks.

Email alerts need an email-sending service, so they're set up when the site goes live (see [DEPLOY.md](DEPLOY.md)).
