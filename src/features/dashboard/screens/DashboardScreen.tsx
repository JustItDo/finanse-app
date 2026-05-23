import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useAppServices } from '@/src/providers/AppServicesProvider';
import { spacing, typography } from '@/src/shared/theme';
import { AppCard, PlaceholderScreen } from '@/src/shared/ui';
import type { DashboardSnapshot } from '@/src/storage/sqlite/repositories/DashboardRepository';

export function DashboardScreen() {
  const { repositories, status, error } = useAppServices();
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    let cancelled = false;

    repositories.dashboard
      .getSnapshot()
      .then((result) => {
        if (!cancelled) {
          setSnapshot(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshot(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [repositories.dashboard, status]);

  return (
    <PlaceholderScreen
      title="Dashboard"
      description="Tu trafi szybki przegląd miesiąca: saldo, budżet, ostatnie transakcje i skróty do najczęstszych akcji."
      sections={[
        'Karta podsumowania miesiąca',
        'Skrót do dodania wydatku',
        'Podgląd wydatków per kategoria',
      ]}
    >
      <AppCard>
        <Text style={{ fontSize: typography.subtitle, fontWeight: '700' }}>Stan warstwy danych</Text>
        <View style={{ gap: spacing.sm }}>
          <Text>Status bootstrapu: {status}</Text>
          <Text>Wersja schematu: {snapshot?.schemaVersion ?? '...'}</Text>
          <Text>Kategorie seed: {snapshot?.categoriesCount ?? '...'}</Text>
          <Text>Budżety kategorii: {snapshot?.categoryBudgetsCount ?? '...'}</Text>
          <Text>Miesiąc budżetowy: {snapshot?.monthKey ?? '...'}</Text>
          <Text>Budżet miesięczny: {snapshot ? `${(snapshot.monthlyBudgetMinor / 100).toFixed(2)} ${snapshot.currencyCode}` : '...'}</Text>
          <Text>Integracja vault: {snapshot?.obsidianVaultRelativePath ?? '../obsidian value'}</Text>
          {error ? <Text>Błąd: {error.message}</Text> : null}
        </View>
      </AppCard>
    </PlaceholderScreen>
  );
}
