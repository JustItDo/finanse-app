import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, spacing } from '@/src/shared/theme';

type AppButtonProps = {
  label: string;
  onPress?: () => void;
};

export function AppButton({ label, onPress }: AppButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  label: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
});
