import { PlaceholderScreen } from '@/src/shared/ui';

export function DashboardScreen() {
  return (
    <PlaceholderScreen
      title="Dashboard"
      description="Tu trafi szybki przegląd miesiąca: saldo, budżet, ostatnie transakcje i skróty do najczęstszych akcji."
      sections={[
        'Karta podsumowania miesiąca',
        'Skrót do dodania wydatku',
        'Podgląd wydatków per kategoria',
      ]}
    />
  );
}
