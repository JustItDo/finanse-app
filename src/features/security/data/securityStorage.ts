import { Platform } from 'react-native';

import * as SecureStore from 'expo-secure-store';

import {
  createDefaultSecuritySettings,
  type SecuritySettings,
} from '@/src/features/security/data/security';

const SECURITY_SETTINGS_KEY = 'security_settings';
const SECURITY_PIN_KEY = 'security_pin';
const WEB_SECURITY_PREFIX = 'finansowy_copilot_security';

type StoredSecuritySettings = {
  biometricEnabled?: boolean;
  autoLockOnResume?: boolean;
};

function canUseLocalStorage() {
  return (
    typeof globalThis !== 'undefined' &&
    'localStorage' in globalThis &&
    globalThis.localStorage !== null
  );
}

function getWebStorageKey(key: string) {
  return `${WEB_SECURITY_PREFIX}:${key}`;
}

async function readItem(key: string) {
  if (Platform.OS === 'web') {
    return canUseLocalStorage()
      ? globalThis.localStorage.getItem(getWebStorageKey(key))
      : null;
  }

  return SecureStore.getItemAsync(key);
}

async function writeItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    if (canUseLocalStorage()) {
      globalThis.localStorage.setItem(getWebStorageKey(key), value);
    }

    return;
  }

  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    if (canUseLocalStorage()) {
      globalThis.localStorage.removeItem(getWebStorageKey(key));
    }

    return;
  }

  await SecureStore.deleteItemAsync(key);
}

export async function loadSecuritySettings(): Promise<SecuritySettings> {
  const [rawSettings, pin] = await Promise.all([
    readItem(SECURITY_SETTINGS_KEY),
    readItem(SECURITY_PIN_KEY),
  ]);
  const defaults = createDefaultSecuritySettings();

  if (!rawSettings) {
    return {
      ...defaults,
      hasPin: Boolean(pin),
    };
  }

  const parsed = JSON.parse(rawSettings) as StoredSecuritySettings;

  return {
    autoLockOnResume: parsed.autoLockOnResume ?? defaults.autoLockOnResume,
    biometricEnabled: parsed.biometricEnabled ?? defaults.biometricEnabled,
    hasPin: Boolean(pin),
  };
}

export async function saveSecuritySettings(
  settings: Omit<SecuritySettings, 'hasPin'>,
) {
  await writeItem(
    SECURITY_SETTINGS_KEY,
    JSON.stringify({
      autoLockOnResume: settings.autoLockOnResume,
      biometricEnabled: settings.biometricEnabled,
    } satisfies StoredSecuritySettings),
  );
}

export async function getStoredPin() {
  return readItem(SECURITY_PIN_KEY);
}

export async function savePin(pin: string) {
  await writeItem(SECURITY_PIN_KEY, pin);
}

export async function clearSecurity() {
  await Promise.all([
    deleteItem(SECURITY_PIN_KEY),
    deleteItem(SECURITY_SETTINGS_KEY),
  ]);
}
