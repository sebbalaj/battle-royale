import { useEffect, useRef, useState } from "react";

type NumberFieldProps = {
  label?: string;
  value: number;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  /** Value committed when the field is left blank on blur. Defaults to value. */
  fallback?: number;
  onChange: (value: number) => void;
};

const clamp = (value: number, min?: number, max?: number): number => {
  let next = value;
  if (min !== undefined && next < min) next = min;
  if (max !== undefined && next > max) next = max;
  return next;
};

// Controlled number input that keeps a local string draft while the field is
// focused. This lets the user clear the field or type a partial value (e.g. a
// leading decimal point) without the component forcing a leading zero or
// snapping the value mid-edit. The parsed number is pushed up as the user types
// when it is finite; on blur the draft is committed (or the fallback when left
// blank), clamped to min/max.
export default function NumberField({ label, value, step = 1, min, max, hint, fallback, onChange }: NumberFieldProps) {
  const [draft, setDraft] = useState<string>(() => String(value));
  const focusedRef = useRef(false);

  // Keep the draft in sync with the external value while the field is not being
  // edited, so programmatic updates (e.g. loading a layout) are reflected.
  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(Number.isFinite(value) ? String(value) : "");
    }
  }, [value]);

  const handleChange = (next: string) => {
    setDraft(next);
    if (next.trim() === "") return;
    const parsed = Number(next);
    if (Number.isFinite(parsed)) onChange(parsed);
  };

  const handleBlur = () => {
    focusedRef.current = false;
    const parsed = Number(draft);
    const committed = draft.trim() === "" || !Number.isFinite(parsed)
      ? (fallback ?? value)
      : parsed;
    const clamped = clamp(committed, min, max);
    setDraft(String(clamped));
    if (clamped !== value) onChange(clamped);
  };

  const input = (
    <input
      type="number"
      value={draft}
      step={step}
      min={min}
      max={max}
      onFocus={() => { focusedRef.current = true; }}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
    />
  );

  if (label === undefined) return input;

  return (
    <label className="field">
      <span>{label}</span>
      {input}
      {hint && <small className="settings-hint">{hint}</small>}
    </label>
  );
}
