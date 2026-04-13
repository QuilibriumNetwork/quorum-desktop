import React, { useState } from 'react';

interface OnboardingInfoLinkProps {
  label: string;
  content: string;
}

export const OnboardingInfoLink: React.FC<OnboardingInfoLinkProps> = ({ label, content }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <span
        className="onboarding-link"
        onClick={() => setExpanded(v => !v)}
      >
        {label}
      </span>
      {expanded && (
        <p className="onboarding-read-more">{content}</p>
      )}
    </>
  );
};
