export interface ColorTheme {
  primary: string;
  accent:  string;
  bg:      string;
  text:    string;
  label:   string;
}

export const COLOR_THEMES: Record<string, ColorTheme> = {
  default: { primary: '#e53e3e', accent: '#FFD700', bg: '#111111', text: '#ffffff', label: 'default' },
  warm:    { primary: '#e53e3e', accent: '#f6ad55', bg: '#180a00', text: '#ffffff', label: 'warm'    },
  cool:    { primary: '#3b82f6', accent: '#93c5fd', bg: '#07101f', text: '#ffffff', label: 'cool'    },
  neutral: { primary: '#e53e3e', accent: '#FFD700', bg: '#111111', text: '#ffffff', label: 'neutral' },
  dark:    { primary: '#c53030', accent: '#00d4ff', bg: '#0f0f14', text: '#ffffff', label: 'dark'    },
};

export function getTheme(label?: string | null): ColorTheme {
  return COLOR_THEMES[label as string] ?? COLOR_THEMES['default'];
}
