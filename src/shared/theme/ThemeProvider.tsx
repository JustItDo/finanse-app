import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  createTheme,
  type AppTheme,
  type AppThemeColors,
  type PaletteId,
  type ResolvedThemeMode,
  type ThemeMode,
} from '@/src/shared/theme';
import {
  loadThemeSettings,
  savePaletteId,
  saveThemeMode,
} from '@/src/shared/theme/themePreferenceStorage';

type ThemeContextValue = {
  colors: AppThemeColors;
  isLoadingPreference: boolean;
  paletteId: PaletteId;
  resolvedMode: ResolvedThemeMode;
  setPaletteId: (nextPaletteId: PaletteId) => Promise<void>;
  setThemeMode: (nextThemeMode: ThemeMode) => Promise<void>;
  theme: AppTheme;
  themeMode: ThemeMode;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveThemeMode(
  themeMode: ThemeMode,
  systemColorScheme: ReturnType<typeof useColorScheme>,
): ResolvedThemeMode {
  if (themeMode === 'dark') {
    return 'dark';
  }

  if (themeMode === 'light') {
    return 'light';
  }

  return systemColorScheme === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [paletteId, setPaletteIdState] = useState<PaletteId>('neonMint');
  const [isLoadingPreference, setIsLoadingPreference] = useState(true);

  useEffect(() => {
    let cancelled = false;

    loadThemeSettings()
      .then((storedSettings) => {
        if (!cancelled) {
          setThemeModeState(storedSettings.themeMode);
          setPaletteIdState(storedSettings.paletteId);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingPreference(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeMode = useCallback(async (nextThemeMode: ThemeMode) => {
    setThemeModeState(nextThemeMode);
    await saveThemeMode(nextThemeMode);
  }, []);

  const setPaletteId = useCallback(async (nextPaletteId: PaletteId) => {
    setPaletteIdState(nextPaletteId);
    await savePaletteId(nextPaletteId);
  }, []);

  const resolvedMode = resolveThemeMode(themeMode, systemColorScheme);
  const theme = useMemo(
    () => createTheme({ mode: resolvedMode, paletteId }),
    [paletteId, resolvedMode],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: theme.colors,
      isLoadingPreference,
      paletteId,
      resolvedMode,
      setPaletteId,
      setThemeMode,
      theme,
      themeMode,
    }),
    [
      isLoadingPreference,
      paletteId,
      resolvedMode,
      setPaletteId,
      setThemeMode,
      theme,
      themeMode,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);

  if (!value) {
    throw new Error('useTheme must be used inside ThemeProvider.');
  }

  return value;
}

export function useThemeStyles<T>(createStyles: (colors: AppThemeColors) => T) {
  const { colors } = useTheme();

  return useMemo(() => createStyles(colors), [colors, createStyles]);
}
