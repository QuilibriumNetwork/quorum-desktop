import React from 'react';

interface ProgressBarProps {
  /** Total number of segments */
  total: number;
  /** 1-based index of the current active segment (all segments up to this index are filled) */
  active: number;
}

/**
 * 5-segment pill progress indicator for onboarding flow.
 * Segments 1..active are filled (accent color), rest are empty (surface-5).
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ total, active }) => {
  return (
    <div className="onboarding-progress-bar" role="progressbar" aria-valuenow={active} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`onboarding-progress-bar__segment${i < active ? ' onboarding-progress-bar__segment--filled' : ''}`}
        />
      ))}
    </div>
  );
};
