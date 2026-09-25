"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Rich, useT } from "@/lib/i18n";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

/** Small gold uppercase label with a leading rule, as used across hiremeece.au. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p className={`flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-gold-600 ${className}`}>
      <span className="h-px w-8 bg-gold-500" aria-hidden />
      {children}
    </p>
  );
}

/** Page title. `heading` is translated as a whole; wrap the gold italic part in <em>, e.g. "Cover <em>Letter</em>". */
export function PageHeader({ heading, eyebrow, subtitle, action }: { heading: string; eyebrow?: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <Eyebrow className="mb-3">{eyebrow}</Eyebrow>}
        <h1 className="text-4xl font-medium leading-tight text-ink md:text-5xl">
          <Rich text={heading} />
        </h1>
        {subtitle && <p className="mt-3 max-w-2xl leading-relaxed text-body">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <div id={id} className={`rounded-md border border-line bg-white p-5 ${className}`}>
      {children}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-200",
  secondary: "bg-white text-ink border border-brand-200 hover:border-brand-500 disabled:text-slate-400",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-rose-50 text-rose-700 hover:bg-rose-100",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold tracking-wide transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** Labelled form control. Use `group` when the children are several buttons (chips, choices) rather than one input. */
export function Field({ label, hint, group, children }: { label: string; hint?: string; group?: boolean; children: ReactNode }) {
  const heading = (
    <>
      <span className="text-sm font-semibold text-ink">{label}</span>
      {hint && <span className="ml-2 text-xs text-slate-500">{hint}</span>}
    </>
  );
  if (group) {
    return (
      <div role="group" aria-label={label}>
        {heading}
        <div className="mt-1.5">{children}</div>
      </div>
    );
  }
  return (
    <label className="block">
      {heading}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

const inputClass =
  "w-full rounded border border-line bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-gold-500 focus:ring-2 focus:ring-gold-100";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} min-h-24 ${props.className ?? ""}`} />;
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function ChipToggle({
  options,
  selected,
  onChange,
  titles,
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  titles?: Record<string, string>;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            type="button"
            key={o}
            title={titles?.[o]}
            onClick={() => onChange(on ? selected.filter((s) => s !== o) : [...selected, o])}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              on ? "border-gold-500 bg-gold-50 text-gold-700" : "border-line bg-white text-body hover:border-brand-200"
            }`}
          >
            {t(o)}
          </button>
        );
      })}
    </div>
  );
}

/** Accessible dialog (Radix): traps focus, closes on Esc or outside click, and returns focus afterwards. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const t = useT();
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-brand-500/50 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_150ms_ease-out]" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 md:p-10">
          <Dialog.Content
            aria-describedby={undefined}
            className="pointer-events-auto w-full max-w-2xl rounded-md bg-white p-6 shadow-2xl outline-none data-[state=open]:animate-[dialog-in_180ms_ease-out]"
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <Dialog.Title className="font-display text-3xl font-semibold">{title}</Dialog.Title>
              <Dialog.Close className="rounded p-1.5 text-slate-500 hover:bg-cream hover:text-ink focus-visible:outline-2 focus-visible:outline-gold-500" aria-label={t("Close")}>
                <X size={18} />
              </Dialog.Close>
            </div>
            {children}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** Placeholder block shown while content loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-line/70 ${className}`} aria-hidden />;
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-dashed border-gold-200 bg-white/60 px-6 py-12 text-center">
      <div className="mb-3 text-gold-500">{icon}</div>
      <p className="font-display text-2xl font-semibold">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-body">{children}</div>}
    </div>
  );
}

/** Reads a streamed text response, calling onChunk with the full text so far. */
export async function readTextStream(res: Response, onChunk: (full: string) => void): Promise<string> {
  if (!res.ok || !res.body) {
    const body = await res.text();
    let message = body;
    try {
      message = (JSON.parse(body) as { error?: string }).error ?? body;
    } catch {
      // Plain-text error.
    }
    throw new Error(message || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    full += decoder.decode(value, { stream: true });
    onChunk(full);
  }
  return full;
}
