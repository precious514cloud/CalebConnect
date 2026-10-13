import { Platform } from 'react-native';

/**
 * CalebConnect Design System
 *
 * Centralized colours, typography, spacing, radius,
 * shadows and reusable visual values.
 *
 * The goal is a clean, smooth, modern Apple-inspired
 * academic experience.
 */

// ----------------------------------------------------
// COLORS
// ----------------------------------------------------

export const Colors = {
  light: {
    background: '#F5F7FB',
    surface: '#FFFFFF',
    surfaceSecondary: '#F8F9FC',

    text: '#111827',
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',

    primary: '#4F46E5',
    primaryDark: '#3730A3',
    primaryLight: '#EEF2FF',

    border: '#E5E7EB',
    borderLight: '#EEF0F4',

    success: '#16A34A',
    successLight: '#DCFCE7',

    warning: '#D97706',
    warningLight: '#FEF3C7',

    danger: '#DC2626',
    dangerLight: '#FEE2E2',

    info: '#2563EB',
    infoLight: '#DBEAFE',

    white: '#FFFFFF',
    black: '#000000',

    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#4F46E5',
  },

  dark: {
    background: '#0F1117',
    surface: '#181B23',
    surfaceSecondary: '#20242E',

    text: '#F9FAFB',
    textSecondary: '#D1D5DB',
    textMuted: '#9CA3AF',

    primary: '#6366F1',
    primaryDark: '#818CF8',
    primaryLight: '#252A55',

    border: '#2D3340',
    borderLight: '#252A33',

    success: '#22C55E',
    successLight: '#12351F',

    warning: '#F59E0B',
    warningLight: '#3A2B0A',

    danger: '#EF4444',
    dangerLight: '#3A1518',

    info: '#3B82F6',
    infoLight: '#122B4D',

    white: '#FFFFFF',
    black: '#000000',

    tabIconDefault: '#9CA3AF',
    tabIconSelected: '#818CF8',
  },
};

// ----------------------------------------------------
// FONTS
// ----------------------------------------------------

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },

  android: {
    sans: 'sans-serif',
    serif: 'serif',
    rounded: 'sans-serif',
    mono: 'monospace',
  },

  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },

  web: {
    sans:
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",

    serif:
      "Georgia, 'Times New Roman', serif",

    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",

    mono:
      "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ----------------------------------------------------
// FONT SIZES
// ----------------------------------------------------

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  display: 36,
};

// ----------------------------------------------------
// FONT WEIGHTS
// ----------------------------------------------------

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
};

// ----------------------------------------------------
// SPACING
// ----------------------------------------------------

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  section: 48,
};

// ----------------------------------------------------
// BORDER RADIUS
// ----------------------------------------------------

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 999,
};

// ----------------------------------------------------
// COMMON SHADOWS
// ----------------------------------------------------

export const Shadows = {
  small: {
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  medium: {
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  large: {
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 7,
  },
};

// ----------------------------------------------------
// COMPONENT SIZES
// ----------------------------------------------------

export const Sizes = {
  buttonHeight: 54,
  inputHeight: 54,

  iconSmall: 20,
  iconMedium: 28,
  iconLarge: 42,

  avatarSmall: 36,
  avatarMedium: 48,
  avatarLarge: 64,
};

// ----------------------------------------------------
// ANIMATION SETTINGS
// ----------------------------------------------------

export const Animation = {
  fast: 150,
  normal: 250,
  smooth: 350,
  slow: 500,
};