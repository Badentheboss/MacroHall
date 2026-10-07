import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../utils/config';
import { fetchFavoritesOnMenu } from '../utils/favorites';
import { getFromBackend } from '../utils/api';

const MAX_AREAS = 4;

function prettyMeals(meals) {
  return (meals || []).map((m) => m.replace(/^\w/, (c) => c.toUpperCase())).join(', ');
}

// One row per dish with every hall serving it, since popular dishes are often
// on several halls' menus the same day.
function groupByDish(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.dish_name) || { ...row, halls: [], meals: [] };
    group.halls.push(row.hall_name);
    group.meals = [...new Set([...group.meals, ...(row.meals || [])])];
    groups.set(row.dish_name, group);
  }
  return [...groups.values()];
}

function hallList(halls) {
  return halls.length <= 2 ? halls.join(' & ') : `${halls.slice(0, 2).join(', ')} +${halls.length - 2} more`;
}

// Dashboard cards: hearted dishes on today's/tomorrow's menus, the "hit my
// macros" plate builder, and how busy the gym is (live counters where the rec
// center publishes them, plus MacroHall check-ins and friends).
export default function DashboardExtras({ isDarkMode, remaining }) {
  const navigation = useNavigation();
  const styles = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);
  const [favorites, setFavorites] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [live, setLive] = useState(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchFavoritesOnMenu()
        .then((rows) => active && setFavorites(rows))
        .catch(() => {});
      supabase
        .rpc('gym_overview_safe')
        .then(({ data }) => active && setGyms(data || []));
      getFromBackend('/gyms/live')
        .then((data) => active && setLive(data))
        .catch(() => active && setLive(null));
      return () => {
        active = false;
      };
    }, [])
  );

  const today = favorites.length > 0 ? favorites[0].day : null;
  const todays = groupByDish(favorites.filter((f) => f.day === today));
  const servedToday = new Set(todays.map((f) => f.dish_name));
  const later = groupByDish(favorites.filter((f) => f.day !== today && !servedToday.has(f.dish_name)));
  const liveFacilities = live?.facilities || [];

  return (
    <View>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>❤️ Favorites on the menu</Text>
        </View>
        {favorites.length === 0 ? (
          <Text style={styles.muted}>Tap the heart on dishes you love in Add Food. We'll show you when and where they're served.</Text>
        ) : (
          <>
            {todays.map((f) => (
              <TouchableOpacity key={`t-${f.dish_name}`} style={styles.favoriteRow} onPress={() => navigation.navigate('AddFood')}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.favoriteName}>{f.dish_name}</Text>
                  <Text style={styles.muted}>
                    Today · {hallList(f.halls)} · {prettyMeals(f.meals)}
                  </Text>
                </View>
                {f.protein != null && <Text style={styles.favoriteMacro}>{Math.round(f.protein)}g P</Text>}
              </TouchableOpacity>
            ))}
            {later.map((f) => (
              <View key={`l-${f.dish_name}`} style={styles.favoriteRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.favoriteName}>{f.dish_name}</Text>
                  <Text style={styles.muted}>
                    Tomorrow · {hallList(f.halls)} · {prettyMeals(f.meals)}
                  </Text>
                </View>
              </View>
            ))}
            {todays.length === 0 && <Text style={styles.muted}>None of your favorites are on today's menus.</Text>}
          </>
        )}
      </View>

      <TouchableOpacity style={styles.plateCta} onPress={() => navigation.navigate('PlateBuilder')} accessibilityRole="button">
        <MaterialIcons name="restaurant" size={26} color="#fff" />
        <View style={{ flex: 1 }}>
          <Text style={styles.plateTitle}>Hit my macros</Text>
          <Text style={styles.plateText}>
            {remaining && remaining.calories > 0
              ? `${Math.round(remaining.protein)}g protein · ${Math.round(remaining.calories)} cal left. Build a plate from today's menus.`
              : 'Build a plate from today’s dining hall menus.'}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={26} color="#fff" />
      </TouchableOpacity>

      {(gyms.length > 0 || liveFacilities.length > 0) && (
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>🏋️ Gym right now</Text>
            {live?.fetched_at && <Text style={styles.live}>● LIVE</Text>}
          </View>

          {liveFacilities.map((facility) => (
            <View key={facility.name} style={{ marginBottom: 8 }}>
              <Text style={styles.facility}>{facility.name}</Text>
              {facility.areas.slice(0, MAX_AREAS).map((area) => (
                <View key={area.area} style={styles.areaRow}>
                  <Text style={styles.areaName} numberOfLines={1}>{area.area}</Text>
                  {area.closed ? (
                    <Text style={styles.muted}>Closed</Text>
                  ) : (
                    <>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${area.percent ?? 0}%`, backgroundColor: (area.percent ?? 0) > 75 ? '#E53935' : (area.percent ?? 0) > 45 ? '#FB8C00' : '#32745f' },
                          ]}
                        />
                      </View>
                      <Text style={styles.percent}>{area.percent != null ? `${area.percent}%` : area.count}</Text>
                    </>
                  )}
                </View>
              ))}
            </View>
          ))}

          {gyms.map((gym) => (
            <View key={gym.gym_id} style={styles.gymRow}>
              <Text style={styles.favoriteName}>{gym.gym_name}</Text>
              <Text style={styles.muted}>
                {[
                  gym.students_here ? `${gym.students_here} MacroHall students here` : null,
                  gym.friends_here?.length ? `Friends: ${gym.friends_here.join(', ')}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'No friends checked in'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const makeStyles = (isDarkMode) => {
  const text = isDarkMode ? '#E0E0E0' : '#222';
  const subtle = isDarkMode ? '#999' : '#666';
  const surface = isDarkMode ? '#1E1E1E' : '#fff';

  return StyleSheet.create({
    card: { backgroundColor: surface, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    title: { fontSize: 17, fontWeight: '700', color: isDarkMode ? '#E0E0E0' : '#32745f' },
    muted: { fontSize: 13, color: subtle, marginTop: 2 },
    favoriteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: isDarkMode ? '#333' : '#eee' },
    favoriteName: { fontSize: 15, fontWeight: '600', color: text },
    favoriteMacro: { fontSize: 13, fontWeight: '700', color: '#2196F3' },
    plateCta: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#32745f', borderRadius: 16, padding: 16, marginBottom: 16 },
    plateTitle: { color: '#fff', fontSize: 17, fontWeight: '800' },
    plateText: { color: '#E8F5E9', fontSize: 13, marginTop: 2 },
    live: { color: '#E53935', fontSize: 12, fontWeight: '800' },
    facility: { fontSize: 14, fontWeight: '700', color: text, marginBottom: 4 },
    areaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
    areaName: { width: 110, fontSize: 13, color: text },
    barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: isDarkMode ? '#333' : '#EEF1F0', overflow: 'hidden' },
    barFill: { height: 8, borderRadius: 4 },
    percent: { width: 40, textAlign: 'right', fontSize: 13, fontWeight: '700', color: text },
    gymRow: { paddingVertical: 6 },
  });
};
