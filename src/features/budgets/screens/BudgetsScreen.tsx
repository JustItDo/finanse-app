import { PlaceholderScreen } from '@/src/shared/ui';

export function BudgetsScreen() {
  return (
    <PlaceholderScreen
      title="Budżety"
      description="Ekran przygotowany pod miesięczne budżety kategorii i szybki wgląd w to, ile zostało do końca miesiąca."
      sections={[
        'Lista kategorii z limitem',
        'Postęp wykorzystania budżetu',
        'Stan całego miesiąca',
      ]}
    />
  );
}
