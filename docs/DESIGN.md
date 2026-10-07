# MacroHall design system

MacroHall mixes Instagram and Hinge:

- **Hinge:** warm cream surfaces, big rounded cards, Macrohall-green pill buttons, lots of space.
- **Instagram:** icon-only tab bar, story rings for friends who are out right now, a heart on everything you can favorite, DM-style chat, real profile pictures with a default silhouette.

The base style looks the same at every school. Each school then adds a light tint of its own colors on top.

Everything lives in `CollegeMacro-mobile/theme/` (tokens and school tint) and `CollegeMacro-mobile/components/kit/` (components). Screens compose the kit instead of writing their own colors and sizes.

## Brand

- **Logo:** `assets/images/macrohall-logo.png`, plus `macrohall-logo-dark.png` for dark mode. It appears in the Home header and on the landing page.
- **Font:** Manrope only. Hierarchy comes from size and weight, never a second typeface.

## Tokens (`theme/tokens.js`)

| Token | Light | Use |
|---|---|---|
| `bg` | `#F7F4EF` cream | Every screen background |
| `surface` | `#FFFFFF` | Cards (with one soft shadow) |
| `sunken` | `#EFEBE4` | Inputs, chips, tracks, secondary buttons, food thumbnails |
| `ink` | `#1B1A17` | Text and icons |
| `muted` | `#6B675F` | Secondary text (AA on bg and surface) |
| `faint` | `#A39E95` | Placeholders and disabled only, never body text |
| `primary` / `onPrimary` | `#1F5A43` Macrohall green / white | Primary buttons, active chips, the hero card, your chat bubbles |
| `accent` | `#BD3A20` tomato (AA on every light surface) | Small accent: hearts, live, links, "best match", destructive |
| `protein` / `carbs` / `fat` | coral / amber / slate blue | Macro data only |

Dark mode has its own values for the same names. Read colors with `const { c } = useAppTheme()`; never hard-code hex in a screen.

## School tint (`theme/school.js`)

Every school in `CollegeMacro-backend/src/config/schoolColors.js` has an official primary and secondary color, stored on `schools.primary_color` and `schools.secondary_color`. `useAppTheme()` adds these colors for the signed-in student's school:

| Token | What it is | Where it shows |
|---|---|---|
| `school` | The primary color, darkened (light mode) or lightened (dark mode) until it reads at 3:1 on cards | Calorie ring, active tab icon, active dining-hall tile, today's ring on the calendar |
| `onSchool` | White or ink, whichever reads better on `school` | Text and icons on `school` fills |
| `schoolSoft` | A pale wash of `school` on the background | School badge, profile panels without a photo |
| `schoolAlt` | The secondary color, as is | The dot in the school badge |

Keep the tint light. Primary buttons, cards, type and layout stay Macrohall at every school. Use `<SchoolBadge />` to show the school name in its colors.

**Type** (Manrope): `display` (34 extrabold), `h1` (28 extrabold), `h2` (22 bold), `title` (17 bold), `body` (16), `bodyStrong`, `small` (14), `caption` (12), `overline` (11 caps), `number` (20 extrabold, tabular). Keep it to three sizes per component.

**Spacing:** `space` = 4, 8, 12, 16, 24, 32, 48. Screen padding is 16. The gap between cards is 16. Card padding is 20.

**Radius:** `radius.md` 16 for inputs, `radius.lg` 24 for cards, `pill` for buttons and chips.

**Elevation:** one soft shadow on surface cards (`elevation(c)`), none in dark mode. No borders.

**Motion:** keep it short and eased-out, with no bounce. Lists enter with `FadeIn` (staggered by `index`). Numbers count up with `NumberTicker`. Rings sweep with `MacroRing`. Hearts pop.

## Components (`components/kit`)

| Component | What it is |
|---|---|
| `Txt variant tone` | All text. Tones: ink, muted, faint, accent, inverse, positive |
| `Screen` | Scrolling page on `bg` with 16 padding and 16 gaps; `refreshing`/`onRefresh` for pull-to-refresh; `scroll={false}` for fixed layouts |
| `Card tone` | `surface` (default), `sunken`, or `primary` (the green hero card; `ink` is an alias) |
| `Button variant size icon loading` | `primary` (green pill, **one per screen**), `secondary` (sunken), `accent` (coral, rare), `ghost`. Sizes `sm` 36, `md` 48, `lg` 56 |
| `IconButton name label` | 44pt round icon (Ionicons); `tone="filled"` for a sunken disc; `badge` count |
| `Chip label active icon` / `ChipRow` | Filters and choices; ChipRow scrolls horizontally |
| `Segmented options value onChange` | Two to five mutually exclusive options |
| `SectionHeader title action onAction` | Title plus an accent text link |
| `TextField label hint error icon` | Sunken input with a visible label |
| `Row leading title subtitle trailing onPress` | List rows (DMs, settings, people) |
| `ProgressBar value color` | Thin track |
| `EmptyState icon title body action` | Every empty list gets one |
| `FadeIn index` | Entrance animation |
| `NumberTicker value` | Animated count |
| `MacroRing progress size stroke color` | Animated ring with centered children |
| `LiveDot` | Pulsing coral dot for live data |
| `Avatar path uri size live ring` | Profile photo from `profiles.avatar_path`, or the default silhouette; `live` = Instagram gradient story ring (at a hall or gym now) |
| `DefaultAvatar size` | The standard "no photo yet" picture |
| `FoodThumb glyph size` | A food emoji on a soft tile (`utils/foodGlyph.js`), standing in for dish photos |
| `SchoolBadge` | The student's school name in its colors |
| `StoryBubble` | Avatar plus name and caption for the stories strip |
| `HeartButton active onPress label` | Instagram heart |
| `ProfilePanel path name subtitle live` | Hinge's big rounded photo card: the photo with the name over a dark fade, or the default silhouette on the school tint |
| `PromptCard label answer footer liked onLike` | Hinge prompt with an optional heart |

Icons are Ionicons (`@expo/vector-icons`), outline by default and filled when active. Emoji appear only as food thumbnails, never as UI icons or heading decoration.

## Rules

1. One primary (green) button per screen. Everything else is secondary, ghost, or a chip.
2. No borders or shadows to separate things; use space and the `bg`/`surface`/`sunken` steps.
3. Every number a student cares about (calories left, protein, streak) is big and tabular, and its label is a small caption under it.
4. Every list has an empty state that says what to do.
5. Touch targets are at least 44pt. Icon-only buttons have an `accessibilityLabel`.
6. Copy is short and plain. Use sentence case; overlines are the only all-caps text.
7. The product name is **Macrohall** in the logo and MacroHall in text (not NutriNav).

## Profile photos

Photos live in the public Supabase Storage bucket `avatars`, under `<user id>/`. `profiles.avatar_path` stores the object path, never a URL. A check constraint keeps the path inside the owner's folder, and storage policies let only the owner write there. `utils/avatars.js` uploads a photo (`uploadAvatar`) and builds its URL (`avatarUrl`). Deleting an account removes the user's photos too.
