"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-slate-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-orange-100/70 bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-200",
  secondary: "bg-white text-ink border border-slate-200 hover:bg-slate-50 disabled:text-slate-400",
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
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}

/** Labelled form control. Use `group` when the children are several buttons (chips, choices) rather than one input. */
export function Field({ label, hint, group, children }: { label: string; hint?: string; group?: boolean; children: ReactNode }) {
  const heading = (
    <>
      <span className="text-sm font-bold text-slate-700">{label}</span>
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
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

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
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              on ? "border-leaf-500 bg-leaf-50 text-leaf-600" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 md:p-10" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-orange-100 bg-white/60 px-6 py-12 text-center">
      <div className="mb-3 text-brand-400">{icon}</div>
      <p className="font-bold">{title}</p>
      {children && <div className="mt-2 max-w-md text-sm text-slate-600">{children}</div>}
    </div>
  );
}

/** Reads a streamed text response, calling onChunk with the full text so far. */
export async function readTextStream(res: Response, onChunk: (full: string) => void): Promise<string> {
  if (!res.ok || !res.body) throw new Error((await res.text()) || `Request failed (${res.status})`);
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
