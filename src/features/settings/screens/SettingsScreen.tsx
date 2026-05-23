import { PlaceholderScreen } from '@/src/shared/ui';

export function SettingsScreen() {
  return (
    <PlaceholderScreen
      title="Ustawienia"
      description="Na tym etapie ekran służy jako miejsce na ustawienia aplikacji, motywu i przyszłe opcje danych lokalnych."
      sections={[
        'Preferencje waluty i języka',
        'Opcje danych lokalnych',
        'Informacje o wersji aplikacji',
      ]}
    />
  );
}
