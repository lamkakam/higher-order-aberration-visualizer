import { createTheme, useMediaQuery } from '@mui/material';
import { useMemo } from 'react';
import type { ThemeMode } from '../components';

export function useAppTheme(themeMode: ThemeMode) {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const resolvedMode = themeMode === 'system' ? (prefersDarkMode ? 'dark' : 'light') : themeMode;

  return useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,
          primary: {
            main: '#256f72'
          },
          secondary: {
            main: '#8a5a2b'
          },
          background: {
            default: resolvedMode === 'dark' ? '#101418' : '#f5f6f1'
          }
        },
        shape: {
          borderRadius: 8
        }
      }),
    [resolvedMode]
  );
}
