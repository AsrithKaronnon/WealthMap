export type ThemePreference = 'light' | 'dark' | 'system';

const THEME_COLOR = { dark: '#0d1117', light: '#f5f7fa' };

export function getSavedTheme(): ThemePreference {
  const saved = window.localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  return 'system';
}

export function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return pref;
}

export function applyTheme(pref: ThemePreference) {
  const mode = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  root.classList.add(mode);
  document.querySelectorAll('meta[name="theme-color"]').forEach((el) => {
    el.setAttribute('content', THEME_COLOR[mode]);
  });
}
