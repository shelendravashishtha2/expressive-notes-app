import { useEffect, useMemo, useState } from "react";

function clampPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function useLoaderPercent(progress) {
  const explicitPercent = clampPercent(progress);
  const [estimatedPercent, setEstimatedPercent] = useState(() => explicitPercent ?? 4);

  useEffect(() => {
    if (explicitPercent !== null) {
      setEstimatedPercent(explicitPercent);
      return undefined;
    }

    setEstimatedPercent((current) => Math.max(4, Math.min(current, 94)));

    const timer = window.setInterval(() => {
      setEstimatedPercent((current) => {
        if (current >= 94) return current;
        if (current < 28) return Math.min(94, current + 6);
        if (current < 58) return Math.min(94, current + 4);
        if (current < 82) return Math.min(94, current + 2);
        return Math.min(94, current + 1);
      });
    }, 260);

    return () => window.clearInterval(timer);
  }, [explicitPercent]);

  return explicitPercent ?? estimatedPercent;
}

function shouldShowPercent(message, showPercentage) {
  if (typeof showPercentage === "boolean") return showPercentage;
  return /^loading/i.test(String(message || "").trim());
}

function loadingLabel(message, percent, showPercentage) {
  const text = message || "Loading...";
  return showPercentage ? `${text} ${percent}%` : text;
}

function DashLoader({ className = "" }) {
  return (
    <div className={`dash-loader ${className}`.trim()} aria-hidden="true">
      <span className="dash-loader__dash dash-loader__dash--one" />
      <span className="dash-loader__dash dash-loader__dash--two" />
      <span className="dash-loader__dash dash-loader__dash--three" />
      <span className="dash-loader__dash dash-loader__dash--four" />
    </div>
  );
}

function LoaderWithPercent({
  message = "Loading...",
  progress,
  showPercentage,
  className = "",
}) {
  const percent = useLoaderPercent(progress);
  const withPercent = shouldShowPercent(message, showPercentage);
  const label = useMemo(
    () => loadingLabel(message, percent, withPercent),
    [message, percent, withPercent],
  );

  return (
    <div className={`dash-loader-stack ${className}`.trim()}>
      <p className="dash-loader-copy">{label}</p>
      <DashLoader />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible atom for older imports/usages.
// The previous canvas/blob loader is intentionally replaced with the CSS dash
// loader so loading remains lightweight and theme-aware.
// ─────────────────────────────────────────────────────────────────────────────
export function SectionBlobLoader({ className = "" }) {
  return <DashLoader className={className} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineContentLoader  —  in-page loading placeholder
// ─────────────────────────────────────────────────────────────────────────────
export function InlineContentLoader({
  message = "Loading...",
  progress,
  minHeight = "260px",
  className = "",
  showPercentage,
}) {
  return (
    <section
      className={`inline-content-loader ${className}`.trim()}
      style={{ minHeight }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoaderWithPercent
        message={message}
        progress={progress}
        showPercentage={showPercentage}
      />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppStartupLoader  —  full-screen launch screen
// ─────────────────────────────────────────────────────────────────────────────
export function AppStartupLoader({
  message = "Loading...",
  progress,
  showPercentage,
}) {
  return (
    <main
      className="startup-loader"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="startup-loader-card">
        <LoaderWithPercent
          message={message}
          progress={progress}
          showPercentage={showPercentage}
        />
      </div>
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SyncStatusDock  —  fixed bottom-right dock
// ─────────────────────────────────────────────────────────────────────────────
export function SyncStatusDock({ show, status = "syncing", message }) {
  if (!show) return null;
  const text =
    message ||
    (status === "error"
      ? "Remote notes are waking up"
      : "Streaming latest notes from backend");

  return (
    <div
      className={`sync-status-dock ${status === "error" ? "is-error" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="sync-status-pulse" />
      <span>{text}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience re-exports
// ─────────────────────────────────────────────────────────────────────────────
export function InlineTopicLoader({
  message = "Loading...",
  progress,
  minHeight = "320px",
}) {
  return (
    <InlineContentLoader
      message={message}
      progress={progress}
      minHeight={minHeight}
    />
  );
}

export function FullScrollTailLoader({ progress }) {
  return (
    <InlineContentLoader
      message="Loading..."
      progress={progress}
      minHeight="220px"
      className="my-10 full-scroll-tail-loader"
    />
  );
}

// Backward-compatible default export for old imports
export default function BlobLoader({
  loading = false,
  progress,
  children,
  className = "",
  style = {},
}) {
  return (
    <div className={`blob-loader-host ${className}`.trim()} style={style}>
      {children}
      {loading ? (
        <div className="blob-loader-overlay-visual" role="status" aria-live="polite" aria-busy="true">
          <LoaderWithPercent message="Loading..." progress={progress} />
        </div>
      ) : null}
    </div>
  );
}
