import { forwardRef, memo } from 'react';

const ProgressBar = forwardRef(function ProgressBar(_, ref) {
  return (
    <div
      className="scroll-progress-shell print:hidden"
      data-progress-label="0%"
      aria-hidden="true"
    >
      <div ref={ref} className="progress-bar-inner h-full w-full bg-[var(--accent)]" />
    </div>
  );
});

export default memo(ProgressBar);
