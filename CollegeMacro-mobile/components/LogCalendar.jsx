import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const pad = (n) => String(n).padStart(2, '0');

// month: 'YYYY-MM-01'. days: { 'YYYY-MM-DD': { calories, protein } }.
// Logged days are filled with the accent color, darker for bigger days.
export default function LogCalendar({ month, days, today, selected, onSelect, onPrev, onNext, accent = '#32745f', isDarkMode }) {
  const styles = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);
  const [year, monthIndex] = month.split('-').map(Number);
  const firstWeekday = new Date(year, monthIndex - 1, 1).getDay();
  const daysInMonth = new Date(year, monthIndex, 0).getDate();
  const maxCalories = Math.max(1, ...Object.values(days || {}).map((d) => d.calories || 0));
  const title = new Date(year, monthIndex - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const isCurrentMonth = today && today.startsWith(month.slice(0, 7));

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${year}-${pad(monthIndex)}-${pad(d)}`);

  return (
    <View>
      <View style={styles.header}>
        <TouchableOpacity onPress={onPrev} accessibilityLabel="Previous month" hitSlop={10}>
          <MaterialIcons name="chevron-left" size={26} color={isDarkMode ? '#E0E0E0' : '#333'} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <TouchableOpacity onPress={onNext} disabled={isCurrentMonth} accessibilityLabel="Next month" hitSlop={10}>
          <MaterialIcons name="chevron-right" size={26} color={isCurrentMonth ? '#777' : isDarkMode ? '#E0E0E0' : '#333'} />
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((label, index) => (
          <Text key={`w${index}`} style={styles.weekday}>{label}</Text>
        ))}
        {cells.map((day, index) => {
          if (!day) return <View key={`e${index}`} style={styles.cell} />;
          const logged = days?.[day];
          const future = today && day > today;
          const intensity = logged ? 0.35 + 0.65 * Math.min(1, (logged.calories || 0) / maxCalories) : 0;
          const alpha = Math.round(intensity * 255).toString(16).padStart(2, '0');
          return (
            <TouchableOpacity
              key={day}
              style={styles.cell}
              disabled={future}
              onPress={() => onSelect(day)}
              accessibilityLabel={`${day}${logged ? `, ${logged.calories} calories` : ', nothing logged'}`}
            >
              <View
                style={[
                  styles.dayCircle,
                  logged && { backgroundColor: `${accent}${alpha}` },
                  day === selected && { borderColor: accent, borderWidth: 2 },
                  day === today && !logged && styles.todayRing,
                ]}
              >
                <Text style={[styles.dayText, logged && intensity > 0.6 && styles.dayTextOnFill, future && styles.future]}>
                  {Number(day.slice(8))}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (isDarkMode) =>
  StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    title: { fontSize: 16, fontWeight: '700', color: isDarkMode ? '#E0E0E0' : '#222' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 12, fontWeight: '600', color: isDarkMode ? '#888' : '#999', marginBottom: 4 },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    dayCircle: { width: '82%', aspectRatio: 1, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
    todayRing: { borderWidth: 1.5, borderColor: isDarkMode ? '#666' : '#bbb' },
    dayText: { fontSize: 13, color: isDarkMode ? '#E0E0E0' : '#333' },
    dayTextOnFill: { color: '#fff', fontWeight: '700' },
    future: { color: isDarkMode ? '#555' : '#ccc' },
  });
