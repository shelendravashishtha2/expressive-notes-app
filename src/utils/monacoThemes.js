import ChromeDevToolsTheme from '../data/monaco-themes/chrome-devtools.json';
import GitHubDarkTheme from '../data/monaco-themes/github-dark.json';
import GitHubLightTheme from '../data/monaco-themes/github-light.json';
import KuroirTheme from '../data/monaco-themes/kuroir-theme.json';
import MonokaiTheme from '../data/monaco-themes/monokai.json';
import NightOwlTheme from '../data/monaco-themes/night-owl.json';
import NordTheme from '../data/monaco-themes/nord.json';
import OceanicNextTheme from '../data/monaco-themes/oceanic-next.json';
import SolarizedDarkTheme from '../data/monaco-themes/solarized-dark.json';
import SolarizedLightTheme from '../data/monaco-themes/solarized-light.json';
import TomorrowTheme from '../data/monaco-themes/tomorrow.json';
import TomorrowNightEightiesTheme from '../data/monaco-themes/tomorrow-night-eighties.json';
import XcodeTheme from '../data/monaco-themes/xcode-default.json';

const bundledThemes = [
  { value: 'github-light', label: 'GitHub Light', mode: 'light', data: GitHubLightTheme },
  { value: 'chrome-devtools', label: 'Chrome DevTools', mode: 'light', data: ChromeDevToolsTheme },
  { value: 'tomorrow', label: 'Tomorrow', mode: 'light', data: TomorrowTheme },
  { value: 'solarized-light', label: 'Solarized Light', mode: 'light', data: SolarizedLightTheme },
  { value: 'kuroir-theme', label: 'Kuroir', mode: 'light', data: KuroirTheme },
  { value: 'xcode-default', label: 'Xcode', mode: 'light', data: XcodeTheme },
  { value: 'night-owl', label: 'Night Owl', mode: 'dark', data: NightOwlTheme },
  { value: 'github-dark', label: 'GitHub Dark', mode: 'dark', data: GitHubDarkTheme },
  { value: 'nord', label: 'Nord', mode: 'dark', data: NordTheme },
  { value: 'monokai', label: 'Monokai', mode: 'dark', data: MonokaiTheme },
  { value: 'oceanic-next', label: 'Oceanic Next', mode: 'dark', data: OceanicNextTheme },
  { value: 'solarized-dark', label: 'Solarized Dark', mode: 'dark', data: SolarizedDarkTheme },
  { value: 'tomorrow-night-eighties', label: 'Tomorrow Night Eighties', mode: 'dark', data: TomorrowNightEightiesTheme }
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
  light: themeDefinitions.filter((theme) => theme.mode === 'light').map(({ value, label }) => ({ value, label })),
  dark: themeDefinitions.filter((theme) => theme.mode === 'dark').map(({ value, label }) => ({ value, label }))
};

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
