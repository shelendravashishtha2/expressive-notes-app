import { useEffect, useRef, useState } from 'react';

const FALLBACK_ACCENT = { r: 124, g: 58, b: 237 };

/**
 * SectionBlobLoader
 *
 * Keeps the original bubbly/blobby canvas animation intact. The optimization is
 * only in placement: callers mount it inside a small invisible loader surface,
 * so the original canvas effect is never stretched across a huge article/card.
 */
export function SectionBlobLoader({
  loading = true,
  color = 'var(--accent)',
  className = '',
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);
  const visibleRef = useRef(true);
  const [phase, setPhase] = useState(loading ? 'active' : 'idle');
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (loading) setPhase('active');
    else if (phase === 'active') setPhase('fading');
  }, [loading, phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      const isVisible = entries.some((entry) => entry.isIntersecting);
      visibleRef.current = isVisible;
      setVisible(isVisible);
    }, {
      root: null,
      rootMargin: '260px 0px 320px 0px',
      threshold: 0.01,
    });

    observer.observe(host);
    return () => observer.disconnect();
  }, [phase]);

  useEffect(() => {
    if (phase !== 'active' || !visible) return undefined;

    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return undefined;

    const W = Math.max(220, Math.floor(host.offsetWidth || 300));
    const H = Math.max(110, Math.floor(host.offsetHeight || 160));
    canvas.width = W;
    canvas.height = H;

    const ctx = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
    if (!ctx) return undefined;

    const off = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(W, H)
      : document.createElement('canvas');
    off.width = W;
    off.height = H;
    const oCtx = off.getContext('2d', { willReadFrequently: true, alpha: true });
    if (!oCtx) return undefined;

    const rgb = resolveColorToRgb(color, host);
    const fillC = `rgb(${rgb.r},${rgb.g},${rgb.b})`;

    const PERTURB = 28;
    const perturbs = Array.from({ length: PERTURB }, () => ({
      cx: Math.random() * W,
      width: W * (0.03 + Math.random() * 0.09),
      amp: 4 + Math.random() * 11,
      phase: Math.random() * Math.PI * 2,
      freq: 0.6 + Math.random() * 2.2,
      drift: (Math.random() - 0.5) * 18,
      amp2: 2 + Math.random() * 6,
      freq2: 1.1 + Math.random() * 2.8,
      phase2: Math.random() * Math.PI * 2,
    }));

    const R = 13;
    const COUNT = 40;
    const blobs = Array.from({ length: COUNT }, () => ({
      offsetY: -(Math.random() * R * 2),
      x: Math.random() * W,
      xPhase: Math.random() * Math.PI * 2,
      xFreq: 0.8 + Math.random() * 2.5,
      xAmp: 6 + Math.random() * 22,
      speed: 0.5 + Math.random() * 1.4,
      delay: Math.random() * 0.5,
    }));

    function surfaceY(x, elapsed, baseFillY) {
      let offset = 0;
      for (let i = 0; i < PERTURB; i += 1) {
        const p = perturbs[i];
        const cx = (p.cx + elapsed * p.drift + W * 10) % W;
        const dx = Math.min(Math.abs(x - cx), W - Math.abs(x - cx));
        const gaussian = Math.exp(-(dx * dx) / (2 * p.width * p.width));
        const h1 = p.amp * Math.sin(elapsed * p.freq + p.phase);
        const h2 = p.amp2 * Math.sin(elapsed * p.freq2 + p.phase2);
        offset -= gaussian * Math.max(0, h1 + h2);
      }
      return baseFillY + offset;
    }

    let stopped = false;
    startRef.current = performance.now();

    function tick(now) {
      if (stopped) return;
      if (!visibleRef.current) {
        rafRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const elapsed = (now - startRef.current) / 1000;
      const baseFillY = H - H * Math.min(elapsed * 0.25, 1);
      const entropy = Math.min(elapsed / 8, 1);

      oCtx.clearRect(0, 0, W, H);

      oCtx.beginPath();
      oCtx.moveTo(0, H);
      for (let x = 0; x <= W; x += 1) {
        oCtx.lineTo(x, surfaceY(x, elapsed, baseFillY));
      }
      oCtx.lineTo(W, H);
      oCtx.closePath();
      oCtx.fillStyle = fillC;
      oCtx.fill();

      blobs.forEach((b) => {
        const t = Math.max(0, elapsed - b.delay);
        if (t <= 0) return;

        b.offsetY -= b.speed * (55 + entropy * 130) * (1 / 60);

        const wobble = Math.sin(elapsed * b.xFreq + b.xPhase) * b.xAmp * (0.3 + entropy * 2.2);
        const jitter = (Math.random() - 0.5) * entropy * 9;
        const cx = b.x + wobble + jitter;
        const cy = surfaceY(((cx % W) + W) % W, elapsed, baseFillY) + b.offsetY;

        if (b.offsetY < -(H * 0.65)) {
          b.offsetY = R * 0.5 + Math.random() * R;
          b.x = Math.random() * W;
        }

        const grd = oCtx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
        grd.addColorStop(0, `rgba(${rgb.r},${rgb.g},${rgb.b},1)`);
        grd.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},0.95)`);
        grd.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
        oCtx.beginPath();
        oCtx.arc(cx, cy, R * 1.6, 0, Math.PI * 2);
        oCtx.fillStyle = grd;
        oCtx.fill();
      });

      const img = oCtx.getImageData(0, 0, W, H);
      const d = img.data;
      for (let p = 0; p < d.length; p += 4) {
        if (d[p + 3] < 140) {
          d[p + 3] = 0;
        } else {
          d[p] = rgb.r;
          d[p + 1] = rgb.g;
          d[p + 2] = rgb.b;
          d[p + 3] = 255;
        }
      }
      oCtx.putImageData(img, 0, 0);

      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(off, 0, 0);

      rafRef.current = window.requestAnimationFrame(tick);
    }

    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      stopped = true;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
    };
  }, [color, phase, visible]);

  useEffect(() => {
    if (phase !== 'fading') return undefined;
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);

    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (canvas && host) {
      const W = Math.max(220, Math.floor(host.offsetWidth || 300));
      const H = Math.max(110, Math.floor(host.offsetHeight || 160));
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      const rgb = resolveColorToRgb(color, host);
      if (ctx) {
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = `rgb(${rgb.r},${rgb.g},${rgb.b})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    const timer = window.setTimeout(() => setPhase('idle'), 520);
    return () => window.clearTimeout(timer);
  }, [color, phase]);

  if (phase === 'idle') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`section-blob-loader ${phase === 'fading' ? 'is-fading' : ''} ${className}`.trim()}
    />
  );
}

function LoaderSpinner() {
  return <span className="inline-loader-spinner" aria-hidden="true" />;
}

export function InlineContentLoader({ message = 'Loading...', minHeight = '260px', className = '' }) {
  return (
    <section
      className={`inline-content-loader ${className}`.trim()}
      style={{ minHeight }}
      role="status"
      aria-live="polite"
    >
      <div className="bubbly-loader-visual">
        <SectionBlobLoader color="var(--accent)" />
      </div>
      <div className="inline-loader-copy">
        <LoaderSpinner />
        <span>{message}</span>
      </div>
    </section>
  );
}

export function AppStartupLoader({ message = 'Loading...' }) {
  const text = message || 'Loading...';

  return (
    <main
      className="startup-loader min-h-screen bg-[radial-gradient(circle_at_top_left,var(--hero-glow),transparent_34rem),var(--app-bg)] text-[var(--app-text)]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="startup-loader-copy">
        <LoaderSpinner />
        <span>{text}</span>
      </div>
      <div className="startup-loader-band" aria-hidden="true">
        <SectionBlobLoader color="var(--accent)" />
      </div>
    </main>
  );
}

export function SyncStatusDock({ show, status = 'syncing', message }) {
  if (!show) return null;
  const text = message || (status === 'error'
    ? 'Remote notes are waking up'
    : 'Streaming latest notes from backend');

  return (
    <div className={`sync-status-dock ${status === 'error' ? 'is-error' : ''}`} role="status" aria-live="polite">
      <span className="sync-status-pulse" />
      <span>{text}</span>
    </div>
  );
}

export function InlineTopicLoader({ message = 'Loading...', minHeight = '320px' }) {
  return <InlineContentLoader message={message} minHeight={minHeight} />;
}

export function FullScrollTailLoader() {
  return <InlineContentLoader message="Loading..." minHeight="220px" className="my-10" />;
}

// Backward-compatible default export for old imports.
export default function BlobLoader({ loading = false, color = 'var(--accent)', children, className = '', style = {} }) {
  return (
    <div className={`blob-loader-host ${className}`.trim()} style={style}>
      {children}
      {loading ? (
        <div className="bubbly-loader-visual blob-loader-overlay-visual">
          <SectionBlobLoader color={color} />
        </div>
      ) : null}
    </div>
  );
}

function resolveColorToRgb(color, element) {
  if (!color || typeof color !== 'string') return FALLBACK_ACCENT;

  const trimmed = color.trim();
  if (trimmed.startsWith('var(') && element) {
    const variableName = trimmed.match(/var\((--[^),\s]+)/)?.[1];
    if (variableName) {
      return resolveColorToRgb(getComputedStyle(element).getPropertyValue(variableName).trim(), element);
    }
  }

  if (trimmed.startsWith('#')) return hexToRgb(trimmed);

  const rgbMatch = trimmed.match(/rgba?\(([^)]+)\)/i);
  if (rgbMatch) {
    const [r, g, b] = rgbMatch[1].split(',').map((part) => Number.parseFloat(part.trim()));
    if ([r, g, b].every(Number.isFinite)) {
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
  }

  if (element && typeof document !== 'undefined') {
    const probe = document.createElement('span');
    probe.style.color = trimmed;
    probe.style.position = 'absolute';
    probe.style.pointerEvents = 'none';
    probe.style.opacity = '0';
    element.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    if (resolved && resolved !== trimmed) return resolveColorToRgb(resolved, element);
  }

  return FALLBACK_ACCENT;
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '').trim();
  const full = clean.length === 3
    ? clean.split('').map((char) => char + char).join('')
    : clean;
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return FALLBACK_ACCENT;
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}
