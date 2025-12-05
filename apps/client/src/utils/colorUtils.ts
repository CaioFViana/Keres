export function isValidHexColor(hex: string): boolean {
  // Regex to check for valid hex color codes: #RGB, #RRGGBB, #RGBA, #RRGGBBAA
  return /^#([A-Fa-f0-9]{3,4}){1,2}$/.test(hex);
}

/**
 * Calculates the luminance of a color and returns either black or white for optimal contrast.
 * @param hexColor The hexadecimal color string (e.g., "#RRGGBB" or "#RGB").
 * @returns "black" or "white".
 */
export function getContrastTextColor(hexColor: string): 'black' | 'white' {
  // Remove "#" and expand shorthand hex codes (e.g., #F00 to #FF0000)
  const hex = hexColor.startsWith('#') ? hexColor.slice(1) : hexColor;
  let r, g, b;

  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length >= 6) { // Also handles 8 digit hex (RGBA), just takes RGB part
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else {
    // If not a valid hex, default to black text (or throw error, depends on desired behavior)
    // For now, assume it's dark to suggest white text, or light to suggest black text.
    // A robust solution might involve returning a default contrast color for invalid input.
    return 'black'; // Fallback
  }

  // Calculate luminance (per ITU-R BT.709)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

  // Use a threshold (typically 0.179 or 0.5, depends on preference)
  return luminance > 0.5 ? 'black' : 'white';
}