export type ThemeMode = 'system' | 'light' | 'dark';
export type ThemePreference = ThemeMode;
export type ResolvedThemeMode = 'light' | 'dark';
export type PaletteId = 'neonMint' | 'electricPine' | 'signalFinance';

type ThemePaletteDefinition = {
  base: string;
  darkBackground: string;
  darkBorder: string;
  darkGoalSoft: string;
  darkPrimarySoft: string;
  darkSecondarySoft: string;
  darkSurface: string;
  darkSurfaceMuted: string;
  darkText: string;
  darkTextMuted: string;
  description: string;
  goal: string;
  lightBackground: string;
  lightBorder: string;
  lightGoalSoft: string;
  lightPrimarySoft: string;
  lightSecondarySoft: string;
  lightSurfaceMuted: string;
  lightTextMuted: string;
  name: string;
  primary: string;
  secondary: string;
  swatches: string[];
};

export const themePalettes: Record<PaletteId, ThemePaletteDefinition> = {
  neonMint: {
    base: '#102A2A',
    darkBackground: '#071616',
    darkBorder: '#28564F',
    darkGoalSoft: '#3A2A12',
    darkPrimarySoft: '#123B31',
    darkSecondarySoft: '#123B3B',
    darkSurface: '#0E2424',
    darkSurfaceMuted: '#173633',
    darkText: '#F1FFF8',
    darkTextMuted: '#A8C8BE',
    description: 'Zywa i najbardziej dopaminowa.',
    goal: '#FFB84D',
    lightBackground: '#F6FFF9',
    lightBorder: '#BDECDD',
    lightGoalSoft: '#FFF1D9',
    lightPrimarySoft: '#DFFFF0',
    lightSecondarySoft: '#DFFFF8',
    lightSurfaceMuted: '#E8FFF4',
    lightTextMuted: '#55706A',
    name: 'Neon Mint',
    primary: '#19FF8A',
    secondary: '#8AFFE0',
    swatches: ['#102A2A', '#19FF8A', '#8AFFE0', '#FFB84D'],
  },
  electricPine: {
    base: '#082F2F',
    darkBackground: '#041817',
    darkBorder: '#1D5A52',
    darkGoalSoft: '#3A310C',
    darkPrimarySoft: '#063E2C',
    darkSecondarySoft: '#05313C',
    darkSurface: '#0A2524',
    darkSurfaceMuted: '#123735',
    darkText: '#F2FFF9',
    darkTextMuted: '#A6D1C7',
    description: 'Fintechowa, mocna i nadal spokojna.',
    goal: '#FFCF33',
    lightBackground: '#F3FFF8',
    lightBorder: '#B7EBDD',
    lightGoalSoft: '#FFF4C7',
    lightPrimarySoft: '#D6FFE9',
    lightSecondarySoft: '#D9F7FF',
    lightSurfaceMuted: '#E6FFF1',
    lightTextMuted: '#486B64',
    name: 'Electric Pine',
    primary: '#00E676',
    secondary: '#00C2FF',
    swatches: ['#082F2F', '#00E676', '#00C2FF', '#FFCF33'],
  },
  signalFinance: {
    base: '#111827',
    darkBackground: '#070B12',
    darkBorder: '#29354A',
    darkGoalSoft: '#3A330A',
    darkPrimarySoft: '#0B3A2A',
    darkSecondarySoft: '#132D5C',
    darkSurface: '#101827',
    darkSurfaceMuted: '#172133',
    darkText: '#F8FAFC',
    darkTextMuted: '#AEB8C8',
    description: 'Klasyczna, finansowa i bardzo czytelna.',
    goal: '#FACC15',
    lightBackground: '#F8FAFC',
    lightBorder: '#D8E1EA',
    lightGoalSoft: '#FEF9C3',
    lightPrimarySoft: '#DCFCEB',
    lightSecondarySoft: '#DBEAFE',
    lightSurfaceMuted: '#EEF6F1',
    lightTextMuted: '#5D6878',
    name: 'Signal Finance',
    primary: '#12D576',
    secondary: '#2563EB',
    swatches: ['#111827', '#12D576', '#2563EB', '#FACC15'],
  },
};

const paletteOrder: PaletteId[] = ['neonMint', 'electricPine', 'signalFinance'];

export const themePaletteOptions = paletteOrder.map((id) => ({
  description: themePalettes[id].description,
  id,
  name: themePalettes[id].name,
  swatches: themePalettes[id].swatches,
}));

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
};

export const typography = {
  title: 28,
  subtitle: 18,
  body: 16,
  caption: 14,
};

export function createThemeColors(
  mode: ResolvedThemeMode,
  paletteId: PaletteId,
) {
  const palette = themePalettes[paletteId];

  if (mode === 'dark') {
    return {
      background: palette.darkBackground,
      surface: palette.darkSurface,
      surfaceMuted: palette.darkSurfaceMuted,
      text: palette.darkText,
      textMuted: palette.darkTextMuted,
      border: palette.darkBorder,

      brand: palette.primary,
      primary: palette.primary,
      primarySoft: palette.darkPrimarySoft,
      secondary: palette.secondary,
      secondarySoft: palette.darkSecondarySoft,
      accent: palette.secondary,
      accentSoft: palette.darkSecondarySoft,
      mint: palette.secondary,
      reward: palette.goal,
      goal: palette.goal,

      cta: palette.primary,
      ctaText: palette.base,
      success: palette.primary,
      successSoft: palette.darkPrimarySoft,
      warning: palette.goal,
      warningSoft: palette.darkGoalSoft,
      danger: '#FF7A68',
      dangerSoft: '#3A1714',
      dangerBorder: '#7A3128',
      income: palette.primary,
      incomeSoft: palette.darkPrimarySoft,
      expense: '#FF7A68',
      expenseSoft: '#3A1714',

      chartPrimary: palette.primary,
      chartSecondary: palette.secondary,
      chartTertiary: palette.goal,
      modalBackdrop: 'rgba(0, 0, 0, 0.7)',
      modeOverlay: 'rgba(0, 0, 0, 0.62)',
      lockOverlay: 'rgba(4, 12, 12, 0.97)',
    };
  }

  return {
    background: palette.lightBackground,
    surface: '#FFFFFF',
    surfaceMuted: palette.lightSurfaceMuted,
    text: palette.base,
    textMuted: palette.lightTextMuted,
    border: palette.lightBorder,

    brand: palette.base,
    primary: palette.base,
    primarySoft: palette.lightPrimarySoft,
    secondary: palette.secondary,
    secondarySoft: palette.lightSecondarySoft,
    accent: palette.primary,
    accentSoft: palette.lightPrimarySoft,
    mint: palette.secondary,
    reward: palette.goal,
    goal: palette.goal,

    cta: palette.base,
    ctaText: palette.primary,
    success: palette.primary,
    successSoft: palette.lightPrimarySoft,
    warning: palette.goal,
    warningSoft: palette.lightGoalSoft,
    danger: '#D64A3A',
    dangerSoft: '#FFE9E4',
    dangerBorder: '#FFC2B8',
    income: palette.primary,
    incomeSoft: palette.lightPrimarySoft,
    expense: '#D64A3A',
    expenseSoft: '#FFE9E4',

    chartPrimary: palette.primary,
    chartSecondary: palette.secondary,
    chartTertiary: palette.goal,
    modalBackdrop: 'rgba(16, 42, 42, 0.42)',
    modeOverlay: 'rgba(16, 42, 42, 0.45)',
    lockOverlay: 'rgba(16, 42, 42, 0.96)',
  };
}

export type AppThemeColors = ReturnType<typeof createThemeColors>;

export type AppTheme = {
  colors: AppThemeColors;
  mode: ResolvedThemeMode;
  paletteId: PaletteId;
  radius: typeof radius;
  spacing: typeof spacing;
  typography: typeof typography;
};

export function createTheme({
  mode,
  paletteId,
}: {
  mode: ResolvedThemeMode;
  paletteId: PaletteId;
}): AppTheme {
  return {
    colors: createThemeColors(mode, paletteId),
    mode,
    paletteId,
    radius,
    spacing,
    typography,
  };
}

export const lightColors = createThemeColors('light', 'neonMint');
export const darkColors = createThemeColors('dark', 'neonMint');
export const lightTheme = createTheme({
  mode: 'light',
  paletteId: 'neonMint',
});
export const darkTheme = createTheme({
  mode: 'dark',
  paletteId: 'neonMint',
});

export const colors = lightTheme.colors;
