// MacroHall design tokens. Warm, editorial surfaces (Hinge) with a social,
// photo-first rhythm (Instagram). One accent color; the warm gradient is
// reserved for "live" rings (a friend at a hall or gym right now).

export const palettes = {
  light: {
    bg: '#F7F4EF',
    surface: '#FFFFFF',
    sunken: '#EFEBE4',
    ink: '#1B1A17',
    muted: '#6B675F',
    faint: '#A39E95',
    hairline: 'rgba(27,26,23,0.09)',
    accent: '#BD3A20', // AA (4.5:1+) on bg, surface, sunken and accentSoft
    accentSoft: '#FBE5DF',
    inverse: '#FFFFFF',
    overlay: 'rgba(15,14,12,0.45)',
    protein: '#E0452B',
    carbs: '#D99528',
    fat: '#5468C9',
    positive: '#2E8A57',
  },
  dark: {
    bg: '#0F0E0C',
    surface: '#1A1916',
    sunken: '#26241F',
    ink: '#F3EFE8',
    muted: '#A39D93',
    faint: '#6E695F',
    hairline: 'rgba(243,239,232,0.09)',
    accent: '#FF6A4D',
    accentSoft: '#3A1E17',
    inverse: '#0F0E0C',
    overlay: 'rgba(0,0,0,0.6)',
    protein: '#FF6A4D',
    carbs: '#EBAA45',
    fat: '#7C8FE8',
    positive: '#4FB57D',
  },
};

// Instagram-style story ring, warm end of the spectrum.
export const liveGradient = ['#FDBA4D', '#F57A3A', '#E0452B', '#C92F72'];

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };

export const fonts = {
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

// Serif for display and Hinge-style prompt answers; Manrope for UI.
export const type = {
  display: { fontFamily: fonts.serif, fontSize: 44, lineHeight: 48, letterSpacing: -0.6 },
  h1: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 38, letterSpacing: -0.4 },
  h2: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 31, letterSpacing: -0.2 },
  title: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
  number: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
};

export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  stagger: 55,
};
