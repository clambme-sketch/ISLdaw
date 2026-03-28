import React, { createContext, useContext, useState, useEffect } from 'react';

type ThemeContextType = {
  accentColor: string;
  setAccentColor: (color: string) => void;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [accentColor, setAccentColor] = useState('#00a8ff'); // Cerulean blue default
  const [backgroundColor, setBackgroundColor] = useState('#1e1e1e');
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif');

  useEffect(() => {
    // Calculate derived colors
    // Simple hover color calculation (lighten slightly)
    const lightenColor = (hex: string, percent: number) => {
      let r = parseInt(hex.substring(1, 3), 16);
      let g = parseInt(hex.substring(3, 5), 16);
      let b = parseInt(hex.substring(5, 7), 16);

      r = Math.min(255, Math.floor(r + (255 - r) * percent));
      g = Math.min(255, Math.floor(g + (255 - g) * percent));
      b = Math.min(255, Math.floor(b + (255 - b) * percent));

      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    };

    const accentHover = lightenColor(accentColor, 0.2);
    
    // Calculate panel background (slightly lighter than main bg)
    const panelBg = lightenColor(backgroundColor, 0.05);

    const root = document.documentElement;
    root.style.setProperty('--accent', accentColor);
    root.style.setProperty('--accent-hover', accentHover);
    root.style.setProperty('--bg-main', backgroundColor);
    root.style.setProperty('--bg-panel', panelBg);
    root.style.fontSize = `${fontSize}px`;

    // Inject style tag to override Tailwind arbitrary values
    let styleEl = document.getElementById('dynamic-theme-overrides');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-theme-overrides';
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      .bg-\\[\\#ff7b00\\] { background-color: var(--accent) !important; }
      .text-\\[\\#ff7b00\\] { color: var(--accent) !important; }
      .border-\\[\\#ff7b00\\] { border-color: var(--accent) !important; }
      .hover\\:border-\\[\\#ff7b00\\]:hover { border-color: var(--accent) !important; }
      .focus\\:border-\\[\\#ff7b00\\]:focus { border-color: var(--accent) !important; }
      .accent-\\[\\#ff7b00\\] { accent-color: var(--accent) !important; }
      
      .bg-\\[\\#ffaa00\\] { background-color: var(--accent-hover) !important; }
      .hover\\:bg-\\[\\#ffaa00\\]:hover { background-color: var(--accent-hover) !important; }
      .hover\\:bg-\\[\\#ff9933\\]:hover { background-color: var(--accent-hover) !important; }
      
      .bg-\\[\\#1e1e1e\\] { background-color: var(--bg-main) !important; }
      .bg-\\[\\#2d2d2d\\] { background-color: var(--bg-panel) !important; }
      
      /* Handle opacity variants if needed, though Tailwind might use rgba */
      .bg-\\[\\#ff7b00\\]\\/20 { background-color: color-mix(in srgb, var(--accent) 20%, transparent) !important; }
      .bg-\\[\\#ff7b00\\]\\/10 { background-color: color-mix(in srgb, var(--accent) 10%, transparent) !important; }
      .bg-\\[\\#ff7b00\\]\\/50 { background-color: color-mix(in srgb, var(--accent) 50%, transparent) !important; }
      .border-\\[\\#ff7b00\\]\\/50 { border-color: color-mix(in srgb, var(--accent) 50%, transparent) !important; }
      .selection\\:bg-\\[\\#ff7b00\\]\\/30 *::selection { background-color: color-mix(in srgb, var(--accent) 30%, transparent) !important; }
      .selection\\:bg-\\[\\#ff7b00\\]\\/30::selection { background-color: color-mix(in srgb, var(--accent) 30%, transparent) !important; }

      /* Soften corners globally (Logic Pro style) */
      .rounded-none { border-radius: 6px !important; }
      
      /* Change font to Apple style */
      body {
        font-family: ${fontFamily} !important;
      }
    `;
  }, [accentColor, backgroundColor, fontSize, fontFamily]);

  return (
    <ThemeContext.Provider value={{ accentColor, setAccentColor, backgroundColor, setBackgroundColor, fontSize, setFontSize, fontFamily, setFontFamily }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
