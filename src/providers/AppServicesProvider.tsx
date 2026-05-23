import type { PropsWithChildren } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, spacing } from '@/src/shared/theme';
import {
  createBootstrapErrorRepositories,
  createStorageServices,
  type AppRepositories,
} from '@/src/storage';

type AppServicesContextValue = {
  status: 'loading' | 'ready' | 'error';
  repositories: AppRepositories;
  error: Error | null;
};

const AppServicesContext = createContext<AppServicesContextValue | null>(null);

export function AppServicesProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AppServicesContextValue['status']>('loading');
  const [repositories, setRepositories] = useState<AppRepositories>(createBootstrapErrorRepositories());
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    createStorageServices()
      .then((services) => {
        if (cancelled) {
          return;
        }

        setRepositories(services.repositories);
        setStatus('ready');
      })
      .catch((reason: unknown) => {
        if (cancelled) {
          return;
        }

        setError(reason instanceof Error ? reason : new Error('Nie udało się uruchomić warstwy danych.'));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      status,
      repositories,
      error,
    }),
    [error, repositories, status],
  );

  if (status === 'loading') {
    return (
      <View style={styles.stateScreen}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.stateText}>Uruchamiam lokalną bazę danych...</Text>
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.stateScreen}>
        <Text style={styles.errorTitle}>Błąd startu aplikacji</Text>
        <Text style={styles.stateText}>{error?.message ?? 'Nieznany błąd warstwy danych.'}</Text>
      </View>
    );
  }

  return <AppServicesContext.Provider value={value}>{children}</AppServicesContext.Provider>;
}

export function useAppServices() {
  const context = useContext(AppServicesContext);

  if (!context) {
    throw new Error('useAppServices musi być użyty wewnątrz AppServicesProvider.');
  }

  return context;
}

const styles = StyleSheet.create({
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
  errorTitle: {
    color: colors.danger,
    fontSize: 20,
    fontWeight: '700',
  },
});
