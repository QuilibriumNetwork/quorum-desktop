import React from 'react';

export type DevStatTone = 'good' | 'bad' | 'warn' | 'neutral';

interface DevStatProps {
  label: string;
  value: number | string;
  /** Explanatory line under the value. Optional. */
  hint?: React.ReactNode;
  /** Defaults to `neutral`. */
  tone?: DevStatTone;
  className?: string;
}

const TONE_CLASS: Record<DevStatTone, string> = {
  good: 'text-green-500',
  bad: 'text-red-500',
  warn: 'text-yellow-500',
  neutral: 'text-strong',
};

/**
 * A labelled number.
 *
 * Exists because the hand-rolled versions of this on DM Doctor and Identity
 * Coverage rendered the label and the value as sibling `Text` primitives. `Text`
 * is a native-shaped API whose web shim renders an inline `<span>`, so the two
 * flowed onto one line and read as "Degraded0". Everything here is block-level
 * plain HTML, so the collision cannot come back.
 *
 * Hierarchy is carried by colour rather than size: `.text-label-strong` and
 * `.text-label` are both 14px, the readable floor for anything that is a
 * sentence, and they differ in weight of colour instead.
 *
 * `tone` is a semantic name rather than a Tailwind class so call sites cannot
 * drift onto their own colours, which is what the old `countTone()` helper
 * allowed.
 */
export const DevStat: React.FC<DevStatProps> = ({
  label,
  value,
  hint,
  tone = 'neutral',
  className = '',
}) => (
  <div className={`min-w-32 ${className}`}>
    <div className="text-label-strong">{label}</div>
    <div className={`text-2xl font-bold ${TONE_CLASS[tone]}`}>{value}</div>
    {hint && <div className="text-label text-subtle mt-1">{hint}</div>}
  </div>
);
