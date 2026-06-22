import ChromeDevToolsTheme from '../data/monaco-themes/chrome-devtools.json';
import CloudsTheme from '../data/monaco-themes/clouds.json';
import Cobalt2Theme from '../data/monaco-themes/cobalt2.json';
import DawnTheme from '../data/monaco-themes/dawn.json';
import DraculaTheme from '../data/monaco-themes/dracula.json';
import EspressoLibreTheme from '../data/monaco-themes/espresso-libre.json';
import GitHubDarkTheme from '../data/monaco-themes/github-dark.json';
import GitHubLightTheme from '../data/monaco-themes/github-light.json';
import KuroirTheme from '../data/monaco-themes/kuroir-theme.json';
import MonokaiBrightTheme from '../data/monaco-themes/monokai-bright.json';
import MonokaiTheme from '../data/monaco-themes/monokai.json';
import NightOwlTheme from '../data/monaco-themes/night-owl.json';
import NordTheme from '../data/monaco-themes/nord.json';
import OceanicNextTheme from '../data/monaco-themes/oceanic-next.json';
import SolarizedDarkTheme from '../data/monaco-themes/solarized-dark.json';
import SolarizedLightTheme from '../data/monaco-themes/solarized-light.json';
import TomorrowTheme from '../data/monaco-themes/tomorrow.json';
import TomorrowNightBlueTheme from '../data/monaco-themes/tomorrow-night-blue.json';
import TomorrowNightBrightTheme from '../data/monaco-themes/tomorrow-night-bright.json';
import TomorrowNightTheme from '../data/monaco-themes/tomorrow-night.json';
import TomorrowNightEightiesTheme from '../data/monaco-themes/tomorrow-night-eighties.json';
import TwilightTheme from '../data/monaco-themes/twilight.json';
import XcodeTheme from '../data/monaco-themes/xcode-default.json';
import ZenburnesqueTheme from '../data/monaco-themes/zenburnesque.json';

const bundledThemes = [
  { value: 'github-light', label: 'GitHub Light', mode: 'light', data: GitHubLightTheme },
  { value: 'chrome-devtools', label: 'Chrome DevTools', mode: 'light', data: ChromeDevToolsTheme },
  { value: 'clouds', label: 'Clouds', mode: 'light', data: CloudsTheme },
  { value: 'dawn', label: 'Dawn', mode: 'light', data: DawnTheme },
  { value: 'tomorrow', label: 'Tomorrow', mode: 'light', data: TomorrowTheme },
  { value: 'solarized-light', label: 'Solarized Light', mode: 'light', data: SolarizedLightTheme },
  { value: 'kuroir-theme', label: 'Kuroir', mode: 'light', data: KuroirTheme },
  { value: 'xcode-default', label: 'Xcode', mode: 'light', data: XcodeTheme },
  { value: 'night-owl', label: 'Night Owl', mode: 'dark', data: NightOwlTheme },
  { value: 'dracula', label: 'Dracula', mode: 'dark', data: DraculaTheme },
  { value: 'github-dark', label: 'GitHub Dark', mode: 'dark', data: GitHubDarkTheme },
  { value: 'nord', label: 'Nord', mode: 'dark', data: NordTheme },
  { value: 'monokai', label: 'Monokai', mode: 'dark', data: MonokaiTheme },
  { value: 'monokai-bright', label: 'Monokai Bright', mode: 'dark', data: MonokaiBrightTheme },
  { value: 'oceanic-next', label: 'Oceanic Next', mode: 'dark', data: OceanicNextTheme },
  { value: 'cobalt2', label: 'Cobalt2', mode: 'dark', data: Cobalt2Theme },
  { value: 'twilight', label: 'Twilight', mode: 'dark', data: TwilightTheme },
  { value: 'espresso-libre', label: 'Espresso Libre', mode: 'dark', data: EspressoLibreTheme },
  { value: 'tomorrow-night', label: 'Tomorrow Night', mode: 'dark', data: TomorrowNightTheme },
  { value: 'tomorrow-night-blue', label: 'Tomorrow Night Blue', mode: 'dark', data: TomorrowNightBlueTheme },
  { value: 'tomorrow-night-bright', label: 'Tomorrow Night Bright', mode: 'dark', data: TomorrowNightBrightTheme },
  { value: 'tomorrow-night-eighties', label: 'Tomorrow Night Eighties', mode: 'dark', data: TomorrowNightEightiesTheme },
  { value: 'solarized-dark', label: 'Solarized Dark', mode: 'dark', data: SolarizedDarkTheme },
  { value: 'zenburnesque', label: 'Zenburnesque', mode: 'dark', data: ZenburnesqueTheme }
];

const builtinThemes = [
  { value: 'vs', label: 'VS Light', mode: 'light', builtin: true },
  { value: 'vs-dark', label: 'VS Dark', mode: 'dark', builtin: true },
  { value: 'hc-light', label: 'High Contrast Light', mode: 'light', builtin: true },
  { value: 'hc-black', label: 'High Contrast Dark', mode: 'dark', builtin: true }
];

const themeDefinitions = [...bundledThemes, ...builtinThemes];
const themeLookup = new Map(themeDefinitions.map((theme) => [theme.value, theme]));

const legacyAliases = {
  'notes-light': 'github-light',
  'notes-dark': 'night-owl'
};

export const DEFAULT_MONACO_THEME_PREFS = {
  light: 'github-light',
  dark: 'night-owl'
};

export const MONACO_THEME_OPTIONS = {
  light: themeDefinitions
    .filter((theme) => theme.mode === 'light')
    .map(({ value, label }) => ({ value, label })),
  dark: themeDefinitions
    .filter((theme) => theme.mode === 'dark')
    .map(({ value, label }) => ({ value, label }))
};

const BUILTIN_STATIC_PALETTES = {
  vs: {
    background: '#ffffff',
    top: '#f5f9ff',
    border: '#cbd5e1',
    gutter: '#f8fafc',
    gutterBorder: '#dbeafe',
    text: '#0f172a',
    lineNumber: '#64748b',
    label: '#1e3a8a',
    button: '#ffffff',
    buttonText: '#1e3a8a',
    faded: '#475569',
    comment: '#6a737d',
    keyword: '#0000ff',
    string: '#a31515',
    number: '#098658',
    function: '#795e26',
    operator: '#0f172a',
    property: '#001080',
    punctuation: '#475569'
  },
  'vs-dark': {
    background: '#1f1f1f',
    top: '#252526',
    border: '#3a3d41',
    gutter: '#1f1f1f',
    gutterBorder: '#2d2f33',
    text: '#d4d4d4',
    lineNumber: '#858585',
    label: '#9cdcfe',
    button: '#2a2d2e',
    buttonText: '#d4d4d4',
    faded: '#9ca3af',
    comment: '#6a9955',
    keyword: '#569cd6',
    string: '#ce9178',
    number: '#b5cea8',
    function: '#dcdcaa',
    operator: '#d4d4d4',
    property: '#9cdcfe',
    punctuation: '#d4d4d4'
  },
  'hc-light': {
    background: '#ffffff',
    top: '#f8fafc',
    border: '#94a3b8',
    gutter: '#f8fafc',
    gutterBorder: '#94a3b8',
    text: '#000000',
    lineNumber: '#334155',
    label: '#000000',
    button: '#ffffff',
    buttonText: '#000000',
    faded: '#334155',
    comment: '#006000',
    keyword: '#0000ff',
    string: '#a31515',
    number: '#0451a5',
    function: '#795e26',
    operator: '#000000',
    property: '#001080',
    punctuation: '#334155'
  },
  'hc-black': {
    background: '#000000',
    top: '#0f172a',
    border: '#475569',
    gutter: '#020617',
    gutterBorder: '#334155',
    text: '#ffffff',
    lineNumber: '#cbd5e1',
    label: '#ffffff',
    button: '#111827',
    buttonText: '#ffffff',
    faded: '#cbd5e1',
    comment: '#7ca668',
    keyword: '#569cd6',
    string: '#ce9178',
    number: '#b5cea8',
    function: '#dcdcaa',
    operator: '#ffffff',
    property: '#9cdcfe',
    punctuation: '#e2e8f0'
  }
};

const RULE_MATCHERS = {
  comment: ['comment'],
  keyword: ['keyword', 'storage', 'control'],
  string: ['string'],
  number: ['number', 'constant.numeric'],
  function: ['entity.name.function', 'support.function', 'meta.function-call', 'function'],
  operator: ['keyword.operator', 'operator'],
  property: ['support.type.property-name', 'variable.other.property', 'meta.object-literal.key', 'property'],
  punctuation: ['delimiter', 'punctuation']
};

function normalizeHexColor(value, fallback) {
  const raw = String(value || '').trim();
  if (!raw) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toLowerCase();
  if (/^[0-9a-f]{3}$/i.test(raw)) return `#${raw[0]}${raw[0]}${raw[1]}${raw[1]}${raw[2]}${raw[2]}`.toLowerCase();
  return fallback;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, '#000000').slice(1);
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function clampChannel(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function rgbToHex({ r, g, b }) {
  const toHex = (channel) => clampChannel(channel).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function mixHexColors(base, overlay, ratio = 0.5) {
  const weight = Math.max(0, Math.min(1, Number(ratio) || 0));
  const from = hexToRgb(base);
  const to = hexToRgb(overlay);
  return rgbToHex({
    r: from.r + (to.r - from.r) * weight,
    g: from.g + (to.g - from.g) * weight,
    b: from.b + (to.b - from.b) * weight
  });
}

function readableTextColor(background) {
  const { r, g, b } = hexToRgb(background);
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luminance < 0.55 ? '#f8fafc' : '#0f172a';
}

function findRuleColor(rules = [], matchers = [], fallback) {
  const loweredMatchers = matchers.map((matcher) => matcher.toLowerCase());
  const matchRule = rules.find((rule) => {
    const token = String(rule?.token || '').toLowerCase();
    if (!token) return false;
    return loweredMatchers.some((matcher) => token === matcher || token.includes(matcher));
  });

  return normalizeHexColor(matchRule?.foreground, fallback);
}

function fallbackStaticPalette(themeName) {
  const mode = themeLookup.get(themeName)?.mode;
  return BUILTIN_STATIC_PALETTES[mode === 'light' ? 'vs' : 'vs-dark'];
}

function buildStaticPaletteFromTheme(themeName) {
  if (BUILTIN_STATIC_PALETTES[themeName]) return BUILTIN_STATIC_PALETTES[themeName];

  const theme = themeLookup.get(themeName);
  const mode = theme?.mode === 'light' ? 'light' : 'dark';
  const fallback = fallbackStaticPalette(themeName);
  const colors = theme?.data?.colors || {};
  const rules = theme?.data?.rules || [];

  const background = normalizeHexColor(colors['editor.background'], fallback.background);
  const text = normalizeHexColor(colors['editor.foreground'], fallback.text);
  const selection = normalizeHexColor(
    colors['editor.selectionBackground'],
    mixHexColors(background, mode === 'light' ? '#2563eb' : '#60a5fa', mode === 'light' ? 0.1 : 0.18)
  );
  const lineHighlight = normalizeHexColor(
    colors['editor.lineHighlightBackground'],
    mixHexColors(background, text, mode === 'light' ? 0.03 : 0.08)
  );
  const border = mixHexColors(background, text, mode === 'light' ? 0.14 : 0.22);
  const gutter = mixHexColors(background, mode === 'light' ? '#f8fafc' : '#0b1120', mode === 'light' ? 0.65 : 0.42);
  const lineNumber = normalizeHexColor(colors['editorLineNumber.foreground'], mixHexColors(text, background, 0.5));
  const comment = findRuleColor(rules, RULE_MATCHERS.comment, fallback.comment);
  const keyword = findRuleColor(rules, RULE_MATCHERS.keyword, fallback.keyword);
  const string = findRuleColor(rules, RULE_MATCHERS.string, fallback.string);
  const number = findRuleColor(rules, RULE_MATCHERS.number, fallback.number);
  const fn = findRuleColor(rules, RULE_MATCHERS.function, fallback.function);
  const operator = findRuleColor(rules, RULE_MATCHERS.operator, fallback.operator);
  const property = findRuleColor(rules, RULE_MATCHERS.property, fallback.property);
  const punctuation = findRuleColor(rules, RULE_MATCHERS.punctuation, fallback.punctuation);
  const label = readableTextColor(selection);

  return {
    background,
    top: mixHexColors(selection, background, mode === 'light' ? 0.5 : 0.32),
    border,
    gutter,
    gutterBorder: mixHexColors(gutter, border, 0.7),
    text,
    lineNumber,
    label,
    button: mixHexColors(background, selection, mode === 'light' ? 0.24 : 0.3),
    buttonText: readableTextColor(mixHexColors(background, selection, mode === 'light' ? 0.24 : 0.3)),
    faded: mixHexColors(text, background, 0.35),
    comment,
    keyword,
    string,
    number,
    function: fn,
    operator,
    property,
    punctuation
  };
}

export function getStaticCodeThemePalette(theme = DEFAULT_MONACO_THEME_PREFS.dark) {
  const normalizedTheme = themeLookup.has(theme) ? theme : DEFAULT_MONACO_THEME_PREFS.dark;
  return buildStaticPaletteFromTheme(normalizedTheme);
}

export function getStaticCodeThemeCssVariables(theme = DEFAULT_MONACO_THEME_PREFS.dark) {
  const palette = getStaticCodeThemePalette(theme);
  return {
    '--code-bg': palette.background,
    '--code-top': palette.top,
    '--code-border': palette.border,
    '--code-label': palette.label,
    '--code-button': palette.button,
    '--code-button-text': palette.buttonText,
    '--code-gutter-bg': palette.gutter,
    '--code-gutter-border': palette.gutterBorder,
    '--code-token-text': palette.text,
    '--code-token-line-number': palette.lineNumber,
    '--code-token-faded': palette.faded,
    '--code-token-comment': palette.comment,
    '--code-token-keyword': palette.keyword,
    '--code-token-string': palette.string,
    '--code-token-number': palette.number,
    '--code-token-function': palette.function,
    '--code-token-operator': palette.operator,
    '--code-token-property': palette.property,
    '--code-token-punctuation': palette.punctuation
  };
}

export function normalizeMonacoThemePrefs(input) {
  const nextLight = legacyAliases[input?.light] || input?.light;
  const nextDark = legacyAliases[input?.dark] || input?.dark;

  return {
    light: themeLookup.has(nextLight) ? nextLight : DEFAULT_MONACO_THEME_PREFS.light,
    dark: themeLookup.has(nextDark) ? nextDark : DEFAULT_MONACO_THEME_PREFS.dark
  };
}

export function isDarkMonacoTheme(theme = DEFAULT_MONACO_THEME_PREFS.dark) {
  return themeLookup.get(theme)?.mode === 'dark';
}

export function defineNotesMonacoThemes(monaco) {
  if (monaco?.editor?.__notesThemesDefined) return;

  bundledThemes.forEach((theme) => {
    monaco.editor.defineTheme(theme.value, theme.data);
  });

  monaco.editor.__notesThemesDefined = true;
}
