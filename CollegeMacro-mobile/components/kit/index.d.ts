// Loose types so .tsx screens can use the JS design kit; props are documented
// in the component files.
import type { FC } from 'react';

type Props = Record<string, any>;

export const Txt: FC<Props>;
export const Screen: FC<Props>;
export const Card: FC<Props>;
export const Tap: FC<Props>;
export const Button: FC<Props>;
export const IconButton: FC<Props>;
export const Chip: FC<Props>;
export const ChipRow: FC<Props>;
export const Segmented: FC<Props>;
export const SectionHeader: FC<Props>;
export const TextField: FC<Props>;
export const ProgressBar: FC<Props>;
export const EmptyState: FC<Props>;
export const Divider: FC<Props>;
export const Row: FC<Props>;
export const FadeIn: FC<Props>;
export const NumberTicker: FC<Props>;
export const MacroRing: FC<Props>;
export const LiveDot: FC<Props>;
export const Avatar: FC<Props>;
export const StoryBubble: FC<Props>;
export const HeartButton: FC<Props>;
export const ProfilePanel: FC<Props>;
export const PromptCard: FC<Props>;
