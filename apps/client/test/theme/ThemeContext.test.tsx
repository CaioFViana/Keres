import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { ThemeContext, useTheme } from '../../src/theme/ThemeContext';

describe('useTheme', () => {
  it('throws outside a provider', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const Probe = () => {
        useTheme();
        return null;
      };
      // Async render surfaces render errors as a rejection, not a synchronous throw.
      await expect(render(<Probe />)).rejects.toThrow(
        'useTheme must be used within a ThemeProvider',
      );
    } finally {
      spy.mockRestore();
    }
  });

  it('returns the provided theme value', async () => {
    const value = {
      colors: { background: '#fff' },
      isDarkMode: true,
      toggleTheme: jest.fn(),
      currentThemeName: 'ocean',
      setTheme: jest.fn(),
    } as any;
    const Probe = () => {
      const theme = useTheme();
      return <Text testID="theme-name">{`${theme.currentThemeName}:${theme.isDarkMode}`}</Text>;
    };
    const screen = await render(
      <ThemeContext.Provider value={value}>
        <Probe />
      </ThemeContext.Provider>,
    );
    expect(screen.getByTestId('theme-name').props.children).toBe('ocean:true');
  });
});
