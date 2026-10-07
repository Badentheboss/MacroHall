# MacroHall design system

MacroHall should feel like a mix of Instagram and Hinge:

- **Hinge:** warm cream surfaces, big rounded cards, a serif for headlines and prompt answers, black pill buttons, lots of space.
- **Instagram:** icon-only tab bar, story rings for friends who are out right now, a heart on everything you can favorite, DM-style chat.

Everything lives in `CollegeMacro-mobile/theme/` (tokens) and `CollegeMacro-mobile/components/kit/` (components). Screens compose the kit instead of writing their own colors and sizes.

## Tokens (`theme/tokens.js`)

| Token | Light | Use |
|---|---|---|
| `bg` | `#F7F4EF` cream | Every screen background |
| `surface` | `#FFFFFF` | Cards |
| `sunken` | `#EFEBE4` | Inputs, chips, tracks, secondary buttons |
| `ink` | `#1B1A17` | Text, primary buttons, active chips, icons |
| `muted` | `#6B675F` | Secondary text (AA on bg and surface) |
| `faint` | `#A39E95` | Placeholders and disabled only, never body text |
| `hairline` | 9% ink | The rare divider |
| `accent` | `#BD3A20` tomato (AA on every light surface) | The one accent: hearts, live, links, "best match", destructive |
| `protein` / `carbs` / `fat` | coral / amber / slate blue | Macro data only |

Dark mode has its own values for the same names. Read colors with `const { c } = useAppTheme()`; never hard-code hex in a screen. The old green `#32745f` is gone.

**Type:** Instrument Serif for `display` (44), `h1` (34) and `h2` (26): screen titles, names, big numbers in prose, and Hinge prompt answers. Manrope for everything else: `title` (17 bold), `body` (16), `bodyStrong`, `small` (14), `caption` (12), `overline` (11 caps), and `number` (20 extrabold, tabular). Keep it to three sizes per component.

**Spacing:** `space` = 4, 8, 12, 16, 24, 32, 48. Screen padding is 16. The gap between cards is 16. Card padding is 20.

**Radius:** `radius.md` 16 for inputs, `radius.lg` 24 for cards, `pill` for buttons and chips.

**Elevation:** none. Cards are white on cream, with no borders and no shadows.

**Motion:** keep it short and eased-out, with no bounce. Lists enter with `FadeIn` (staggered by `index`). Numbers count up with `NumberTicker`. Rings sweep with `MacroRing`. Hearts pop.

## Components (`components/kit`)

| Component | What it is |
|---|---|
| `Txt variant tone` | All text. Tones: ink, muted, faint, accent, inverse, positive |
| `Screen` | Scrolling page on `bg` with 16 padding and 16 gaps; `refreshing`/`onRefresh` for pull-to-refresh; `scroll={false}` for fixed layouts |
| `Card tone` | `surface` (default), `sunken`, or `ink` (the dark hero card) |
| `Button variant size icon loading` | `primary` (ink pill, **one per screen**), `secondary` (sunken), `accent` (coral, rare), `ghost`. Sizes `sm` 36, `md` 48, `lg` 56 |
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
| `Avatar emoji color size live ring` | `live` = Instagram gradient story ring (at a hall or gym now) |
| `StoryBubble` | Avatar plus name and caption for the stories strip |
| `HeartButton active onPress label` | Instagram heart |
| `ProfilePanel` | Hinge's big rounded photo card (emoji on a wash of the person's color, serif name) |
| `PromptCard label answer footer liked onLike` | Hinge prompt with an optional heart |

Icons are Ionicons (`@expo/vector-icons`), outline by default and filled when active. Emoji are content (user avatars), never UI icons or heading decoration.

## Rules

1. One primary (ink) button per screen. Everything else is secondary, ghost, or a chip.
2. No borders or shadows to separate things; use space and the `bg`/`surface`/`sunken` steps.
3. Every number a student cares about (calories left, protein, streak) is big and tabular, and its label is a small caption under it.
4. Every list has an empty state that says what to do.
5. Touch targets are at least 44pt. Icon-only buttons have an `accessibilityLabel`.
6. Copy is short and plain. Use sentence case; overlines are the only all-caps text.
7. The product name is **MacroHall** (not NutriNav).
