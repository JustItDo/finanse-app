import { FontAwesome5 } from '@expo/vector-icons';

export type CategoryIconName = Extract<
  keyof typeof FontAwesome5.glyphMap,
  string
>;

export const CATEGORY_ICON_OPTIONS: {
  key: CategoryIconName;
  label: string;
}[] = [
  { key: 'shopping-basket', label: 'Zakupy' },
  { key: 'utensils', label: 'Jedzenie' },
  { key: 'bus', label: 'Transport' },
  { key: 'car', label: 'Auto' },
  { key: 'home', label: 'Dom' },
  { key: 'heartbeat', label: 'Zdrowie' },
  { key: 'film', label: 'Rozrywka' },
  { key: 'graduation-cap', label: 'Nauka' },
  { key: 'paw', label: 'Zwierzęta' },
  { key: 'tshirt', label: 'Ubrania' },
  { key: 'gift', label: 'Prezenty' },
  { key: 'money-bill-wave', label: 'Pensja' },
  { key: 'coins', label: 'Wpływy' },
  { key: 'receipt', label: 'Inne' },
];
