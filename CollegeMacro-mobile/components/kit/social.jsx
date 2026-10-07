// Social pieces: Instagram-style avatars with a live story ring, story
// bubbles, a double-tap heart, and Hinge-style profile panels and prompts.
import React, { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { liveGradient, radius, space, useAppTheme } from '../../theme';
import { Txt } from './primitives';

let gradientIds = 0;

// Emoji avatar on a soft wash of the person's color. `live` draws the warm
// gradient story ring (they're at a hall or gym now); `ring` draws a plain one.
export function Avatar({ emoji = '🍽️', color = '#E0452B', size = 44, live = false, ring = false }) {
  const { c } = useAppTheme();
  const id = React.useMemo(() => `live-${(gradientIds += 1)}`, []);
  const gap = size >= 56 ? 3 : 2;
  const stroke = size >= 56 ? 3 : 2;
  const outer = live || ring ? size + (gap + stroke) * 2 : size;

  return (
    <View style={{ width: outer, height: outer, alignItems: 'center', justifyContent: 'center' }}>
      {live || ring ? (
        <Svg width={outer} height={outer} style={{ position: 'absolute' }}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="1" x2="1" y2="0">
              {liveGradient.map((stop, i) => (
                <Stop key={stop} offset={i / (liveGradient.length - 1)} stopColor={stop} />
              ))}
            </LinearGradient>
          </Defs>
          <Circle cx={outer / 2} cy={outer / 2} r={(outer - stroke) / 2} stroke={live ? `url(#${id})` : c.hairline} strokeWidth={stroke} fill="none" />
        </Svg>
      ) : null}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
        <Txt style={{ fontSize: size * 0.48, lineHeight: size * 0.62 }}>{emoji}</Txt>
      </View>
    </View>
  );
}

// Avatar + name under it, for the stories strip.
export function StoryBubble({ emoji, color, name, caption, live, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[name, caption].filter(Boolean).join(', ')} style={{ width: 76, alignItems: 'center', gap: 6 }}>
      <Avatar emoji={emoji} color={color} size={62} live={live} ring={!live} />
      <View style={{ alignItems: 'center' }}>
        <Txt variant="caption" numberOfLines={1} style={{ maxWidth: 76 }}>
          {name}
        </Txt>
        {caption ? (
          <Txt variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: 76, fontSize: 11 }}>
            {caption}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

// Instagram's heart: pops when it becomes active.
export function HeartButton({ active, onPress, size = 22, label = 'Favorite', tone }) {
  const { c } = useAppTheme();
  const scale = useSharedValue(1);
  const first = React.useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (active) scale.value = withSequence(withTiming(1.25, { duration: 120, easing: Easing.bezier(0.5, 1, 0.89, 1) }), withTiming(1, { duration: 160 }));
  }, [active, scale]);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: !!active }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={animated}>
        <Ionicons name={active ? 'heart' : 'heart-outline'} size={size} color={active ? c.accent : tone || c.ink} />
      </Animated.View>
    </Pressable>
  );
}

// Hinge's big rounded "photo" card. Without photos, the person's emoji sits
// on a wash of their color, with their name set large in the serif.
export function ProfilePanel({ emoji, color = '#E0452B', name, subtitle, live, liveLabel, height = 360, children }) {
  const { c } = useAppTheme();
  const id = React.useMemo(() => `panel-${(gradientIds += 1)}`, []);
  return (
    <View style={{ height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: c.surface }}>
      <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.16" />
            <Stop offset="1" stopColor={color} stopOpacity="0.42" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Txt style={{ fontSize: height * 0.32, lineHeight: height * 0.4 }}>{emoji}</Txt>
      </View>
      {live ? (
        <View style={{ position: 'absolute', top: space.lg, left: space.lg, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: space.md, height: 30 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} />
          <Txt variant="caption" style={{ fontFamily: 'Manrope_700Bold' }}>{liveLabel}</Txt>
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: space.xl, gap: 2 }}>
        <Txt variant="h1" numberOfLines={1}>
          {name}
        </Txt>
        {subtitle ? <Txt variant="small" tone="muted">{subtitle}</Txt> : null}
      </View>
      {children}
    </View>
  );
}

// Hinge prompt: small label, big serif answer, optional heart in the corner.
export function PromptCard({ label, answer, footer, liked, onLike, likeLabel, children }) {
  const { c } = useAppTheme();
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: radius.lg, padding: space.xl, gap: space.sm }}>
      <Txt variant="small" style={{ fontFamily: 'Manrope_600SemiBold' }}>
        {label}
      </Txt>
      {answer ? <Txt variant="h2">{answer}</Txt> : null}
      {children}
      {footer || onLike ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs }}>
          {footer ? <Txt variant="caption" tone="muted" style={{ flex: 1 }}>{footer}</Txt> : <View />}
          {onLike ? (
            <View style={{ backgroundColor: c.bg, borderRadius: 22 }}>
              <HeartButton active={liked} onPress={onLike} label={likeLabel} />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
