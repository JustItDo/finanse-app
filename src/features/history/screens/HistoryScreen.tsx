import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { useAppServices } from '@/src/providers/AppServicesProvider';
import { typography } from '@/src/shared/theme';
import { AppCard, PlaceholderScreen } from '@/src/shared/ui';
import type { TransactionListItem } from '@/src/storage/sqlite/repositories/TransactionsRepository';

export function HistoryScreen() {
  const { repositories, status } = useAppServices();
  const [recentTransactions, setRecentTransactions] = useState<TransactionListItem[]>([]);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }

    let cancelled = false;

    repositories.transactions.listRecent(5).then((items) => {
      if (!cancelled) {
        setRecentTransactions(items);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [repositories.transactions, status]);

  return (
    <PlaceholderScreen
      title="Historia"
      description="Tu pojawi się lista transakcji z filtrowaniem i szybkim wejściem do szczegółu lub edycji."
      sections={[
        'Lista ostatnich transakcji',
        'Filtry po miesiącu i kategorii',
        'Późniejsza edycja i usuwanie',
      ]}
    >
      <AppCard>
        <Text style={{ fontSize: typography.subtitle, fontWeight: '700' }}>Debug historii</Text>
        {recentTransactions.length === 0 ? (
          <Text>Brak transakcji seedowych. To oczekiwane dla update 00.2.</Text>
        ) : (
          recentTransactions.map((transaction) => (
            <Text key={transaction.id}>
              {transaction.occurredAt}: {transaction.type} {(transaction.amountMinor / 100).toFixed(2)}{' '}
              {transaction.currencyCode} / {transaction.categoryName ?? 'bez kategorii'}
            </Text>
          ))
        )}
      </AppCard>
    </PlaceholderScreen>
  );
}
