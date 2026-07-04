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
  // Visual presets (render-stijl bibliotheek)
  noir:    { primary: '#e53e3e', accent: '#e53e3e', bg: '#000000', text: '#f5f5f5', label: 'noir'    },
  neon:    { primary: '#e53e3e', accent: '#39ff14', bg: '#0a0014', text: '#ffffff', label: 'neon'    },
  luxury:  { primary: '#d4af37', accent: '#d4af37', bg: '#0d0d0d', text: '#f8f5ec', label: 'luxury'  },
};

export function getTheme(label?: string | null): ColorTheme {
  return COLOR_THEMES[label as string] ?? COLOR_THEMES['default'];
}
