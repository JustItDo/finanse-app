import { PlaceholderScreen } from '@/src/shared/ui';

export function AddTransactionScreen() {
  return (
    <PlaceholderScreen
      title="Dodaj transakcję"
      description="Najważniejszy flow MVP. Ten ekran jest przygotowany pod szybkie dodawanie wydatku lub przychodu z minimalną liczbą pól."
      sections={[
        'Formularz kwoty, kategorii i daty',
        'Przełącznik wydatek / przychód',
        'Miejsce na późniejsze wejście OCR',
      ]}
      ctaLabel="Zapisz szkic UI"
    />
  );
}
