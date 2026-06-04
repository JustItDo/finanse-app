import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_PREFIX = 'zenifi_collapsible_section';

function getStorageKey(screenId: string, sectionId: string) {
  return `${STORAGE_PREFIX}:${screenId}:${sectionId}`;
}

function canUseLocalStorage() {
  return (
    typeof globalThis !== 'undefined' &&
    'localStorage' in globalThis &&
    globalThis.localStorage !== null
  );
}

export async function readCollapsibleSectionState(
  screenId: string,
  sectionId: string,
) {
  const key = getStorageKey(screenId, sectionId);

  try {
    const value =
      Platform.OS === 'web' && canUseLocalStorage()
        ? globalThis.localStorage.getItem(key)
        : await SecureStore.getItemAsync(key);

    if (value === 'expanded') {
      return true;
    }

    if (value === 'collapsed') {
      return false;
    }
  } catch {
    return null;
  }

  return null;
}

export async function writeCollapsibleSectionState(
  screenId: string,
  sectionId: string,
  isExpanded: boolean,
) {
  const key = getStorageKey(screenId, sectionId);
  const value = isExpanded ? 'expanded' : 'collapsed';

  try {
    if (Platform.OS === 'web' && canUseLocalStorage()) {
      globalThis.localStorage.setItem(key, value);
      return;
    }

    await SecureStore.setItemAsync(key, value);
  } catch {
    // UI state is optional. Ignore storage failures and keep in-memory behavior.
  }
}
