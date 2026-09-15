"use client";
import { useEffect, useRef, useState } from "react";
/** Keep intermediate input (empty, minus sign, decimal) local; commit valid game values. */
export function NumberInput({
  label,
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value)),
    focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);
  return (
    <input
      aria-label={label}
      type="number"
      value={draft}
      min={Number.isFinite(min) ? min : undefined}
      max={Number.isFinite(max) ? max : undefined}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(e) => {
        setDraft(e.target.value);
        const n = e.target.valueAsNumber;
        if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
      }}
      onBlur={() => {
        focused.current = false;
        const n = draft.trim() ? Number(draft) : NaN;
        if (Number.isFinite(n)) {
          const next = Math.max(min, Math.min(max, n));
          if (next !== value) onChange(next);
          setDraft(String(next));
        } else setDraft(String(value));
      }}
    />
  );
}
