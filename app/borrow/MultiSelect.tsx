"use client";

import { useEffect, useId, useRef, useState } from "react";

type Props = {
  label: string;
  allLabel: string;
  value: string[];
  onChange: (value: string[]) => void;
  options: { value: string; label: string }[];
};

export default function MultiSelect({ label, allLabel, value, onChange, options }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const summary = value.length ? value.map(selected => options.find(option => option.value === selected)?.label ?? selected).join(", ") : allLabel;

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return <div ref={root} className="relative min-w-0" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <span id={`${id}-label`} className="block text-xs text-zinc-400">{label}</span>
    <button ref={trigger} type="button" aria-labelledby={`${id}-label ${id}-value`} aria-expanded={open} aria-controls={`${id}-options`} onClick={() => setOpen(previous => !previous)} className="mt-2 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-[#111116] px-3 py-2.5 text-left text-sm text-white outline-none focus-visible:border-cyan-300/60">
      <span id={`${id}-value`} title={summary} className="min-w-0 flex-1 truncate">{summary}</span>
      {value.length ? <span aria-hidden="true" className="rounded bg-cyan-300/10 px-1.5 text-xs text-cyan-200">{value.length}</span> : null}
      <span aria-hidden="true" className="text-zinc-500">{open ? "▴" : "▾"}</span>
    </button>
    {open ? <div id={`${id}-options`} role="group" aria-labelledby={`${id}-label`} className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-xl border border-white/15 bg-[#16161c] shadow-xl shadow-black/50">
      <button type="button" onClick={() => onChange([])} className={`w-full border-b border-white/10 px-3 py-3 text-left text-xs hover:bg-white/5 focus-visible:outline focus-visible:outline-cyan-300 ${value.length ? "text-zinc-400" : "text-cyan-200"}`}>{allLabel} · clear selection</button>
      <div className="max-h-64 overflow-y-auto p-1">
        {options.length ? options.map(option => <label key={option.value} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5 text-sm text-zinc-200 hover:bg-white/5 focus-within:bg-white/5">
          <input type="checkbox" checked={value.includes(option.value)} onChange={event => onChange(event.target.checked ? [...value, option.value] : value.filter(selected => selected !== option.value))} className="h-4 w-4 shrink-0 accent-cyan-300" />
          {option.label}
        </label>) : <p className="px-2 py-3 text-xs text-zinc-500">Options appear when markets load.</p>}
      </div>
      <p className="border-t border-white/10 px-3 py-2 text-[11px] text-zinc-500">{value.length ? `${value.length} selected` : "All included"} · select multiple</p>
    </div> : null}
  </div>;
}
