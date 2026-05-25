import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '@/src/shared/theme';
import { AppButton } from '@/src/shared/ui/AppButton';
import { AppCard } from '@/src/shared/ui/AppCard';
import { AppInput } from '@/src/shared/ui/AppInput';

type PlaceholderScreenProps = {
  title: string;
  description: string;
  sections: string[];
  ctaLabel?: string;
  children?: ReactNode;
};

export function PlaceholderScreen({
  title,
  description,
  sections,
  ctaLabel = 'Akcja przykładowa',
  children,
}: PlaceholderScreenProps) {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Zenifi</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      <AppCard>
        <Text style={styles.sectionTitle}>Bazowy komponent formularza</Text>
        <AppInput placeholder="Pole gotowe pod dalszy etap" />
        <AppButton label={ctaLabel} />
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Zakres następnego kroku</Text>
        {sections.map((section) => (
          <View key={section} style={styles.bulletRow}>
            <View style={styles.bullet} />
            <Text style={styles.bulletText}>{section}</Text>
          </View>
        ))}
      </AppCard>

      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  description: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
  },
  bulletRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  bullet: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  bulletText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.body,
  },
});
