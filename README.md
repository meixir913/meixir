# Hire Me ECE — Job Seeker Dashboard

A dashboard for Early Childhood Educators looking for work. It has four parts:

| Area | What it does |
|---|---|
| **Dashboard** | Pipeline overview, upcoming interviews, profile strength, and interview score trend. |
| **Job Tracker** | Kanban board (Saved → Applied → Interviewing → Offer / Not selected) with drag and drop. Paste a posting and **Auto-fill** pulls out the title, centre, pay, pedagogical approach, requirements and key phrases. |
| **Cover Letter AI** | Writes a cover letter for one specific centre from the job description, **the centre's own programs and philosophy** (Reggio, Montessori, forest school, emergent curriculum, etc.), and your profile. It streams in live, you can edit it in place, then copy, download or save it. It won't make up experience you don't have. |
| **Interview Prep** | A face-to-face mock interview with **Robin**, an animated AI hiring lead. Robin reads each question aloud and moves its mouth as it talks. You answer by speaking (the browser turns your speech into text) or by typing, with your own camera on screen like a video call. The questions match the role and the centre's philosophy. At the end you get a score, strengths, things to work on, and a stronger model answer for each question. |
| **My Profile** | Your credentials (RECE and registration number), certifications, age groups, strengths, philosophy and resume. All of the AI features use it. |

Everything a job seeker enters is stored **only in their own browser** (localStorage). The server doesn't keep any user data. It only passes each request on to Claude.

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

With no API key the app runs in **demo mode**: sample letters, a scripted interviewer and sample feedback. That way you can click through the whole app before connecting Claude.

Optional: set `CLAUDE_MODEL` to use a different Claude model (default `claude-opus-5`).

### Browser support for the interview room
- **Robin's voice** uses the Web Speech API (`speechSynthesis`), which works in all modern browsers. You can pick a different voice on the setup screen.
- **Speaking your answers** uses `SpeechRecognition`, which works in Chrome, Edge and Safari. In Firefox you type your answers instead.
- The camera preview stays on your device. It is never recorded or uploaded.

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
  jobs/                    Job tracker (kanban)
  cover-letter/            Cover Letter AI
  interview/               Interview room + feedback
  profile/                 Candidate profile
  api/cover-letter         POST → streamed letter
  api/analyze-job          POST → structured job facts
  api/interview            POST → streamed interviewer turn
  api/interview/feedback   POST → structured feedback report
components/                AppShell, RobotAvatar, JobForm, UI kit
lib/                       Claude client, prompts, demo content, storage, speech hooks
```

## Ideas for next steps
- User accounts and cloud sync (e.g. Supabase or Postgres) so data follows the user across devices.
- Export letters as PDF/DOCX on your own letterhead.
- Import jobs straight from job boards.
- A realistic talking-head avatar (e.g. HeyGen, D-ID or Tavus) in place of the SVG robot, using the same `/api/interview` conversation.
