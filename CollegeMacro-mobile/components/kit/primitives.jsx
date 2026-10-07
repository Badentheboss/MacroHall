// Core building blocks. Screens compose these instead of hand-rolling styles,
// so spacing, type and color stay on the scale in theme/tokens.js.
import React from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type, useAppTheme } from '../../theme';

const TONES = (c) => ({ ink: c.ink, muted: c.muted, faint: c.faint, accent: c.accent, inverse: c.inverse, positive: c.positive });

// <Txt variant="h2" tone="muted">…</Txt>. Variants: display h1 h2 title body
// bodyStrong small caption overline number.
export function Txt({ variant = 'body', tone = 'ink', color, style, ...rest }) {
  const { c } = useAppTheme();
  return <Text style={[type[variant], { color: color || TONES(c)[tone] || c.ink }, style]} {...rest} />;
}

// Scrollable page body on the warm background, with optional pull-to-refresh.
export function Screen({ children, scroll = true, refreshing, onRefresh, contentStyle, style, ...rest }) {
  const { c } = useAppTheme();
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: c.bg }, style]}>{children}</View>;
  }
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: c.bg }, style]}
      contentContainerStyle={[{ padding: space.lg, paddingBottom: space.xxxl, gap: space.lg }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.muted} /> : undefined}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

// Flat white card on the cream background: no border, no heavy shadow.
export function Card({ children, tone = 'surface', padded = true, style, ...rest }) {
  const { c } = useAppTheme();
  return (
    <View
      style={[{ backgroundColor: tone === 'sunken' ? c.sunken : tone === 'ink' ? c.ink : c.surface, borderRadius: radius.lg, padding: padded ? space.lg + 4 : 0, overflow: 'hidden' }, style]}
      {...rest}
    >
      {children}
    </View>
  );
}

// Pressable that dips slightly when touched (transform only, no layout work).
export function Tap({ children, style, onPress, disabled, scaleTo = 0.97, ...rest }) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => (scale.value = withTiming(scaleTo, { duration: 90 }))}
      onPressOut={() => (scale.value = withTiming(1, { duration: 160 }))}
      {...rest}
    >
      <Animated.View style={[animated, style, disabled && { opacity: 0.45 }]}>{children}</Animated.View>
    </Pressable>
  );
}

// Pill buttons. primary = ink (one per screen), secondary = sunken, ghost = text.
export function Button({ title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style, accessibilityLabel }) {
  const { c } = useAppTheme();
  const height = size === 'sm' ? 36 : size === 'lg' ? 56 : 48;
  const background = variant === 'primary' ? c.ink : variant === 'accent' ? c.accent : variant === 'secondary' ? c.sunken : 'transparent';
  const foreground = variant === 'primary' ? c.inverse : variant === 'accent' ? '#FFFFFF' : c.ink;
  return (
    <Tap
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      style={[
        {
          height,
          paddingHorizontal: size === 'sm' ? space.lg : space.xl,
          borderRadius: radius.pill,
          backgroundColor: background,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={foreground} /> : null}
          <Txt variant={size === 'sm' ? 'small' : 'bodyStrong'} color={foreground} style={size === 'sm' ? { fontFamily: type.bodyStrong.fontFamily } : null}>
            {title}
          </Txt>
        </>
      )}
    </Tap>
  );
}

// Round icon-only button with a 44pt touch target. Always pass a label.
export function IconButton({ name, onPress, label, size = 22, tone = 'plain', color, badge, style }) {
  const { c } = useAppTheme();
  const filled = tone === 'filled';
  return (
    <Tap onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={[{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: filled ? c.sunken : 'transparent' }, style]}>
      <Ionicons name={name} size={size} color={color || c.ink} />
      {badge ? (
        <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Txt variant="caption" color="#FFFFFF" style={{ fontSize: 10, lineHeight: 12 }}>
            {badge}
          </Txt>
        </View>
      ) : null}
    </Tap>
  );
}

// Filter/selection pill. Active = ink, inactive = sunken.
export function Chip({ label, active, onPress, icon, style }) {
  const { c } = useAppTheme();
  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[{ height: 36, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: active ? c.ink : c.sunken, flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}
    >
      {icon ? <Ionicons name={icon} size={15} color={active ? c.inverse : c.ink} /> : null}
      <Txt variant="small" color={active ? c.inverse : c.ink} style={{ fontFamily: type.bodyStrong.fontFamily }}>
        {label}
      </Txt>
    </Tap>
  );
}

// Horizontal row of chips that scrolls when it overflows.
export function ChipRow({ children, style }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ gap: space.sm, paddingRight: space.lg }, style]}>
      {children}
    </ScrollView>
  );
}

// iOS-style segmented control on a sunken track.
export function Segmented({ options, value, onChange }) {
  const { c } = useAppTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.sunken, borderRadius: radius.pill, padding: 4 }}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{ flex: 1, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: active ? c.surface : 'transparent' }}
          >
            <Txt variant="small" tone={active ? 'ink' : 'muted'} style={{ fontFamily: type.bodyStrong.fontFamily }}>
              {option.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

// Section title with an optional text action on the right.
export function SectionHeader({ title, action, onAction, style }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }, style]}>
      <Txt variant="title">{title}</Txt>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8}>
          <Txt variant="small" tone="accent" style={{ fontFamily: type.bodyStrong.fontFamily }}>
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

// Labeled input with a sunken fill instead of a border.
export function TextField({ label, hint, error, style, inputStyle, icon, ...rest }) {
  const { c } = useAppTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Txt variant="small" style={{ fontFamily: type.bodyStrong.fontFamily }}>{label}</Txt> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: c.sunken, borderRadius: radius.md, paddingHorizontal: space.lg, minHeight: 52, gap: space.sm, borderWidth: error ? 1.5 : 0, borderColor: c.accent }}>
        {icon ? <Ionicons name={icon} size={18} color={c.muted} /> : null}
        <TextInput placeholderTextColor={c.faint} style={[type.body, { flex: 1, color: c.ink, paddingVertical: space.md, outlineStyle: 'none' }, inputStyle]} {...rest} />
      </View>
      {error ? <Txt variant="caption" tone="accent">{error}</Txt> : hint ? <Txt variant="caption" tone="muted">{hint}</Txt> : null}
    </View>
  );
}

// Thin progress track. Fill animates with scaleX, not width.
export function ProgressBar({ value = 0, color, height = 6, style }) {
  const { c } = useAppTheme();
  const clamped = Math.max(0, Math.min(1, value || 0));
  return (
    <View style={[{ height, borderRadius: height, backgroundColor: c.sunken, overflow: 'hidden' }, style]}>
      <View style={{ height, width: `${clamped * 100}%`, borderRadius: height, backgroundColor: color || c.ink }} />
    </View>
  );
}

// Icon, a sentence of what's missing, and the one action that fixes it.
export function EmptyState({ icon = 'leaf-outline', title, body, action, onAction, style }) {
  const { c } = useAppTheme();
  return (
    <View style={[{ alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.md }, style]}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={26} color={c.ink} />
      </View>
      {title ? <Txt variant="title" style={{ textAlign: 'center' }}>{title}</Txt> : null}
      {body ? <Txt variant="small" tone="muted" style={{ textAlign: 'center', maxWidth: 300 }}>{body}</Txt> : null}
      {action ? <Button title={action} onPress={onAction} size="sm" variant="secondary" style={{ marginTop: space.xs }} /> : null}
    </View>
  );
}

export function Divider({ style }) {
  const { c } = useAppTheme();
  return <View style={[{ height: 1, backgroundColor: c.hairline }, style]} />;
}

// A tappable list row: leading element, title + subtitle, trailing element.
export function Row({ leading, title, subtitle, trailing, onPress, style }) {
  const content = (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md }, style]}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === 'string' ? <Txt variant="bodyStrong" numberOfLines={1}>{title}</Txt> : title}
        {subtitle ? (typeof subtitle === 'string' ? <Txt variant="small" tone="muted" numberOfLines={2}>{subtitle}</Txt> : subtitle) : null}
      </View>
      {trailing}
    </View>
  );
  return onPress ? (
    <Tap onPress={onPress} scaleTo={0.985} accessibilityRole="button">
      {content}
    </Tap>
  ) : (
    content
  );
}
