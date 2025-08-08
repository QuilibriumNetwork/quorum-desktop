import type { JSX } from "react";
export const createAnimation = (
  loaderName: string,
  frames: string,
  suffix: string
): string => {
  const animationName = `react-spinners-${loaderName}-${suffix}`;

  if (typeof window == 'undefined' || !window.document) {
    return animationName;
  }

  const styleEl = document.createElement('style');
  document.head.appendChild(styleEl);
  const styleSheet = styleEl.sheet;

  const keyFrames = `
    @keyframes ${animationName} {
      ${frames}
    }
  `;

  if (styleSheet) {
    styleSheet.insertRule(keyFrames, 0);
  }

  return animationName;
};

const rotate = createAnimation(
  'Loader',
  '0% {transform: rotate(0deg)} 100% {transform: rotate(360deg)}',
  'rotate'
);

export function Loading({ loading = true }): JSX.Element | null {
  const wrapper: React.CSSProperties = {
    border: '2px solid #f3f3f320',
    borderTop: '2px solid #f3dfc1',
    borderRadius: '50%',
    width: '20px',
    height: '20px',
    animation: `${rotate} 1s 0s linear infinite`,
  };

  if (!loading) {
    return null;
  }

  return <span style={wrapper}></span>;
}
