// not used for now as switching from unkonw.png to this is a bit complex

import React from 'react';

interface UnknownAvatarProps {
  size?: number; 
  className?: string;
  bgColor?: string; 
  iconColor?: string; 
}

const UnknownAvatar = ({
  size = 38,
  className = '',
  bgColor = 'bg-surface-8',
  iconColor = 'text-main',
}: UnknownAvatarProps) => {
  return (
    <div
      className={`rounded-full flex items-center justify-center ${bgColor} ${iconColor} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size * 0.58}
        height={size * 0.58}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor" // uses current text color
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    </div>
  );
};

export default UnknownAvatar;
