# Try the dashboard on your own computer

This runs a private copy of Hire Me ECE on your computer so you can click through everything. Nothing is published, and only you can see it. It takes about 10 minutes the first time.

## 1. Install Node.js (one time)

Go to **[nodejs.org](https://nodejs.org)**, download the **LTS** version for your computer (Mac or Windows) and install it with the default options.

## 2. Download the dashboard

1. Open **[github.com/meixir913/meixir](https://github.com/meixir913/meixir)** and sign in.
2. Click the branch menu (it says **main**) and choose **claude/job-seeker-dashboard-ai-yrv4t0**. Skip this step once the branch has been merged into main.
3. Click the green **Code** button → **Download ZIP**. It saves as `meixir-claude-job-seeker-dashboard-ai-yrv4t0.zip` in **Downloads**.

## 3. Start it

**On a Mac**, open the **Terminal** app (press ⌘ Space and type "Terminal") and paste these lines one at a time, pressing **Enter** after each:

```bash
cd ~/Downloads
unzip -o meixir-claude-job-seeker-dashboard-ai-yrv4t0.zip
cd meixir-claude-job-seeker-dashboard-ai-yrv4t0
npm install
npm run dev
```

> **"cd: not a directory"?** You typed `cd` with the **.zip** file. `cd` only works on the unzipped **folder**, which has the same name without `.zip`. The `unzip` line above creates that folder. (Safari sometimes unzips downloads for you, and the `unzip` line then just refreshes the folder.)
>
> **"npm error enoent … package.json"?** npm ran outside the dashboard folder. Run the `cd meixir-claude-job-seeker-dashboard-ai-yrv4t0` line again, then `npm install`.

**On Windows**
1. Right-click the downloaded zip → **Extract All** → **Extract**.
2. Open the extracted folder (the one that contains `package.json`).
3. Click the address bar at the top, type `cmd` and press **Enter**. A black Command Prompt window opens in that folder.
4. Type `npm install` and press Enter. This takes a minute or two the first time.
5. Type `npm run dev` and press Enter.

When you see **Ready**, open **[http://localhost:3000](http://localhost:3000)** in Chrome or Edge.

Leave the Terminal or Command Prompt window open while you use the dashboard. To stop it, click that window and press **Ctrl + C**. Next time, open Terminal and run just `cd ~/Downloads/meixir-claude-job-seeker-dashboard-ai-yrv4t0` and `npm run dev`.

## 4. Create your account

The dashboard opens on the **Log in** page. Click **Create a free account**, enter any name, email and password (at least 8 characters), and you're in. You'll land on **My Profile**, where you upload a resume and the profile fills itself in.

Accounts on your computer are stored in the `data` folder inside the dashboard folder. Forgot the password? Use **Forgot your password?**: while running locally no email is sent. Instead, the reset link appears in the Terminal window. Copy it into your browser.

## What works in the demo

Without any keys, the dashboard runs in **demo mode**:

| Feature | In demo mode |
|---|---|
| Log in / sign up, Overview, Applications, language switcher | Fully working |
| My Profile | Fully working. Uploading a Word or text resume fills in your profile using simple pattern matching. PDF resumes need the AI key. |
| Job Vacancies and Centres Hiring | Show clearly marked sample jobs and centres. **Find a centre** searches a small sample register (try "Parramatta" or "3186"). Sharing a Facebook post works. |
| Cover Letter | All four steps work: choose a resume, pick a saved job (centre details are pulled from the job ad), see the alignment, get a sample letter. Reading a centre's website works but gives rougher results without the AI key. |
| Interview Prep | Robin speaks and listens and asks sample questions, then shows sample feedback |
| Job alerts | You can choose your alert settings. Emails and notifications need the setup below. |

Your work is saved to your account, so it's still there next time you log in, from any browser.

## Turn on the real AI (optional)

1. Create an API key at **[console.anthropic.com](https://console.anthropic.com)** and set a small monthly limit under *Limits*.
2. In the dashboard folder, make a copy of the file `.env.example` and name it `.env.local`.
3. Open `.env.local` in a text editor (TextEdit or Notepad). After `ANTHROPIC_API_KEY=`, paste your key, then save.
4. Stop the dashboard (Ctrl + C) and start it again with `npm run dev`.

The "Demo mode" banner disappears. Letters, the alignment map, reading PDF resumes and interview feedback now come from Claude.

## Try job alert notifications (optional)

1. In the Terminal or Command Prompt, run `npx web-push generate-vapid-keys`.
2. Copy the **Public Key** into `.env.local` after `NEXT_PUBLIC_VAPID_PUBLIC_KEY=`, and the **Private Key** after `VAPID_PRIVATE_KEY=`.
3. Restart with `npm run dev`. Open **Job Vacancies → Get job alerts**, tick **Notifications on this device**, and allow notifications when Chrome asks.

Email alerts need an email-sending service, so they're set up when the site goes live (see [DEPLOY.md](DEPLOY.md)).
