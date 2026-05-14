import { useTheme } from "../ThemeContext";
import { TRACK_COLORS } from "../constants";

function hexToRgb(hex: string) {
    let r = 0, g = 0, b = 0;
    if (hex.length === 4) {
        r = parseInt(hex[1] + hex[1], 16);
        g = parseInt(hex[2] + hex[2], 16);
        b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
        r = parseInt(hex.substring(1, 3), 16);
        g = parseInt(hex.substring(3, 5), 16);
        b = parseInt(hex.substring(5, 7), 16);
    }
    return { r, g, b };
}

function hexToHsl(hex: string) {
    let {r, g, b} = hexToRgb(hex);
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return {h, s, l};
}

function hslToRgb(h: number, s: number, l: number) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return {r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255)};
}

function rgbToHex(r: number, g: number, b: number) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function getLuminance(r: number, g: number, b: number) {
    const a = [r, g, b].map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function mixColorsDramatic(color1: string, color2: string, ratio: number) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    // Shift the hue significantly for a dramatic gradient
    const { h, s, l } = hexToHsl(color1);
    const hShift = 0.25; // 90 degrees shift across the tracks
    let newH = (h + ratio * hShift);
    if (newH > 1) newH -= 1;
    
    // Mix saturation and lightness towards the background slightly
    const bgHsl = hexToHsl(color2);
    
    // Start with the shifted hue
    const shiftedRgb = hslToRgb(newH, s, l);
    
    // Mix the shifted accent with the background color
    // Reduce the pull towards background so colors stay vibrant
    const mixRatio = ratio * 0.4;
    
    let r = Math.round(shiftedRgb.r * (1 - mixRatio) + rgb2.r * mixRatio);
    let g = Math.round(shiftedRgb.g * (1 - mixRatio) + rgb2.g * mixRatio);
    let b = Math.round(shiftedRgb.b * (1 - mixRatio) + rgb2.b * mixRatio);
    
    // Check contrast against the background
    const bgLum = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const mixLum = getLuminance(r, g, b);
    
    // Require a healthy minimum luminance difference so it is clearly visible
    const minLumDiff = 0.22;
    if (Math.abs(bgLum - mixLum) < minLumDiff) {
        const factor = bgLum > 0.5 ? 0.5 : 1.6; // Push hard to ensure visibility
        r = Math.min(255, Math.max(0, Math.round(r * factor)));
        g = Math.min(255, Math.max(0, Math.round(g * factor)));
        b = Math.min(255, Math.max(0, Math.round(b * factor)));
    }
    
    return rgbToHex(r, g, b);
}

export function useTrackColor() {
    const { accentColor, backgroundColor } = useTheme();
    
    return (trackColor: string) => {
        const defaultIndex = TRACK_COLORS.indexOf(trackColor);
        
        if (defaultIndex !== -1) {
            // Apply a curve to the ratio so it's not purely linear
            const linearRatio = defaultIndex / (TRACK_COLORS.length - 1 || 1);
            const ratio = Math.pow(linearRatio, 0.85); // slight ease-out curve
            
            return mixColorsDramatic(accentColor, backgroundColor, ratio);
        }
        
        return trackColor; // custom color
    };
}
