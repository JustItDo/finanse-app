import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import * as LocalAuthentication from 'expo-local-authentication';

import {
  createDefaultSecuritySettings,
  validatePin,
  type SecurityCapabilities,
  type SecuritySettings,
} from '@/src/features/security/data/security';
import {
  clearSecurity,
  getStoredPin,
  loadSecuritySettings,
  savePin,
  saveSecuritySettings,
} from '@/src/features/security/data/securityStorage';
import { SecurityLockScreen } from '@/src/features/security/components/SecurityLockScreen';
import { colors, spacing } from '@/src/shared/theme';

type SecurityContextValue = {
  status: 'loading' | 'ready';
  settings: SecuritySettings;
  capabilities: SecurityCapabilities;
  isLocked: boolean;
  isUnlocking: boolean;
  enablePin: (pin: string, biometricEnabled: boolean) => Promise<void>;
  changePin: (currentPin: string, nextPin: string) => Promise<void>;
  disableSecurity: (pin: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometrics: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
};

const defaultCapabilities: SecurityCapabilities = {
  biometricAvailable: false,
  biometricLabel: 'biometrii',
};

const SecurityContext = createContext<SecurityContextValue | null>(null);

async function detectSecurityCapabilities(): Promise<SecurityCapabilities> {
  if (Platform.OS === 'web') {
    return defaultCapabilities;
  }

  const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ]);

  if (!hasHardware || !isEnrolled || supportedTypes.length === 0) {
    return defaultCapabilities;
  }

  if (
    supportedTypes.includes(
      LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
    )
  ) {
    return {
      biometricAvailable: true,
      biometricLabel: 'Face ID / odcisku palca',
    };
  }

  if (
    supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
  ) {
    return {
      biometricAvailable: true,
      biometricLabel: 'odcisku palca',
    };
  }

  return {
    biometricAvailable: true,
    biometricLabel: 'biometrii',
  };
}

export function SecurityProvider({ children }: PropsWithChildren) {
  const [status, setStatus] =
    useState<SecurityContextValue['status']>('loading');
  const [settings, setSettings] = useState<SecuritySettings>(
    createDefaultSecuritySettings(),
  );
  const [capabilities, setCapabilities] =
    useState<SecurityCapabilities>(defaultCapabilities);
  const [isLocked, setIsLocked] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const biometricAttemptedRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const [loadedSettings, detectedCapabilities] = await Promise.all([
        loadSecuritySettings(),
        detectSecurityCapabilities(),
      ]);

      if (cancelled) {
        return;
      }

      setSettings(loadedSettings);
      setCapabilities(detectedCapabilities);
      setIsLocked(loadedSettings.hasPin);
      setStatus('ready');
    };

    load().catch(() => {
      if (cancelled) {
        return;
      }

      setSettings(createDefaultSecuritySettings());
      setCapabilities(defaultCapabilities);
      setIsLocked(false);
      setStatus('ready');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settings.hasPin || !settings.autoLockOnResume) {
      return;
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousAppState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (previousAppState === 'active' && nextAppState !== 'active') {
        biometricAttemptedRef.current = false;
        setIsLocked(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [settings.autoLockOnResume, settings.hasPin]);

  const persistSettings = async (nextSettings: SecuritySettings) => {
    await saveSecuritySettings({
      autoLockOnResume: nextSettings.autoLockOnResume,
      biometricEnabled: nextSettings.biometricEnabled,
    });

    setSettings(nextSettings);
  };

  const unlockWithPin = useCallback(async (pin: string) => {
    if (!validatePin(pin)) {
      return false;
    }

    const storedPin = await getStoredPin();

    if (!storedPin || storedPin !== pin) {
      return false;
    }

    biometricAttemptedRef.current = true;
    setIsLocked(false);
    return true;
  }, []);

  const unlockWithBiometrics = useCallback(async () => {
    if (
      !settings.hasPin ||
      !settings.biometricEnabled ||
      !capabilities.biometricAvailable ||
      isUnlocking
    ) {
      return false;
    }

    setIsUnlocking(true);

    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Odblokuj Finansowy Copilot',
      });

      if (!result.success) {
        biometricAttemptedRef.current = true;
        return false;
      }

      biometricAttemptedRef.current = true;
      setIsLocked(false);
      return true;
    } finally {
      setIsUnlocking(false);
    }
  }, [
    capabilities.biometricAvailable,
    isUnlocking,
    settings.biometricEnabled,
    settings.hasPin,
  ]);

  useEffect(() => {
    if (
      status !== 'ready' ||
      !isLocked ||
      !settings.biometricEnabled ||
      !capabilities.biometricAvailable
    ) {
      return;
    }

    if (biometricAttemptedRef.current) {
      return;
    }

    biometricAttemptedRef.current = true;
    void unlockWithBiometrics();
  }, [
    capabilities.biometricAvailable,
    isLocked,
    settings.biometricEnabled,
    status,
    unlockWithBiometrics,
  ]);

  const enablePin = useCallback(
    async (pin: string, biometricEnabled: boolean) => {
      if (!validatePin(pin)) {
        throw new Error('PIN musi mieć dokładnie 4 cyfry.');
      }

      await savePin(pin);

      const nextSettings: SecuritySettings = {
        autoLockOnResume: true,
        biometricEnabled: biometricEnabled && capabilities.biometricAvailable,
        hasPin: true,
      };

      await persistSettings(nextSettings);
      biometricAttemptedRef.current = false;
      setIsLocked(false);
    },
    [capabilities.biometricAvailable],
  );

  const changePin = useCallback(async (currentPin: string, nextPin: string) => {
    const storedPin = await getStoredPin();

    if (!storedPin || storedPin !== currentPin) {
      throw new Error('Aktualny PIN jest nieprawidłowy.');
    }

    if (!validatePin(nextPin)) {
      throw new Error('Nowy PIN musi mieć dokładnie 4 cyfry.');
    }

    await savePin(nextPin);
  }, []);

  const disableSecurity = useCallback(async (pin: string) => {
    const storedPin = await getStoredPin();

    if (!storedPin || storedPin !== pin) {
      throw new Error('Podaj poprawny PIN, żeby wyłączyć blokadę.');
    }

    await clearSecurity();
    biometricAttemptedRef.current = false;
    setSettings(createDefaultSecuritySettings());
    setIsLocked(false);
  }, []);

  const setBiometricEnabled = useCallback(
    async (enabled: boolean) => {
      if (!settings.hasPin) {
        throw new Error('Najpierw ustaw PIN.');
      }

      if (enabled && !capabilities.biometricAvailable) {
        throw new Error(
          'To urządzenie nie ma dostępnej biometrii dla tej aplikacji.',
        );
      }

      const nextSettings: SecuritySettings = {
        ...settings,
        biometricEnabled: enabled,
      };

      await persistSettings(nextSettings);
    },
    [capabilities.biometricAvailable, settings],
  );

  if (status === 'loading') {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.stateText}>
          Przygotowuję zabezpieczenia aplikacji...
        </Text>
      </View>
    );
  }

  return (
    <SecurityContext.Provider
      value={{
        status,
        settings,
        capabilities,
        isLocked,
        isUnlocking,
        enablePin,
        changePin,
        disableSecurity,
        unlockWithPin,
        unlockWithBiometrics,
        setBiometricEnabled,
      }}
    >
      <View style={styles.container}>
        <View
          style={styles.appContent}
          accessibilityElementsHidden={isLocked}
          importantForAccessibility={isLocked ? 'no-hide-descendants' : 'auto'}
        >
          {children}
        </View>
        {isLocked ? (
          <View style={styles.lockOverlay}>
            <SecurityLockScreen
              biometricAvailable={capabilities.biometricAvailable}
              biometricEnabled={settings.biometricEnabled}
              biometricLabel={capabilities.biometricLabel}
              isUnlocking={isUnlocking}
              onUnlockWithBiometrics={unlockWithBiometrics}
              onUnlockWithPin={unlockWithPin}
            />
          </View>
        ) : null}
      </View>
    </SecurityContext.Provider>
  );
}

export function useSecurity() {
  const context = useContext(SecurityContext);

  if (!context) {
    throw new Error('useSecurity musi być użyty wewnątrz SecurityProvider.');
  }

  return context;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  appContent: {
    flex: 1,
  },
  lockOverlay: {
    ...StyleSheet.absoluteFill,
  },
  stateScreen: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  stateText: {
    color: colors.text,
    textAlign: 'center',
  },
});
