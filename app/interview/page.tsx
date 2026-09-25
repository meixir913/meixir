"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Captions,
  Keyboard,
  Mic,
  MicOff,
  PhoneOff,
  Play,
  RotateCcw,
  Send,
  Star,
  Video,
  Volume2,
  VolumeX,
} from "lucide-react";
import RobotAvatar, { type AvatarState } from "@/components/RobotAvatar";
import { Button, Card, ChipToggle, Field, Input, PageHeader, Select, Textarea, readTextStream } from "@/components/ui";
import { INTERVIEW_FOCUS, PHILOSOPHIES, ROLES } from "@/lib/ece";
import type { InterviewSetup } from "@/lib/prompts";
import { useListener, useSpeaker, useVoices } from "@/lib/speech";
import { uid, useInterviews, useJobs, useProfile } from "@/lib/storage";
import type { InterviewFeedback, InterviewTurn } from "@/lib/types";

type Phase = "setup" | "live" | "feedback";

export default function InterviewPage() {
  return (
    <Suspense>
      <InterviewStudio />
    </Suspense>
  );
}

function InterviewStudio() {
  const params = useSearchParams();
  const [profile, , profileLoaded] = useProfile();
  const [jobs, , jobsLoaded] = useJobs();
  const [history, setHistory] = useInterviews();
  const voices = useVoices();

  const [phase, setPhase] = useState<Phase>("setup");
  const [jobId, setJobId] = useState("");
  const [setup, setSetup] = useState<InterviewSetup>({
    role: ROLES[0],
    centre: "",
    centreInfo: "",
    jobDescription: "",
    philosophies: [],
    focus: INTERVIEW_FOCUS[0].label,
    questionCount: 5,
    candidateName: "",
    interviewerName: "Robin",
  });
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceName, setVoiceName] = useState("");
  const [answerMode, setAnswerMode] = useState<"voice" | "type">("voice");
  const [cameraOn, setCameraOn] = useState(true);
  const [showCaptions, setShowCaptions] = useState(true);

  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [liveLine, setLiveLine] = useState("");
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [ended, setEnded] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [answerSeconds, setAnswerSeconds] = useState(0);

  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);

  const speaker = useSpeaker(voiceName, voiceOn);
  const listener = useListener(setDraft);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoListenedFor = useRef(-1);
  const sessionId = useRef("");

  useEffect(() => {
    if (profileLoaded && profile.name) setSetup((s) => ({ ...s, candidateName: s.candidateName || profile.name }));
  }, [profileLoaded, profile.name]);

  useEffect(() => {
    if (!voiceName && voices.length) {
      const preferred = voices.find((v) => /female|samantha|jenny|aria|google uk english female|natural/i.test(v.name)) ?? voices[0];
      setVoiceName(preferred.name);
    }
  }, [voices, voiceName]);

  const pickJob = useCallback(
    (id: string) => {
      setJobId(id);
      const j = jobs.find((x) => x.id === id);
      if (j)
        setSetup((s) => ({
          ...s,
          role: j.title || s.role,
          centre: j.centre,
          centreInfo: j.centreInfo,
          jobDescription: j.description,
          philosophies: j.philosophies,
        }));
    },
    [jobs],
  );

  useEffect(() => {
    const id = params.get("job");
    if (jobsLoaded && id && jobs.some((j) => j.id === id)) pickJob(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsLoaded]);

  // ---------------------------------------------------------------- camera
  useEffect(() => {
    if (phase !== "live" || !cameraOn) return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraOn(false));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [phase, cameraOn]);

  // ---------------------------------------------------------------- interviewer turns
  const askNext = useCallback(
    async (history: InterviewTurn[]) => {
      setThinking(true);
      setError("");
      setLiveLine("");
      speaker.reset();
      try {
        const res = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ setup, turns: history }),
        });
        setStreaming(true);
        const full = await readTextStream(res, (text) => {
          setThinking(false);
          setLiveLine(text.replace("[END]", "").trim());
          speaker.feed(text);
        });
        speaker.feed(full, true);
        const clean = full.replace("[END]", "").trim();
        setTurns([...history, { role: "interviewer", text: clean }]);
        if (full.includes("[END]")) setEnded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The interviewer lost connection.");
      } finally {
        setThinking(false);
        setStreaming(false);
      }
    },
    [setup, speaker],
  );

  function start() {
    sessionId.current = uid();
    setTurns([]);
    setEnded(false);
    setFeedback(null);
    setDraft("");
    autoListenedFor.current = -1;
    setPhase("live");
    askNext([]);
  }

  function submitAnswer() {
    const text = draft.trim();
    if (!text || thinking || streaming) return;
    listener.stop();
    speaker.stop();
    const next: InterviewTurn[] = [...turns, { role: "candidate", text }];
    setTurns(next);
    setDraft("");
    askNext(next);
  }

  const busy = thinking || streaming || speaker.speaking;
  const awaitingAnswer = phase === "live" && !ended && !busy && turns.at(-1)?.role === "interviewer";

  // Open the mic automatically once the question has been asked.
  useEffect(() => {
    if (awaitingAnswer && answerMode === "voice" && listener.supported && autoListenedFor.current !== turns.length) {
      autoListenedFor.current = turns.length;
      listener.start(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awaitingAnswer, answerMode, listener.supported, turns.length]);

  // Answer timer.
  useEffect(() => {
    if (!awaitingAnswer) return setAnswerSeconds(0);
    const t = setInterval(() => setAnswerSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [awaitingAnswer]);

  // ---------------------------------------------------------------- feedback
  async function finish(finalTurns = turns) {
    listener.stop();
    speaker.stop();
    setPhase("feedback");
    setFeedbackLoading(true);
    setError("");
    const session = {
      id: sessionId.current || uid(),
      jobId: jobId || null,
      role: setup.role,
      centre: setup.centre,
      turns: finalTurns,
      feedback: null as InterviewFeedback | null,
      createdAt: new Date().toISOString(),
    };
    try {
      const res = await fetch("/api/interview/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setup, turns: finalTurns }),
      });
      const data = (await res.json()) as InterviewFeedback & { error?: string };
      if (data.error) throw new Error(data.error);
      setFeedback(data);
      session.feedback = data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate feedback.");
    } finally {
      setFeedbackLoading(false);
      if (finalTurns.some((t) => t.role === "candidate")) setHistory((all) => [session, ...all.filter((s) => s.id !== session.id)].slice(0, 30));
    }
  }

  // Move to feedback once the closing line has been spoken.
  useEffect(() => {
    if (phase === "live" && ended && !busy) {
      const t = setTimeout(() => finish(), 1200);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ended, busy]);

  const avatarState: AvatarState = thinking
    ? "thinking"
    : speaker.speaking || (streaming && !voiceOn)
      ? "speaking"
      : listener.listening
        ? "listening"
        : "idle";

  const questionsAsked = turns.filter((t) => t.role === "interviewer").length;

  // ================================================================ render
  if (phase === "setup") {
    return (
      <>
        <PageHeader
          eyebrow="Face-to-face practice"
          title="Interview"
          accent="Prep"
          subtitle="Practise face to face with Robin, an AI hiring lead who asks the questions ECE panels really ask — tailored to the centre you're applying to."
        />
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <Card className="space-y-4">
            {jobs.length > 0 && (
              <Field label="Practise for a job in your tracker">
                <Select
                  value={jobId}
                  onChange={pickJob}
                  options={[{ value: "", label: "— General ECE interview —" }, ...jobs.map((j) => ({ value: j.id, label: `${j.title} · ${j.centre || "Unnamed centre"}` }))]}
                />
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your name">
                <Input value={setup.candidateName} onChange={(e) => setSetup({ ...setup, candidateName: e.target.value })} placeholder="Alex" />
              </Field>
              <Field label="Role">
                <Input value={setup.role} onChange={(e) => setSetup({ ...setup, role: e.target.value })} list="roles" />
                <datalist id="roles">
                  {ROLES.map((r) => (
                    <option key={r} value={r} />
                  ))}
                </datalist>
              </Field>
              <Field label="Centre">
                <Input value={setup.centre} onChange={(e) => setSetup({ ...setup, centre: e.target.value })} placeholder="Sunny Days Early Learning" />
              </Field>
              <Field label="Interview style">
                <Select
                  value={setup.focus}
                  onChange={(v) => setSetup({ ...setup, focus: v })}
                  options={INTERVIEW_FOCUS.map((f) => ({ value: f.label, label: f.label }))}
                />
              </Field>
            </div>
            <Field label="Centre's programs & philosophy" hint="optional, makes questions centre-specific">
              <Textarea rows={3} value={setup.centreInfo} onChange={(e) => setSetup({ ...setup, centreInfo: e.target.value })} />
            </Field>
            <Field label="Pedagogical approach" group>
              <ChipToggle options={PHILOSOPHIES.map((p) => p.name)} selected={setup.philosophies} onChange={(v) => setSetup({ ...setup, philosophies: v })} />
            </Field>
            <Field label="Number of questions" group>
              <div className="flex gap-2">
                {[3, 5, 8].map((n) => (
                  <button
                    key={n}
                    onClick={() => setSetup({ ...setup, questionCount: n })}
                    className={`rounded border px-4 py-2 text-sm font-bold ${setup.questionCount === n ? "border-gold-500 bg-gold-50 text-gold-700" : "border-line"}`}
                  >
                    {n} {n === 3 ? "· quick" : n === 5 ? "· standard" : "· full"}
                  </button>
                ))}
              </div>
            </Field>
          </Card>

          <Card className="flex flex-col items-center gap-4 bg-gradient-to-b from-gold-50 to-white text-center">
            <RobotAvatar state="idle" size={200} />
            <div>
              <p className="text-lg font-bold">Meet Robin</p>
              <p className="text-sm text-body">Your AI interviewer. Robin speaks each question aloud and listens to your spoken answers.</p>
            </div>
            <div className="w-full space-y-3 text-left">
              <Toggle on={voiceOn} onChange={setVoiceOn} label="Robin speaks out loud" icon={voiceOn ? <Volume2 size={16} /> : <VolumeX size={16} />} />
              {voiceOn && voices.length > 0 && (
                <Select value={voiceName} onChange={setVoiceName} options={voices.map((v) => ({ value: v.name, label: `${v.name} (${v.lang})` }))} />
              )}
              <Toggle
                on={answerMode === "voice"}
                onChange={(on) => setAnswerMode(on ? "voice" : "type")}
                label={listener.supported ? "Answer by speaking" : "Speaking not supported in this browser — type answers"}
                icon={answerMode === "voice" ? <Mic size={16} /> : <Keyboard size={16} />}
                disabled={!listener.supported}
              />
              <Toggle on={cameraOn} onChange={setCameraOn} label="Show my camera (stays on your device)" icon={cameraOn ? <Camera size={16} /> : <CameraOff size={16} />} />
            </div>
            <Button onClick={start} className="w-full py-3">
              <Play size={18} /> Start interview
            </Button>
          </Card>
        </div>

        {history.length > 0 && <PastSessions history={history} />}
      </>
    );
  }

  if (phase === "feedback") {
    return (
      <>
        <PageHeader
          eyebrow="Practice review"
          title="Your interview"
          accent="feedback"
          subtitle={`${setup.role}${setup.centre ? ` · ${setup.centre}` : ""}`}
          action={
            <Button onClick={() => setPhase("setup")}>
              <RotateCcw size={16} /> Practise again
            </Button>
          }
        />
        {error && <p className="mb-4 rounded bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {feedbackLoading ? (
          <Card className="flex flex-col items-center gap-3 py-16 text-center">
            <RobotAvatar state="thinking" size={160} />
            <p className="font-bold">Robin is reviewing your answers…</p>
          </Card>
        ) : feedback ? (
          <FeedbackReport feedback={feedback} />
        ) : null}
      </>
    );
  }

  // ---------------------------------------------------------------- live call
  const lastQuestion = [...turns].reverse().find((t) => t.role === "interviewer")?.text ?? "";
  const caption = streaming || thinking ? liveLine : lastQuestion;

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-5rem)] flex-col bg-brand-500 p-3 text-white md:-mx-8 md:-my-8 md:min-h-screen md:p-5">
      <div className="mb-3 flex items-center gap-3 text-sm">
        <span className="flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 font-bold text-rose-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-rose-400" /> Live practice
        </span>
        <span className="text-slate-300">
          {setup.centre || "Interview"} · Question {Math.min(Math.max(questionsAsked, 1), setup.questionCount)} of {setup.questionCount}
        </span>
      </div>

      <div className="grid flex-1 gap-3 lg:grid-cols-[1fr_320px]">
        <div className="relative flex min-h-[420px] flex-col items-center justify-center overflow-hidden rounded-md bg-gradient-to-b from-brand-600 to-brand-500">
          <div className="relative">
            {avatarState === "listening" && <span className="pulse-ring absolute inset-8 rounded-full border-4 border-emerald-400" />}
            <RobotAvatar state={avatarState} size={300} />
          </div>
          <p className="mt-1 text-sm font-bold text-slate-300">
            Robin · {avatarState === "thinking" ? "thinking…" : avatarState === "speaking" ? "speaking" : avatarState === "listening" ? "listening to you" : "waiting"}
          </p>

          {showCaptions && caption && (
            <div className="absolute inset-x-4 bottom-4 mx-auto max-w-2xl rounded-md bg-black/60 px-5 py-3 text-center text-[15px] leading-relaxed backdrop-blur md:right-56">
              {caption}
            </div>
          )}

          {/* self view */}
          <div className="absolute right-4 top-4 h-28 w-40 overflow-hidden rounded-md border-2 border-white/20 bg-slate-800 md:h-36 md:w-48">
            {cameraOn ? (
              <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <div className="grid h-full place-items-center text-3xl font-bold text-slate-400">
                {(setup.candidateName || "You").slice(0, 1).toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-1 left-2 text-xs font-bold drop-shadow">{setup.candidateName || "You"}</span>
          </div>
        </div>

        <aside className="flex max-h-[70vh] flex-col rounded-md bg-white/5 p-4 lg:max-h-none">
          <h2 className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">Transcript</h2>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-sm">
            {turns.map((t, i) => (
              <div key={i} className={t.role === "interviewer" ? "text-slate-200" : "rounded bg-white/10 p-2.5 text-white"}>
                <span className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">{t.role === "interviewer" ? "Robin" : "You"}</span>
                {t.text}
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* answer area */}
      <div className="mt-3 rounded-md bg-white/5 p-3 md:p-4">
        {error && <p className="mb-2 rounded bg-rose-500/20 p-2 text-sm text-rose-200">{error}</p>}
        {listener.error && <p className="mb-2 text-sm text-amber-300">{listener.error}</p>}
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="relative flex-1">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAnswer();
              }}
              rows={3}
              disabled={ended}
              placeholder={
                busy ? "Robin is asking the question…" : listener.listening ? "Listening… speak your answer" : "Type your answer, or press the mic to speak"
              }
              className="w-full resize-none rounded-md border border-white/10 bg-white/10 px-4 py-3 text-[15px] text-white outline-none placeholder:text-slate-400 focus:border-gold-500"
            />
            {awaitingAnswer && (
              <span className={`absolute right-3 top-2 text-xs font-bold ${answerSeconds > 150 ? "text-amber-300" : "text-slate-400"}`}>
                {Math.floor(answerSeconds / 60)}:{String(answerSeconds % 60).padStart(2, "0")}
              </span>
            )}
          </div>
          <div className="flex items-center justify-center gap-2">
            {listener.supported && (
              <CallButton
                onClick={() => (listener.listening ? listener.stop() : listener.start(draft))}
                active={listener.listening}
                label={listener.listening ? "Stop mic" : "Speak"}
                disabled={ended}
              >
                {listener.listening ? <MicOff size={20} /> : <Mic size={20} />}
              </CallButton>
            )}
            <CallButton onClick={() => speaker.say(lastQuestion)} label="Repeat" disabled={!lastQuestion || !voiceOn}>
              <Volume2 size={20} />
            </CallButton>
            <CallButton onClick={() => setCameraOn((c) => !c)} label="Camera">
              {cameraOn ? <Video size={20} /> : <CameraOff size={20} />}
            </CallButton>
            <CallButton onClick={() => setShowCaptions((c) => !c)} label="Captions" active={showCaptions}>
              <Captions size={20} />
            </CallButton>
            <button
              onClick={submitAnswer}
              disabled={!draft.trim() || thinking || streaming || ended}
              className="flex h-12 items-center gap-2 rounded-full bg-gold-500 px-5 font-semibold text-brand-500 hover:bg-gold-400 disabled:bg-white/10 disabled:text-slate-500"
            >
              <Send size={18} /> Answer
            </button>
            <button
              onClick={() => finish()}
              className="grid h-12 w-12 place-items-center rounded-full bg-rose-600 hover:bg-rose-700"
              title="End interview and get feedback"
              aria-label="End interview"
            >
              <PhoneOff size={20} />
            </button>
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">Tip: aim for 1–2 minutes per answer using a real example — Situation, Task, Action, Result. Ctrl/⌘+Enter sends.</p>
      </div>
    </div>
  );
}

// ================================================================ pieces

function Toggle({
  on,
  onChange,
  label,
  icon,
  disabled,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!on)}
      className={`flex w-full items-center gap-3 rounded border px-3 py-2.5 text-left text-sm font-semibold ${
        disabled ? "border-slate-100 text-slate-400" : "border-slate-200 bg-white"
      }`}
    >
      <span className={on && !disabled ? "text-leaf-600" : "text-slate-400"}>{icon}</span>
      <span className="flex-1">{label}</span>
      <span className={`relative h-6 w-10 rounded-full transition ${on && !disabled ? "bg-leaf-500" : "bg-slate-200"}`}>
        <span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${on && !disabled ? "left-5" : "left-1"}`} />
      </span>
    </button>
  );
}

function CallButton({
  children,
  onClick,
  label,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`grid h-12 w-12 place-items-center rounded-full transition disabled:opacity-40 ${active ? "bg-gold-500 text-brand-500" : "bg-white/10 hover:bg-white/20"}`}
    >
      {children}
    </button>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const color = score >= 80 ? "var(--color-leaf-500)" : score >= 60 ? "var(--color-gold-500)" : "#c2410c";
  return (
    <svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label={`Score ${score} out of 100`}>
      <circle cx="70" cy="70" r={r} stroke="var(--color-line)" strokeWidth="10" fill="none" />
      <circle
        cx="70"
        cy="70"
        r={r}
        style={{ stroke: color }}
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - score / 100)}
        transform="rotate(-90 70 70)"
      />
      <text x="70" y="82" textAnchor="middle" fontSize="40" fontWeight="600" style={{ fill: "var(--color-ink)", fontFamily: "var(--font-display)", fontVariantNumeric: "lining-nums" }}>
        {score}
      </text>
    </svg>
  );
}

function FeedbackReport({ feedback }: { feedback: InterviewFeedback }) {
  return (
    <div className="space-y-6">
      <Card className="flex flex-col items-center gap-6 md:flex-row">
        <ScoreRing score={feedback.overallScore} />
        <div className="flex-1">
          <p className="text-lg font-bold">Overall</p>
          <p className="mt-1 text-slate-700">{feedback.summary}</p>
        </div>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <p className="mb-2 font-bold text-leaf-600">What went well</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {feedback.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
        <Card>
          <p className="mb-2 font-bold text-brand-600">To work on</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {feedback.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="space-y-4">
        {feedback.perQuestion.map((q, i) => (
          <Card key={i}>
            <div className="flex items-start gap-3">
              <p className="flex-1 font-bold">
                Q{i + 1}. {q.question}
              </p>
              <span className="flex shrink-0" aria-label={`${q.score} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={16} className={n <= q.score ? "fill-gold-500 text-gold-500" : "text-slate-200"} />
                ))}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{q.feedback}</p>
            <details className="mt-3 rounded bg-leaf-50 p-3 text-sm">
              <summary className="cursor-pointer font-bold text-leaf-600">See a stronger answer</summary>
              <p className="mt-2 whitespace-pre-wrap text-slate-700">{q.strongerAnswer}</p>
            </details>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PastSessions({ history }: { history: ReturnType<typeof useInterviews>[0] }) {
  const [open, setOpen] = useState<string | null>(null);
  const session = history.find((h) => h.id === open);
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-2xl font-semibold">Past practice sessions</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {history.map((h) => (
          <button key={h.id} onClick={() => setOpen(open === h.id ? null : h.id)} className="text-left">
            <Card className={open === h.id ? "border-gold-500" : ""}>
              <div className="flex items-center justify-between">
                <p className="truncate font-bold">{h.role}</p>
                {h.feedback && <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-sm font-bold text-leaf-600">{h.feedback.overallScore}</span>}
              </div>
              <p className="text-sm text-slate-500">
                {h.centre || "General"} · {new Date(h.createdAt).toLocaleDateString()} · {h.turns.filter((t) => t.role === "candidate").length} answers
              </p>
            </Card>
          </button>
        ))}
      </div>
      {session?.feedback && (
        <div className="mt-6">
          <FeedbackReport feedback={session.feedback} />
        </div>
      )}
      {session && !session.feedback && (
        <Card className="mt-6 space-y-2 text-sm">
          {session.turns.map((t, i) => (
            <p key={i}>
              <b>{t.role === "interviewer" ? "Robin" : "You"}:</b> {t.text}
            </p>
          ))}
        </Card>
      )}
    </section>
  );
}

