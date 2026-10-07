// Native versions of the Magic UI effects that suit a phone app: blur-fade
// entrances, a number ticker, an animated circular progress ring, and a
// pulsing live dot. Short, ease-out timings; no bounce.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { motion, type, useAppTheme } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// Cubic ease-out as a bezier: react-native-web supports bezier but not Easing.out(cubic).
const easeOut = Easing.bezier(0.33, 1, 0.68, 1);

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.()
  .then((value) => {
    reduceMotion = value;
  })
  .catch(() => {});

// Fades and lifts children in on mount. Pass `index` to stagger lists.
export function FadeIn({ children, index = 0, style, ...rest }) {
  // No withInitialValues: on web Reanimated then treats it as a custom
  // animation whose cleanup pins the element with position: absolute.
  const entering = FadeInDown.duration(motion.slow)
    .delay(Math.min(index, 8) * motion.stagger)
    .easing(easeOut)
    .reduceMotion(ReduceMotion.System);
  return (
    <Animated.View entering={entering} style={style} {...rest}>
      {children}
    </Animated.View>
  );
}

// Counts from the previous value to the new one.
export function NumberTicker({ value, duration = 700, format = (n) => Math.round(n).toLocaleString(), style, variant = 'number', color }) {
  const { c } = useAppTheme();
  const [shown, setShown] = useState(reduceMotion ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (reduceMotion || !Number.isFinite(value)) {
      setShown(value);
      return undefined;
    }
    const start = Date.now();
    const origin = from.current;
    let frame;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(origin + (value - origin) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <Text style={[type[variant], { color: color || c.ink, fontVariant: ['tabular-nums'] }, style]}>{format(shown)}</Text>;
}

// Circular progress that sweeps to `progress` (0..1). Children sit centered.
export function MacroRing({ progress = 0, size = 72, stroke = 7, color, track, children }) {
  const { c } = useAppTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const sweep = useSharedValue(0);

  useEffect(() => {
    const target = Math.max(0, Math.min(1, progress || 0));
    sweep.value = reduceMotion ? target : withTiming(target, { duration: 900, easing: easeOut });
  }, [progress, sweep]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - sweep.value) }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track || c.sunken} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color || c.ink}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          animatedProps={animatedProps}
        />
      </Svg>
      {children}
    </View>
  );
}

// Small dot that breathes, for "live" data.
export function LiveDot({ color, size = 8 }) {
  const { c } = useAppTheme();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduceMotion) pulse.value = withRepeat(withTiming(0.35, { duration: 900, easing: Easing.bezier(0.45, 0, 0.55, 1) }), -1, true);
  }, [pulse]);
  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color || c.accent }, animated]} />;
}
