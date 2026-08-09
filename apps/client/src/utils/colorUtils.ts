export function isValidHexColor(hex: string): boolean {
  // Regex to check for valid hex color codes: #RGB, #RRGGBB, #RGBA, #RRGGBBAA
  return /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex);
}

/** Returns the perceived luminosity of a hexadecimal color, or null when it cannot be parsed. */
export function getColorLuminance(hexColor: string): number | null {
  const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  let r: number;
  let g: number;
  let b: number;

  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length >= 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    return null;
  }

  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Whether a color should use a dark foreground for legibility. */
export function isColorLight(hexColor: string): boolean {
  const luminance = getColorLuminance(hexColor);
  return luminance !== null && luminance > 0.5;
}

/**
 * Calculates the luminance of a color and returns either black or white for optimal contrast.
 * @param hexColor The hexadecimal color string (e.g., "#RRGGBB" or "#RGB").
 * @returns "black" or "white".
 */
export function getContrastTextColor(hexColor: string): 'black' | 'white' {
  const luminance = getColorLuminance(hexColor);
  return luminance === null || luminance > 0.5 ? 'black' : 'white';
}
