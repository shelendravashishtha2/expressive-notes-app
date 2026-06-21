import { memo } from 'react';
import { CheckCircle2, FileDown, Loader2, X, XCircle } from 'lucide-react';

const RUNNING_STATUSES = new Set(['queued', 'preparing', 'rendering', 'finalizing']);

function tone(status) {
  if (status === 'error') return 'border-red-300/70 bg-red-50 text-red-700 dark:border-red-400/40 dark:bg-red-500/15 dark:text-red-200';
  if (status === 'completed') return 'border-emerald-300/70 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-500/15 dark:text-emerald-200';
  if (status === 'cancelled') return 'border-slate-300/70 bg-slate-50 text-slate-700 dark:border-slate-500/50 dark:bg-slate-800 dark:text-slate-200';
  return 'border-[var(--border)] bg-[var(--article-bg)] text-[var(--heading)] shadow-2xl shadow-slate-950/20';
}

function iconFor(status) {
  if (RUNNING_STATUSES.has(status)) return <Loader2 size={18} className="animate-spin" />;
  if (status === 'completed') return <CheckCircle2 size={18} />;
  if (status === 'error') return <XCircle size={18} />;
  return <FileDown size={18} />;
}

function ExportStatusToast({ task, onCancel, onDismiss }) {
  if (!task || task.status === 'idle') return null;

  const isRunning = RUNNING_STATUSES.has(task.status);
  const percent = Math.max(0, Math.min(100, Math.round(task.progress || 0)));

  return (
    <div className={`fixed bottom-4 right-4 z-[95] w-[min(24rem,calc(100vw-2rem))] rounded-3xl border p-4 backdrop-blur-xl print:hidden ${tone(task.status)}`} role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-2xl bg-black/5 p-2 dark:bg-white/10">
          {iconFor(task.status)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] opacity-75">PDF Export</p>
              <p className="mt-1 truncate text-sm font-black">{task.stage || 'Preparing export'}</p>
            </div>
            {!isRunning ? (
              <button type="button" onClick={onDismiss} className="rounded-xl p-1.5 opacity-70 transition hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10" aria-label="Dismiss export status">
                <X size={16} />
              </button>
            ) : null}
          </div>

          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${percent}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs font-bold opacity-80">
            <span>{percent}%</span>
            {task.filename ? <span className="truncate">{task.filename}</span> : null}
          </div>

          {task.error ? <p className="mt-3 text-sm font-semibold">{task.error}</p> : null}

          {isRunning ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold opacity-75">Running in background — you can keep using the app.</p>
              <button type="button" onClick={onCancel} className="shrink-0 rounded-xl border border-current/20 px-3 py-1.5 text-xs font-black transition hover:bg-black/5 dark:hover:bg-white/10">
                Cancel
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default memo(ExportStatusToast);
