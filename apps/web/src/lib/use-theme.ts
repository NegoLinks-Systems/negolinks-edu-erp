import { useEffect, useState } from 'react';

const DARK = {
  '--bg-primary': '#080810', '--bg-card': '#131325', '--bg-surface': '#0E0E1C',
  '--bg-border': '#1C1C34', '--text-primary': '#FFFFFF',
  '--text-secondary': '#A0A0B8', '--text-muted': '#5A5A78',
} as const;

const LIGHT = {
  '--bg-primary': '#F4F5F7', '--bg-card': '#FFFFFF', '--bg-surface': '#EAECF0',
  '--bg-border': '#D1D5DB', '--text-primary': '#0F172A',
  '--text-secondary': '#374151', '--text-muted': '#6B7280',
} as const;

/** Applies the palette to :root. Exported so main.tsx can run it pre-render. */
export function applyTheme(dark: boolean) {
  const root = document.documentElement;
  const vars = dark ? DARK : LIGHT;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.classList.toggle('dark', dark);
  localStorage.setItem('nl-theme', dark ? 'dark' : 'light');
}

export function getSavedTheme(): boolean {
  return localStorage.getItem('nl-theme') !== 'light'; // default dark
}

/** Shared dark/light state. Defaults to dark; persists across reloads. */
export function useTheme() {
  const [dark, setDark] = useState(getSavedTheme);
  useEffect(() => { applyTheme(dark); }, [dark]);
  return { dark, setDark, toggle: () => setDark((d) => !d) };
}
