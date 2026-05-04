import React, { createContext, useContext, useState, useEffect } from "react";

type ThemeContextType = {
  accentColor: string;
  setAccentColor: (color: string) => void;
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  fontSize: number;
  setFontSize: (size: number) => void;
  fontFamily: string;
  setFontFamily: (font: string) => void;
  backgroundImage: string | null;
  setBackgroundImage: (imgUrl: string | null) => void;
  bgPosX: number;
  setBgPosX: (val: number) => void;
  bgPosY: number;
  setBgPosY: (val: number) => void;
  bgZoom: number;
  setBgZoom: (val: number) => void;
  bgBlend: number;
  setBgBlend: (val: number) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [accentColor, setAccentColor] = useState(
    () => localStorage.getItem("theme_accentColor") || "#00a8ff",
  );
  const [backgroundColor, setBackgroundColor] = useState(
    () => localStorage.getItem("theme_backgroundColor") || "#1e1e1e",
  );
  const [fontSize, setFontSize] = useState(() => {
    const stored = localStorage.getItem("theme_fontSize");
    return stored ? parseInt(stored, 10) : 16;
  });
  const [fontFamily, setFontFamily] = useState(
    () =>
      localStorage.getItem("theme_fontFamily") ||
      '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  );
  const [backgroundImage, setBackgroundImage] = useState<string | null>(() =>
    localStorage.getItem("theme_backgroundImage"),
  );
  const [bgPosX, setBgPosX] = useState(() => {
    const stored = localStorage.getItem("theme_bgPosX");
    return stored ? parseInt(stored, 10) : 50;
  });
  const [bgPosY, setBgPosY] = useState(() => {
    const stored = localStorage.getItem("theme_bgPosY");
    return stored ? parseInt(stored, 10) : 50;
  });
  const [bgZoom, setBgZoom] = useState(() => {
    const stored = localStorage.getItem("theme_bgZoom");
    return stored ? parseInt(stored, 10) : 100;
  });
  const [bgBlend, setBgBlend] = useState(() => {
    const stored = localStorage.getItem("theme_bgBlend");
    return stored ? parseInt(stored, 10) : 70;
  });

  useEffect(() => {
    localStorage.setItem("theme_accentColor", accentColor);
    localStorage.setItem("theme_backgroundColor", backgroundColor);
    localStorage.setItem("theme_fontSize", fontSize.toString());
    localStorage.setItem("theme_fontFamily", fontFamily);
    localStorage.setItem("theme_bgPosX", bgPosX.toString());
    localStorage.setItem("theme_bgPosY", bgPosY.toString());
    localStorage.setItem("theme_bgZoom", bgZoom.toString());
    localStorage.setItem("theme_bgBlend", bgBlend.toString());
    if (backgroundImage) {
      localStorage.setItem("theme_backgroundImage", backgroundImage);
    } else {
      localStorage.removeItem("theme_backgroundImage");
    }

    // Calculate derived colors
    // Simple hover color calculation (lighten slightly)
    const lightenColor = (hex: string, percent: number) => {
      let r = parseInt(hex.substring(1, 3), 16);
      let g = parseInt(hex.substring(3, 5), 16);
      let b = parseInt(hex.substring(5, 7), 16);

      r = Math.min(255, Math.floor(r + (255 - r) * percent));
      g = Math.min(255, Math.floor(g + (255 - g) * percent));
      b = Math.min(255, Math.floor(b + (255 - b) * percent));

      return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    };

    const getLuminance = (hex: string) => {
      let r, g, b;
      if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
      } else {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(5, 5), 16); // typo in orig? wait original had hex.substring(3,5)
        // let's fix original bug too
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
      }
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    };

    const accentHover = lightenColor(accentColor, 0.2);

    // Calculate panel background (slightly lighter than main bg)
    const panelBg = lightenColor(backgroundColor, 0.05);

    const accentLuminance = getLuminance(accentColor);
    const bgLuminance = getLuminance(backgroundColor);

    const accentText = accentLuminance < 0.5 ? "#ffffff" : "#000000";

    // If background gets too light, standard text needs to be dark
    const mainText = bgLuminance > 0.5 ? "#111111" : "#d4d4d4";
    const subText = bgLuminance > 0.5 ? "#444444" : "#999999";

    const root = document.documentElement;
    root.style.setProperty("--accent", accentColor);
    root.style.setProperty("--accent-hover", accentHover);
    root.style.setProperty("--accent-text", accentText);
    root.style.setProperty("--bg-main", backgroundColor);
    root.style.setProperty("--bg-panel", panelBg);
    root.style.setProperty("--main-text", mainText);
    root.style.setProperty("--sub-text", subText);
    root.style.fontSize = `${fontSize}px`;

    // Inject style tag to override Tailwind arbitrary values
    let styleEl = document.getElementById("dynamic-theme-overrides");
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = "dynamic-theme-overrides";
      document.head.appendChild(styleEl);
    }

    styleEl.innerHTML = `
      .bg-\\[\\#ff7b00\\] { background-color: var(--accent) !important; color: var(--accent-text) !important; }
      .text-\\[\\#ff7b00\\] { color: var(--accent) !important; }
      .border-\\[\\#ff7b00\\] { border-color: var(--accent) !important; }
      .hover\\:border-\\[\\#ff7b00\\]:hover { border-color: var(--accent) !important; }
      .focus\\:border-\\[\\#ff7b00\\]:focus { border-color: var(--accent) !important; }
      .accent-\\[\\#ff7b00\\] { accent-color: var(--accent) !important; }
      
      .bg-\\[\\#ffaa00\\] { background-color: var(--accent-hover) !important; color: var(--accent-text) !important; }
      .hover\\:bg-\\[\\#ffaa00\\]:hover { background-color: var(--accent-hover) !important; color: var(--accent-text) !important; }
      .hover\\:bg-\\[\\#ff9933\\]:hover { background-color: var(--accent-hover) !important; color: var(--accent-text) !important; }
      
      .bg-\\[\\#1e1e1e\\] { 
          background-color: var(--bg-main) !important; 
          color: var(--main-text) !important; 
      }
      .custom-track-bg {
          ${backgroundImage ? `background-image: linear-gradient(color-mix(in srgb, var(--bg-main) ${bgBlend}%, transparent), color-mix(in srgb, var(--bg-main) ${bgBlend}%, transparent)), url("${backgroundImage}") !important; background-size: ${bgZoom}% !important; background-position: ${bgPosX}% ${bgPosY}% !important;` : ""}
      }
      .bg-\\[\\#2d2d2d\\] { background-color: var(--bg-panel) !important; }
      
      .text-\\[\\#d4d4d4\\] { color: var(--main-text) !important; }
      .hover\\:text-\\[\\#d4d4d4\\]:hover { color: var(--main-text) !important; }
      .text-\\[\\#999\\] { color: var(--sub-text) !important; }
      
      /* Let text-black become accent-text when in accent background */
      .bg-\\[\\#ff7b00\\].text-black { color: var(--accent-text) !important; }
      .hover\\:bg-\\[\\#ffaa00\\]:hover.text-black { color: var(--accent-text) !important; }
      .bg-\\[\\#ffaa00\\].text-black { color: var(--accent-text) !important; }

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
      body, .font-sans {
        font-family: ${fontFamily.includes("font-sans") ? fontFamily : `${fontFamily}, sans-serif`} !important;
      }
    `;
  }, [
    accentColor,
    backgroundColor,
    fontSize,
    fontFamily,
    backgroundImage,
    bgPosX,
    bgPosY,
    bgZoom,
    bgBlend,
  ]);

  return (
    <ThemeContext.Provider
      value={{
        accentColor,
        setAccentColor,
        backgroundColor,
        setBackgroundColor,
        fontSize,
        setFontSize,
        fontFamily,
        setFontFamily,
        backgroundImage,
        setBackgroundImage,
        bgPosX,
        setBgPosX,
        bgPosY,
        setBgPosY,
        bgZoom,
        setBgZoom,
        bgBlend,
        setBgBlend,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
