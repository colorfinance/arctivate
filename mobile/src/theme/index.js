export const colors = {
  background: '#030808',
  card: '#0A1414',
  surface: '#132020',
  surfaceLight: '#1A2D2D',
  primary: '#00D4AA',
  primaryDim: 'rgba(0, 212, 170, 0.15)',
  secondary: '#06B6D4',
  tertiary: '#14B8A6',
  accent: '#F97316',
  danger: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  textPrimary: '#E8F0EF',
  textSecondary: '#94B3B3',
  textMuted: '#5E7D7D',
  border: '#1A2D2D',
  borderLight: '#243838',
};

export const fonts = {
  regular: { fontSize: 14, color: colors.textPrimary },
  medium: { fontSize: 16, color: colors.textPrimary, fontWeight: '500' },
  large: { fontSize: 20, color: colors.textPrimary, fontWeight: '600' },
  title: { fontSize: 28, color: colors.textPrimary, fontWeight: '700' },
  mono: { fontSize: 14, fontFamily: 'monospace', color: colors.textPrimary },
  monoLarge: { fontSize: 24, fontFamily: 'monospace', color: colors.textPrimary, fontWeight: '700' },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};
