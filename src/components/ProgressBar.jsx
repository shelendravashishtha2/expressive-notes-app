import { forwardRef, memo } from 'react';

const ProgressBar = forwardRef(function ProgressBar(_, ref) {
  return (
    <div className="fixed left-0 right-0 top-0 z-[70] h-1 bg-transparent print:hidden">
      <div ref={ref} className="progress-bar-inner h-full w-full bg-[var(--accent)]" />
    </div>
  );
});

export default memo(ProgressBar);
