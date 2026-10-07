// MacroHall design tokens. The base style is the same at every school: warm
// cream surfaces, Macrohall green for primary actions, one sans (Manrope).
// Each school adds a light tint on top (see theme/school.js).

export const palettes = {
  light: {
    bg: '#F7F4EF',
    surface: '#FFFFFF',
    sunken: '#EFEBE4',
    ink: '#1B1A17',
    muted: '#6B675F',
    faint: '#A39E95',
    hairline: 'rgba(27,26,23,0.09)',
    // Macrohall green, from the logo. Primary buttons, active chips, hero card.
    primary: '#1F5A43',
    onPrimary: '#FFFFFF',
    primarySoft: '#E3EEE7',
    // Small accent for hearts, live and destructive text. AA on every surface.
    accent: '#BD3A20',
    accentSoft: '#FBE5DF',
    inverse: '#FFFFFF',
    overlay: 'rgba(15,14,12,0.45)',
    protein: '#E0452B',
    carbs: '#D99528',
    fat: '#5468C9',
    positive: '#2E8A57',
    shadow: 'rgba(27,26,23,0.06)',
  },
  dark: {
    bg: '#0F0E0C',
    surface: '#1A1916',
    sunken: '#26241F',
    ink: '#F3EFE8',
    muted: '#A39D93',
    faint: '#6E695F',
    hairline: 'rgba(243,239,232,0.09)',
    primary: '#7AD6A0',
    onPrimary: '#0F1A14',
    primarySoft: '#1D2B23',
    accent: '#FF6A4D',
    accentSoft: '#3A1E17',
    inverse: '#0F0E0C',
    overlay: 'rgba(0,0,0,0.6)',
    protein: '#FF6A4D',
    carbs: '#EBAA45',
    fat: '#7C8FE8',
    positive: '#4FB57D',
    shadow: 'rgba(0,0,0,0)',
  },
};

// Instagram-style story ring, warm end of the spectrum.
export const liveGradient = ['#FDBA4D', '#F57A3A', '#E0452B', '#C92F72'];

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };

export const radius = { sm: 10, md: 16, lg: 24, xl: 32, pill: 999 };

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
};

// One family. Hierarchy comes from size and weight only.
export const type = {
  display: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.9 },
  h1: { fontFamily: fonts.extrabold, fontSize: 28, lineHeight: 34, letterSpacing: -0.7 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.4 },
  title: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' },
  number: { fontFamily: fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.4 },
};

// One soft, single-layer shadow for cards (none in dark mode).
export const elevation = (c) => ({
  shadowColor: '#1B1A17',
  shadowOpacity: c.shadow === 'rgba(0,0,0,0)' ? 0 : 0.06,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 4 },
  elevation: c.shadow === 'rgba(0,0,0,0)' ? 0 : 2,
});

export const motion = {
  fast: 160,
  base: 260,
  slow: 420,
  stagger: 55,
};
