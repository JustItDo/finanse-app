import { PlaceholderScreen } from '@/src/shared/ui';

export function HistoryScreen() {
  return (
    <PlaceholderScreen
      title="Historia"
      description="Tu pojawi się lista transakcji z filtrowaniem i szybkim wejściem do szczegółu lub edycji."
      sections={[
        'Lista ostatnich transakcji',
        'Filtry po miesiącu i kategorii',
        'Późniejsza edycja i usuwanie',
      ]}
    />
  );
}
