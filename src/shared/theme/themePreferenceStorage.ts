import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { PaletteId, ThemeMode } from '@/src/shared/theme';

const LEGACY_THEME_PREFERENCE_KEY = 'zenifi_theme_preference';
const THEME_MODE_KEY = 'zenifi_theme_mode';
const THEME_PALETTE_KEY = 'zenifi_theme_palette_id';

export type StoredThemeSettings = {
  paletteId: PaletteId;
  themeMode: ThemeMode;
};

function canUseLocalStorage() {
  return (
    typeof globalThis !== 'undefined' &&
    'localStorage' in globalThis &&
    globalThis.localStorage !== null
  );
}

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

function isPaletteId(value: string | null): value is PaletteId {
  return (
    value === 'neonMint' ||
    value === 'electricPine' ||
    value === 'signalFinance'
  );
}

async function getStoredValue(key: string) {
  if (Platform.OS === 'web' && canUseLocalStorage()) {
    return globalThis.localStorage.getItem(key);
  }

  return SecureStore.getItemAsync(key);
}

async function setStoredValue(key: string, value: string) {
  if (Platform.OS === 'web' && canUseLocalStorage()) {
    globalThis.localStorage.setItem(key, value);
    return;
  }

  await SecureStore.setItemAsync(key, value);
}

export async function loadThemeSettings(): Promise<StoredThemeSettings> {
  try {
    const [storedThemeMode, legacyThemeMode, storedPaletteId] =
      await Promise.all([
        getStoredValue(THEME_MODE_KEY),
        getStoredValue(LEGACY_THEME_PREFERENCE_KEY),
        getStoredValue(THEME_PALETTE_KEY),
      ]);

    return {
      paletteId: isPaletteId(storedPaletteId) ? storedPaletteId : 'neonMint',
      themeMode: isThemeMode(storedThemeMode)
        ? storedThemeMode
        : isThemeMode(legacyThemeMode)
          ? legacyThemeMode
          : 'system',
    };
  } catch {
    return {
      paletteId: 'neonMint',
      themeMode: 'system',
    };
  }
}

export async function saveThemeMode(themeMode: ThemeMode) {
  await setStoredValue(THEME_MODE_KEY, themeMode);
}

export async function savePaletteId(paletteId: PaletteId) {
  await setStoredValue(THEME_PALETTE_KEY, paletteId);
}
