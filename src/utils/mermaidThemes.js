const supportedThemes = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'default', label: 'Default' },
  { value: 'forest', label: 'Forest' },
  { value: 'neo', label: 'Neo' },
  { value: 'neo-dark', label: 'Neo Dark' },
  { value: 'redux', label: 'Redux' },
  { value: 'redux-color', label: 'Redux Color' },
  { value: 'dark', label: 'Dark' },
  { value: 'redux-dark', label: 'Redux Dark' },
  { value: 'redux-dark-color', label: 'Redux Dark Color' },
  { value: 'base', label: 'Base' }
];

const supportedThemeValues = new Set(supportedThemes.map((theme) => theme.value));

const HEX_COLOR_RE = /^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export const MERMAID_THEME_OPTIONS = supportedThemes;

export const DEFAULT_MERMAID_THEME_PREFS = {
  light: {
    theme: 'neutral',
    accent: '#2563eb',
    surface: '#ffffff',
    line: '#475569'
  },
  dark: {
    theme: 'dark',
    accent: '#60a5fa',
    surface: '#0f172a',
    line: '#94a3b8'
  }
};

function normalizeHexColor(value, fallback) {
  const raw = String(value || '').trim();
  if (!HEX_COLOR_RE.test(raw)) return fallback;
  const normalized = raw.startsWith('#') ? raw : `#${raw}`;
  if (normalized.length === 4) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
  }
  return normalized.toLowerCase();
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, '#000000').slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (channel) => clampChannel(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixColors(base, overlay, ratio = 0.5) {
  const weight = Math.max(0, Math.min(1, Number(ratio) || 0));
  const from = hexToRgb(base);
  const to = hexToRgb(overlay);
  return rgbToHex({
    r: from.r + (to.r - from.r) * weight,
    g: from.g + (to.g - from.g) * weight,
    b: from.b + (to.b - from.b) * weight
  });
}

function isDarkColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55;
}

function readableTextColor(background) {
  return isDarkColor(background) ? '#f8fafc' : '#0f172a';
}

function inferLook(theme) {
  return String(theme || '').startsWith('neo') ? 'neo' : 'classic';
}

function buildThemeVariables(modePrefs) {
  const surface = normalizeHexColor(modePrefs.surface, '#ffffff');
  const accent = normalizeHexColor(modePrefs.accent, '#2563eb');
  const line = normalizeHexColor(modePrefs.line, '#475569');
  const darkSurface = isDarkColor(surface);
  const textColor = readableTextColor(surface);
  const accentText = readableTextColor(accent);
  const tintWeight = darkSurface ? 0.2 : 0.1;
  const deepWeight = darkSurface ? 0.34 : 0.2;
  const secondary = mixColors(surface, accent, tintWeight);
  const tertiary = mixColors(surface, accent, darkSurface ? 0.3 : 0.17);
  const border = mixColors(line, accent, darkSurface ? 0.24 : 0.14);
  const edgeLabelBackground = darkSurface
    ? mixColors(surface, '#020617', 0.26)
    : mixColors(surface, '#ffffff', 0.56);

  return {
    background: surface,
    mainBkg: mixColors(surface, accent, darkSurface ? 0.08 : 0.03),
    secondBkg: secondary,
    tertiaryColor: tertiary,
    primaryColor: mixColors(surface, accent, deepWeight),
    primaryBorderColor: border,
    primaryTextColor: textColor,
    secondaryColor: secondary,
    secondaryBorderColor: line,
    secondaryTextColor: textColor,
    tertiaryBorderColor: border,
    tertiaryTextColor: textColor,
    lineColor: line,
    textColor,
    titleColor: textColor,
    clusterBkg: mixColors(surface, accent, darkSurface ? 0.14 : 0.06),
    clusterBorder: border,
    nodeBorder: border,
    edgeLabelBackground,
    defaultLinkColor: line,
    actorBkg: secondary,
    actorBorder: border,
    actorTextColor: textColor,
    noteBkgColor: tertiary,
    noteBorderColor: border,
    noteTextColor: textColor,
    activationBorderColor: border,
    activationBkgColor: tertiary,
    sequenceNumberColor: accentText,
    labelBoxBkgColor: edgeLabelBackground,
    labelBoxBorderColor: border,
    relationColor: line,
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  };
}

export function normalizeMermaidThemePrefs(input) {
  const normalizeMode = (mode, fallback) => {
    const theme = supportedThemeValues.has(mode?.theme) ? mode.theme : fallback.theme;
    return {
      theme,
      accent: normalizeHexColor(mode?.accent, fallback.accent),
      surface: normalizeHexColor(mode?.surface, fallback.surface),
      line: normalizeHexColor(mode?.line, fallback.line)
    };
  };

  return {
    light: normalizeMode(input?.light, DEFAULT_MERMAID_THEME_PREFS.light),
    dark: normalizeMode(input?.dark, DEFAULT_MERMAID_THEME_PREFS.dark)
  };
}

export function buildMermaidRenderConfig(mermaidThemePrefs, darkMode = false) {
  const normalizedPrefs = normalizeMermaidThemePrefs(mermaidThemePrefs);
  const modePrefs = darkMode ? normalizedPrefs.dark : normalizedPrefs.light;
  return {
    startOnLoad: false,
    securityLevel: 'loose',
    htmlLabels: true,
    theme: modePrefs.theme,
    look: inferLook(modePrefs.theme),
    darkMode: isDarkColor(modePrefs.surface),
    themeVariables: buildThemeVariables(modePrefs),
    flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
    sequence: { useMaxWidth: true }
  };
}
