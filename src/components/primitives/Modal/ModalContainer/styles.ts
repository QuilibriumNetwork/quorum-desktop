// Add this CSS to your global styles or as a CSS module
export const modalAnimationCSS = `
@keyframes modalOpen {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.animate-modalOpen {
  animation: modalOpen 0.3s ease-out;
}
`;
