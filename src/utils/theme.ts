// Real hex values for Tailwind color palettes used as accent themes
// These are used at runtime to set CSS custom properties, since
// Tailwind v4 resolves its own --color-* vars at build time.

export const THEME_COLORS: Record<string, Record<number, string>> = {
 indigo: {
 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc',
 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca',
 800: '#3730a3', 900: '#312e81', 950: '#1e1b4b',
 },
 emerald: {
 50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
 800: '#065f46', 900: '#064e3b', 950: '#022c22',
 },
 orange: {
 50: '#fff7ed', 100: '#ffedd5', 200: '#fed7aa', 300: '#fdba74',
 400: '#fb923c', 500: '#f97316', 600: '#ea580c', 700: '#c2410c',
 800: '#9a3412', 900: '#7c2d12', 950: '#431407',
 },
 blue: {
 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
 800: '#1e40af', 900: '#1e3a8a', 950: '#172554',
 },
 pink: {
 50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4',
 400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d',
 800: '#9d174d', 900: '#831843', 950: '#500724',
 },
 amber: {
 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309',
 800: '#92400e', 900: '#78350f', 950: '#451a03',
 },
};

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Apply a theme color to the document root by setting --theme-* CSS variables
 * to real hex values that Tailwind's @theme block picks up.
 */
export function applyThemeColor(colorName: string): void {
 const palette = THEME_COLORS[colorName] ?? THEME_COLORS.indigo;
 const root = document.documentElement;
 SHADES.forEach(shade => {
 root.style.setProperty(`--theme-${shade}`, palette[shade]);
 });
}

/**
 * Apply dark or light mode by toggling the .dark class on <html>.
 */
export function applyThemeMode(mode: 'dark' | 'light' | 'system'): void {
 const root = document.documentElement;
 if (mode === 'light') {
 root.classList.remove('dark');
 } else if (mode === 'dark') {
 root.classList.add('dark');
 } else {
 // system
 const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
 if (prefersDark) {
 root.classList.add('dark');
 } else {
 root.classList.remove('dark');
 }
 }
}
