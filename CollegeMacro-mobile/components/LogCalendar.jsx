import React, { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Tap, Txt } from './kit';
import { space, type, useAppTheme, useStyles } from '../theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n) => String(n).padStart(2, '0');

// month: 'YYYY-MM-01'. days: { 'YYYY-MM-DD': { calories, protein } }.
// Logged days are filled ink, today is ringed, the selected day is accent.
// `accent` and `isDarkMode` are accepted for API compatibility; colors come
// from the theme.
export default function LogCalendar({ month, days, today, selected, onSelect, onPrev, onNext }) {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  const [year, monthIndex] = month.split('-').map(Number);
  const firstWeekday = new Date(year, monthIndex - 1, 1).getDay();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const monthName = new Date(year, monthIndex - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  const isCurrentMonth = today && today.startsWith(month.slice(0, 7));
  const loggedCount = Object.keys(days || {}).filter((day) => day.startsWith(month.slice(0, 7))).length;

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${year}-${pad(monthIndex)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Card>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Txt variant="h2">
            {monthName}{' '}
            <Txt variant="h2" tone="muted">
              {year}
            </Txt>
          </Txt>
          <Txt variant="caption" tone="muted">
            {loggedCount} {loggedCount === 1 ? 'day' : 'days'} logged
          </Txt>
        </View>
        <Chevron name="chevron-back" label="Previous month" onPress={onPrev} />
        <Chevron name="chevron-forward" label="Next month" onPress={onNext} disabled={isCurrentMonth} />
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((label, index) => (
          <View key={`w${index}`} style={styles.weekday}>
            <Txt variant="overline" tone="muted">
              {label}
            </Txt>
          </View>
        ))}
        {cells.map((day, index) => {
          if (!day) return <View key={`e${index}`} style={styles.cell} />;
          const logged = days?.[day];
          const future = today && day > today;
          const isSelected = day === selected;
          const isToday = day === today;
          const fill = isSelected ? c.accent : logged ? c.ink : 'transparent';
          const color = isSelected ? '#FFFFFF' : logged ? c.inverse : future ? c.faint : c.muted;
          return (
            <Pressable
              key={day}
              style={styles.cell}
              disabled={future}
              onPress={() => onSelect(day)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled: !!future }}
              accessibilityLabel={`${day}${logged ? `, ${logged.calories} calories` : ', nothing logged'}`}
            >
              <View style={[styles.ring, isToday && styles.today]}>
                <View style={[styles.circle, { backgroundColor: fill }]}>
                  <Txt variant="small" color={color} style={[styles.dayText, (logged || isSelected || isToday) && styles.dayStrong]}>
                    {Number(day.slice(8))}
                  </Txt>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.legend}>
        <Legend swatch={<View style={[styles.dot, { backgroundColor: c.ink }]} />} label="Logged" />
        <Legend swatch={<View style={[styles.dot, styles.dotRing]} />} label="Today" />
        <Legend swatch={<View style={[styles.dot, { backgroundColor: c.accent }]} />} label="Selected" />
      </View>
    </Card>
  );
}

function Chevron({ name, label, onPress, disabled }) {
  const { c } = useAppTheme();
  const handle = useCallback(() => {
    if (!disabled) onPress?.();
  }, [disabled, onPress]);
  return (
    <Tap
      onPress={handle}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      hitSlop={4}
      style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.sunken }}
    >
      <Ionicons name={name} size={20} color={c.ink} />
    </Tap>
  );
}

function Legend({ swatch, label }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      {swatch}
      <Txt variant="caption" tone="muted">
        {label}
      </Txt>
    </View>
  );
}

const makeStyles = (c) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, alignItems: 'center', paddingBottom: space.sm },
  cell: { width: `${100 / 7}%`, height: 48, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  circle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  today: { borderColor: c.ink },
  dayText: { fontVariant: ['tabular-nums'] },
  dayStrong: { fontFamily: type.bodyStrong.fontFamily },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
  dotRing: { borderWidth: 1.5, borderColor: c.ink },
});
