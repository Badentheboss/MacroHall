import React, { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../utils/config';
import { dishKey, fetchFavoritesOnMenu, setFavorite } from '../utils/favorites';
import { getFromBackend } from '../utils/api';
import { radius, space, type, useAppTheme, useStyles } from '../theme';
import { Card, EmptyState, FadeIn, HeartButton, LiveDot, ProgressBar, Row, SectionHeader, Tap, Txt } from './kit';

const MAX_AREAS = 4;
const CARD_WIDTH = 220;

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

const makeStyles = (c) => ({
  root: { gap: space.lg },
  section: { gap: space.md },
  carousel: { marginHorizontal: -space.lg },
  carouselContent: { paddingHorizontal: space.lg, gap: space.md },
  favCard: { width: CARD_WIDTH, minHeight: 210, backgroundColor: c.surface, borderRadius: radius.lg, overflow: 'hidden' },
  favBody: { flex: 1, padding: space.lg, gap: space.sm },
  favProtein: { marginTop: 'auto', paddingTop: space.xs },
  heartWrap: { position: 'absolute', right: space.sm, bottom: space.sm },
  tomorrow: { gap: space.sm },
  tomorrowRow: { gap: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  ctaArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.inverse, alignItems: 'center', justifyContent: 'center' },
  gymHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentSoft, borderRadius: radius.pill, paddingHorizontal: space.md, height: 26 },
  facility: { gap: space.xs, paddingVertical: space.sm },
  areaRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 28 },
  areaName: { width: 128 },
  areaValue: { width: 44, textAlign: 'right', fontFamily: type.bodyStrong.fontFamily, fontVariant: ['tabular-nums'] },
  gymIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.sunken, alignItems: 'center', justifyContent: 'center' },
  checkins: { marginTop: space.sm },
});

// Dashboard cards: the "hit my macros" plate builder, hearted dishes on
// today's/tomorrow's menus, and how busy the gym is (live counters where the
// rec center publishes them, plus MacroHall check-ins and friends).
export default function DashboardExtras({ isDarkMode, remaining }) {
  const navigation = useNavigation();
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  const [favorites, setFavorites] = useState([]);
  const [gyms, setGyms] = useState([]);
  const [live, setLive] = useState(null);
  // Dishes un-hearted from this screen; they stay visible until the next refresh
  // so a mistaken tap can be undone by tapping again.
  const [unhearted, setUnhearted] = useState(() => new Set());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setUnhearted(new Set());
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

  const toggleHeart = async (dishName) => {
    const key = dishKey(dishName);
    const nowHearted = unhearted.has(key);
    const update = (fn) =>
      setUnhearted((prev) => {
        const next = new Set(prev);
        fn(next);
        return next;
      });
    update((s) => (nowHearted ? s.delete(key) : s.add(key)));
    try {
      await setFavorite(dishName, nowHearted);
    } catch (e) {
      update((s) => (nowHearted ? s.add(key) : s.delete(key)));
    }
  };

  const today = favorites.length > 0 ? favorites[0].day : null;
  const todays = groupByDish(favorites.filter((f) => f.day === today));
  const servedToday = new Set(todays.map((f) => f.dish_name));
  const later = groupByDish(favorites.filter((f) => f.day !== today && !servedToday.has(f.dish_name)));
  const liveFacilities = live?.facilities || [];

  const plateText =
    remaining && remaining.calories > 0
      ? `${Math.round(remaining.protein)}g protein and ${Math.round(remaining.calories).toLocaleString('en-US')} cal left. Build a plate from today's menus.`
      : 'Build a plate from today’s dining hall menus.';

  const barColor = (percent) => (percent > 75 ? c.accent : percent > 45 ? c.carbs : c.positive);

  return (
    <View style={styles.root}>
      {/* Primary action */}
      <FadeIn index={3}>
        <Tap onPress={() => navigation.navigate('PlateBuilder')} accessibilityRole="button" accessibilityLabel={`Hit my macros. ${plateText}`} scaleTo={0.98}>
          <Card tone="ink">
            <View style={styles.cta}>
              <View style={{ flex: 1, gap: space.xs }}>
                <Txt variant="overline" color={c.inverse} style={{ opacity: 0.7 }}>Build a plate</Txt>
                <Txt variant="h2" color={c.inverse}>Hit my macros</Txt>
                <Txt variant="small" color={c.inverse} style={{ opacity: 0.78 }}>{plateText}</Txt>
              </View>
              <View style={styles.ctaArrow}>
                <Ionicons name="arrow-forward" size={20} color={c.ink} />
              </View>
            </View>
          </Card>
        </Tap>
      </FadeIn>

      {/* Favorites on the menu */}
      <FadeIn index={4} style={styles.section}>
        <SectionHeader title="Your favorites today" action="Menus" onAction={() => navigation.navigate('AddFood')} />
        {favorites.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="heart-outline"
              title="No favorites yet"
              body="Tap the heart on dishes in Menus. We'll show you when and where they're served."
            />
          </Card>
        ) : (
          <>
            {todays.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.carousel}
                contentContainerStyle={styles.carouselContent}
                decelerationRate="fast"
                snapToInterval={CARD_WIDTH + space.md}
                snapToAlignment="start"
              >
                {todays.map((f) => {
                  const hearted = !unhearted.has(dishKey(f.dish_name));
                  return (
                    <View key={`t-${f.dish_name}`} style={styles.favCard}>
                      <Tap
                        onPress={() => navigation.navigate('AddFood')}
                        scaleTo={0.98}
                        accessibilityRole="button"
                        accessibilityLabel={`${f.dish_name}, today at ${hallList(f.halls)}, ${prettyMeals(f.meals)}${f.protein != null ? `, ${Math.round(f.protein)} grams protein` : ''}`}
                        style={styles.favBody}
                      >
                        <Txt variant="overline" tone="accent">Today</Txt>
                        <Txt variant="h2" numberOfLines={2}>{f.dish_name}</Txt>
                        <Txt variant="caption" tone="muted" numberOfLines={2}>
                          {hallList(f.halls)} · {prettyMeals(f.meals)}
                        </Txt>
                        {f.protein != null ? (
                          <View style={styles.favProtein}>
                            <Txt variant="number" style={{ fontVariant: ['tabular-nums'] }}>{Math.round(f.protein)}g</Txt>
                            <Txt variant="caption" tone="muted">protein</Txt>
                          </View>
                        ) : null}
                      </Tap>
                      <View style={styles.heartWrap}>
                        <HeartButton
                          active={hearted}
                          onPress={() => toggleHeart(f.dish_name)}
                          label={hearted ? `Remove ${f.dish_name} from favorites` : `Add ${f.dish_name} to favorites`}
                        />
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            ) : (
              <Card>
                <Txt variant="small" tone="muted">None of your favorites are on today's menus.</Txt>
              </Card>
            )}
            {later.length > 0 && (
              <Card tone="sunken" style={styles.tomorrow}>
                <Txt variant="overline" tone="muted">Tomorrow</Txt>
                {later.map((f) => (
                  <View key={`l-${f.dish_name}`} style={styles.tomorrowRow}>
                    <Txt variant="small" style={{ fontFamily: type.bodyStrong.fontFamily }} numberOfLines={1}>{f.dish_name}</Txt>
                    <Txt variant="caption" tone="muted" numberOfLines={1}>
                      {hallList(f.halls)} · {prettyMeals(f.meals)}
                    </Txt>
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </FadeIn>

      {/* Gym right now */}
      {(gyms.length > 0 || liveFacilities.length > 0) && (
        <FadeIn index={5}>
          <Card>
            <View style={styles.gymHeader}>
              <Txt variant="title">Gym right now</Txt>
              {live?.fetched_at && (
                <View style={styles.livePill} accessible accessibilityLabel="Live data">
                  <LiveDot size={7} />
                  <Txt variant="caption" tone="accent" style={{ fontFamily: type.title.fontFamily }}>Live</Txt>
                </View>
              )}
            </View>

            {liveFacilities.map((facility) => (
              <View key={facility.name} style={styles.facility}>
                <Txt variant="overline" tone="muted">{facility.name}</Txt>
                {facility.areas.slice(0, MAX_AREAS).map((area) => (
                  <View
                    key={area.area}
                    style={styles.areaRow}
                    accessible
                    accessibilityLabel={`${area.area}: ${area.closed ? 'closed' : area.percent != null ? `${area.percent} percent full` : `${area.count} people`}`}
                  >
                    <Txt variant="small" numberOfLines={1} style={styles.areaName}>{area.area}</Txt>
                    {area.closed ? (
                      <Txt variant="small" tone="muted" style={{ flex: 1 }}>Closed</Txt>
                    ) : (
                      <>
                        <ProgressBar value={(area.percent ?? 0) / 100} color={barColor(area.percent ?? 0)} style={{ flex: 1 }} />
                        <Txt variant="small" style={styles.areaValue}>{area.percent != null ? `${area.percent}%` : area.count}</Txt>
                      </>
                    )}
                  </View>
                ))}
              </View>
            ))}

            {gyms.length > 0 && (
              <View style={liveFacilities.length > 0 ? styles.checkins : null}>
                <Txt variant="overline" tone="muted">On MacroHall</Txt>
                {gyms.map((gym) => (
                  <Row
                    key={gym.gym_id}
                    leading={
                      <View style={styles.gymIcon}>
                        <Ionicons name={gym.friends_here?.length ? 'people' : 'barbell-outline'} size={18} color={c.ink} />
                      </View>
                    }
                    title={gym.gym_name}
                    subtitle={
                      [
                        gym.students_here ? `${gym.students_here} MacroHall students here` : null,
                        gym.friends_here?.length ? `Friends: ${gym.friends_here.join(', ')}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No friends checked in'
                    }
                  />
                ))}
              </View>
            )}
          </Card>
        </FadeIn>
      )}
    </View>
  );
}
