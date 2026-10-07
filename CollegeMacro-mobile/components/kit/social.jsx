// Social pieces: Instagram-style avatars with a live story ring, story
// bubbles, a double-tap heart, and Hinge-style profile panels and prompts.
import React, { useEffect } from 'react';
import { Image, Pressable, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { liveGradient, radius, space, useAppTheme } from '../../theme';
import { Txt } from './primitives';
import { avatarUrl } from '../../utils/avatars';

let gradientIds = 0;

// The standard "no photo yet" picture: a person silhouette on a gray disc.
export function DefaultAvatar({ size = 44 }) {
  const { c, isDark } = useAppTheme();
  const disc = isDark ? '#3A3732' : '#DCD7CF';
  const figure = isDark ? '#6E695F' : '#F7F4EF';
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      <Circle cx="20" cy="20" r="20" fill={disc} />
      <Circle cx="20" cy="15.5" r="7" fill={figure} />
      <Path d="M6.5 34.5c2.4-6.1 7.6-9.5 13.5-9.5s11.1 3.4 13.5 9.5A19.9 19.9 0 0 1 20 40a19.9 19.9 0 0 1-13.5-5.5z" fill={figure} />
    </Svg>
  );
}

// Profile picture: the person's photo, or the default silhouette when they
// haven't set one. `live` draws the warm story ring (at a hall or gym now);
// `ring` draws a plain hairline one. Pass `path` (profiles.avatar_path) or `uri`.
export function Avatar({ path, uri, size = 44, live = false, ring = false }) {
  const { c } = useAppTheme();
  const id = React.useMemo(() => `live-${(gradientIds += 1)}`, []);
  const [failed, setFailed] = React.useState(false);
  const source = uri || avatarUrl(path);
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
      {source && !failed ? (
        <Image source={{ uri: source }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.sunken }} accessibilityIgnoresInvertColors />
      ) : (
        <DefaultAvatar size={size} />
      )}
    </View>
  );
}

// Avatar + name under it, for the stories strip.
export function StoryBubble({ path, uri, name, caption, live, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={[name, caption].filter(Boolean).join(', ')} style={{ width: 76, alignItems: 'center', gap: 6 }}>
      <Avatar path={path} uri={uri} size={62} live={live} ring={!live} />
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

// Hinge's big rounded photo card: the person's photo with their name over a
// soft dark fade, or the default silhouette on the school's tint.
export function ProfilePanel({ path, uri, name, subtitle, live, liveLabel, height = 360, children }) {
  const { c } = useAppTheme();
  const id = React.useMemo(() => `panel-${(gradientIds += 1)}`, []);
  const [failed, setFailed] = React.useState(false);
  const source = uri || avatarUrl(path);
  const photo = Boolean(source) && !failed;
  return (
    <View style={{ height, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: photo ? c.sunken : c.schoolSoft }}>
      {photo ? (
        <>
          <Image source={{ uri: source }} onError={() => setFailed(true)} resizeMode="cover" style={{ position: 'absolute', width: '100%', height: '100%' }} accessibilityIgnoresInvertColors />
          <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.5" stopColor="#000000" stopOpacity="0" />
                <Stop offset="1" stopColor="#000000" stopOpacity="0.55" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill={`url(#${id})`} />
          </Svg>
        </>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: height * 0.12 }}>
          <DefaultAvatar size={Math.round(height * 0.42)} />
        </View>
      )}
      {live ? (
        <View style={{ position: 'absolute', top: space.lg, left: space.lg, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderRadius: radius.pill, paddingHorizontal: space.md, height: 30 }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent }} />
          <Txt variant="caption" style={{ fontFamily: 'Manrope_700Bold' }}>{liveLabel}</Txt>
        </View>
      ) : null}
      <View style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: space.xl, gap: 2 }}>
        <Txt variant="h1" numberOfLines={1} color={photo ? '#FFFFFF' : undefined}>
          {name}
        </Txt>
        {subtitle ? (
          <Txt variant="small" tone="muted" color={photo ? 'rgba(255,255,255,0.85)' : undefined}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

// Hinge prompt: small label, big answer, optional heart in the corner.
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
