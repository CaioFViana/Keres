import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useTheme } from '@/src/theme';

/** Applies the active Keres theme to browser scrollbars without affecting native platforms. */
const WebScrollbarTheme = () => {
  const { colors } = useTheme();

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const styleId = 'keres-web-scrollbar-theme';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = `
      * {
        scrollbar-width: thin;
        scrollbar-color: ${colors.primaryContainer} transparent;
      }

      *::-webkit-scrollbar {
        width: 10px;
        height: 10px;
      }

      *::-webkit-scrollbar-track {
        background: transparent;
      }

      *::-webkit-scrollbar-thumb {
        background: ${colors.primaryContainer};
        background: color-mix(in srgb, ${colors.primary} 54%, ${colors.surface});
        border: 3px solid ${colors.surface};
        border-radius: 999px;
      }

      *::-webkit-scrollbar-thumb:hover {
        background: ${colors.primary};
        background: color-mix(in srgb, ${colors.primary} 76%, ${colors.surface});
      }

      *::-webkit-scrollbar-thumb:active {
        background: ${colors.primaryVariant};
      }

      *::-webkit-scrollbar-corner {
        background: transparent;
      }
    `;
  }, [colors.primary, colors.primaryContainer, colors.primaryVariant, colors.surface]);

  return null;
};

export default WebScrollbarTheme;
