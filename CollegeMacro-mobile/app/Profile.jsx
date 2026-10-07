import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/config";
import LogCalendar from "../components/LogCalendar";
import { Button, Card, EmptyState, FadeIn, HeartButton, LiveDot, NumberTicker, ProfilePanel, PromptCard, Screen, Txt } from "../components/kit";
import { radius, space, type, useAppTheme, useStyles } from "../theme";
import { VISIBILITY, fetchLogDay, fetchLogMonth, fetchProfile, getMyUserId, goalFor } from "../utils/profiles";
import { dishKey, fetchFavoriteKeys, setFavorite } from "../utils/favorites";

const MEAL_ORDER = ["breakfast", "brunch", "lunch", "dinner", "late night"];

const monthStartOf = (isoDay) => `${isoDay.slice(0, 7)}-01`;

function shiftMonth(monthStart, delta) {
  const [year, month] = monthStart.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function prettyDay(isoDay) {
  const [year, month, day] = isoDay.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

// A student's profile: who they are, their streak and averages, the foods
// they eat most, and a calendar of what they ate (when they share it).
// Laid out like a Hinge profile (big panel, then prompts) with an Instagram
// stats row. Used for the "Me" tab and the "Profile" stack screen.
export default function Profile({ route, navigation }) {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);

  const [userId, setUserId] = useState(route.params?.userId ?? null);
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = unavailable
  const [month, setMonth] = useState(null);
  const [monthDays, setMonthDays] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayLog, setDayLog] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // My favorite dish keys, so I can heart a friend's dishes into my favorites.
  const [myFavorites, setMyFavorites] = useState(() => new Set());
  const pendingFavorites = useRef(new Set());
  // Read by load() without making it re-run on every calendar tap.
  const viewRef = useRef({ month: null, day: null });

  const isMe = profile?.friendship === "self";
  const accent = profile?.accent_color || c.accent;

  // The "Me" tab keeps _layout's settings menu; only the title changes here.
  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: profile?.username ? `@${profile.username}` : "Profile" });
  }, [navigation, profile?.username]);

  const loadDay = useCallback(async (id, day) => {
    viewRef.current.day = day;
    setSelectedDay(day);
    try {
      setDayLog(await fetchLogDay(id, day));
    } catch {
      setDayLog(null);
    }
  }, []);

  const load = useCallback(async () => {
    const id = route.params?.userId ?? (await getMyUserId());
    setUserId(id);
    try {
      const data = await fetchProfile(id);
      setProfile(data);
      if (data && data.friendship !== "self" && data.can_view_log) {
        fetchFavoriteKeys()
          .then(setMyFavorites)
          .catch(() => {});
      }
      if (data?.can_view_log) {
        const start = viewRef.current.month || monthStartOf(data.today);
        viewRef.current.month = start;
        setMonth(start);
        setMonthDays(await fetchLogMonth(id, start));
        await loadDay(id, viewRef.current.day || data.today);
      }
    } catch (error) {
      setProfile(null);
    }
  }, [route.params?.userId, loadDay]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const changeMonth = async (delta) => {
    const next = shiftMonth(month, delta);
    viewRef.current.month = next;
    setMonth(next);
    setMonthDays(await fetchLogMonth(userId, next));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const friendAction = async () => {
    const { error } = await supabase.rpc("send_friend_request", { p_target: userId });
    if (error) Alert.alert("Couldn't add friend", error.message);
    load();
  };

  // Heart someone else's dish to add it to (or remove it from) my favorites.
  // Optimistic: flip the heart now, roll back if the write fails.
  const toggleFavorite = async (dishName) => {
    const key = dishKey(dishName);
    if (!key || pendingFavorites.current.has(key)) return;
    const next = !myFavorites.has(key);
    const apply = (on) =>
      setMyFavorites((current) => {
        const copy = new Set(current);
        if (on) copy.add(key);
        else copy.delete(key);
        return copy;
      });
    pendingFavorites.current.add(key);
    apply(next);
    try {
      await setFavorite(dishName, next);
    } catch (error) {
      apply(!next);
      Alert.alert("Couldn't update favorites", error?.message || "Try again in a moment.");
    } finally {
      pendingFavorites.current.delete(key);
    }
  };

  if (profile === undefined) {
    return (
      <Screen scroll={false} style={styles.center}>
        <ActivityIndicator color={c.muted} />
      </Screen>
    );
  }

  if (profile === null) {
    return (
      <Screen scroll={false} style={styles.center}>
        <EmptyState icon="lock-closed-outline" title="This profile isn't available." body="It may be private, or the account no longer exists." />
      </Screen>
    );
  }

  const goal = goalFor(profile.goal);
  const subtitle = [profile.school, profile.class_year && `Class of ${profile.class_year}`].filter(Boolean).join(" · ");
  const stats = profile.can_view_log ? profile.stats : null;
  const usuals = profile.usuals || [];
  const topUsual = usuals[0];
  const otherUsuals = usuals.slice(1);
  const favorites = profile.favorites || [];
  const gym = profile.can_view_log ? profile.gym : null;
  const firstName = (profile.display_name || "").split(" ")[0] || profile.display_name;
  const meals = dayLog?.entries
    ? MEAL_ORDER.concat("other")
        .map((meal) => ({
          meal,
          entries: dayLog.entries.filter((e) => (MEAL_ORDER.includes(e.meal) ? e.meal === meal : meal === "other")),
        }))
        .filter((group) => group.entries.length > 0)
    : [];

  let section = 0;
  const next = () => (section += 1);

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <FadeIn index={0}>
        <ProfilePanel
          path={profile.avatar_path}
          name={profile.display_name}
          subtitle={subtitle || (profile.username ? `@${profile.username}` : undefined)}
          live={Boolean(gym?.at_gym_now)}
          liveLabel={gym?.at_gym_now ? `At ${gym.at_gym_now} now` : undefined}
          height={380}
        />
      </FadeIn>

      {/* Instagram-style stats row */}
      <FadeIn index={next()}>
        <View style={styles.stats} accessibilityRole="summary">
          {stats ? (
            <>
              <Stat value={stats.streak} label="day streak" icon="flame" iconColor={c.accent} />
              <Stat value={stats.days_logged_30} label="logged · 30d" />
              <Stat value={profile.friend_count} label={profile.friend_count === 1 ? "friend" : "friends"} />
              <Stat value={stats.avg_protein_7} label="avg protein" suffix="g" />
            </>
          ) : (
            <>
              <Stat value={profile.friend_count} label={profile.friend_count === 1 ? "friend" : "friends"} />
              <View style={styles.stat}>
                <Ionicons name="lock-closed-outline" size={20} color={c.ink} style={{ height: 24, lineHeight: 24 }} />
                <Txt variant="caption" tone="muted">
                  food log private
                </Txt>
              </View>
            </>
          )}
        </View>
      </FadeIn>

      {/* Actions */}
      <FadeIn index={next()} style={styles.actionsBlock}>
        {isMe ? (
          <>
            <Button title="Edit profile" icon="create-outline" variant="secondary" onPress={() => navigation.navigate("EditProfile")} />
            <View style={styles.visibility}>
              <Ionicons name={profile.log_visibility === "only_me" ? "lock-closed-outline" : "eye-outline"} size={14} color={c.muted} />
              <Txt variant="caption" tone="muted">
                Food log visible to: {VISIBILITY.find((v) => v.key === profile.log_visibility)?.label || "Friends"}
              </Txt>
            </View>
          </>
        ) : (
          <View style={styles.actions}>
            {profile.friendship === "friends" && (
              <>
                <View style={styles.flex}>
                  <Button
                    title="Message"
                    icon="paper-plane-outline"
                    onPress={() => navigation.navigate("Conversation", { friendId: profile.id, friendName: profile.display_name })}
                  />
                </View>
                <StatusPill icon="checkmark" label="Friends" grow accessibilityLabel={`You and ${profile.display_name} are friends`} />
              </>
            )}
            {profile.friendship === "none" && (
              <View style={styles.flex}>
                <Button title="Add friend" icon="person-add-outline" onPress={friendAction} />
              </View>
            )}
            {profile.friendship === "incoming" && (
              <View style={styles.flex}>
                <Button title="Accept request" icon="person-add-outline" onPress={friendAction} />
              </View>
            )}
            {profile.friendship === "requested" && <StatusPill icon="time-outline" label="Requested" grow accessibilityLabel="Friend request sent" />}
          </View>
        )}
      </FadeIn>

      {/* Hinge prompts */}
      {profile.bio ? (
        <FadeIn index={next()}>
          <PromptCard label="About me" answer={profile.bio} />
        </FadeIn>
      ) : null}

      {goal || stats?.avg_calories_7 != null ? (
        <FadeIn index={next()}>
          <PromptCard
            label="Currently"
            answer={goal ? goal.label : `${stats.avg_calories_7.toLocaleString()} calories a day`}
            footer={
              stats?.avg_calories_7 != null ? (goal ? `Averaging ${stats.avg_calories_7.toLocaleString()} cal a day this week` : "7-day average") : undefined
            }
          />
        </FadeIn>
      ) : null}

      {profile.favorite_hall ? (
        <FadeIn index={next()}>
          <PromptCard label="Find me at" answer={profile.favorite_hall.name} />
        </FadeIn>
      ) : null}

      {profile.can_view_log ? (
        <>
          <FadeIn index={next()}>
            {topUsual ? (
              <PromptCard
                label="My go-to order"
                answer={topUsual.name}
                footer={`×${topUsual.times} in 30 days${topUsual.protein ? ` · ${topUsual.protein}g protein` : ""}`}
                liked={!isMe && myFavorites.has(dishKey(topUsual.name))}
                onLike={isMe ? undefined : () => toggleFavorite(topUsual.name)}
                likeLabel={myFavorites.has(dishKey(topUsual.name)) ? `Remove ${topUsual.name} from your favorites` : `Add ${topUsual.name} to your favorites`}
              />
            ) : (
              <PromptCard label={isMe ? "Your usuals" : "Usually eats"}>
                <Txt variant="small" tone="muted">
                  Nothing logged in the last 30 days.
                </Txt>
              </PromptCard>
            )}
          </FadeIn>

          {gym ? (
            <FadeIn index={next()}>
              <PromptCard label="At the gym">
                <View style={styles.numbers}>
                  <Figure value={gym.gym_days_7} label="days · 7d" />
                  <Figure text={formatMinutes(gym.gym_minutes_7)} label="this week" />
                  <Figure value={gym.gym_days_30} label="days · 30d" />
                </View>
                {gym.at_gym_now ? (
                  <View style={styles.liveRow}>
                    <LiveDot />
                    <Txt variant="caption" tone="accent" style={styles.strong}>
                      At {gym.at_gym_now} now
                    </Txt>
                  </View>
                ) : gym.last_visit ? (
                  <Txt variant="caption" tone="muted">
                    Last visit {new Date(gym.last_visit).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                  </Txt>
                ) : null}
              </PromptCard>
            </FadeIn>
          ) : null}
          {isMe && profile.track_gym === false && (
            <Txt variant="caption" tone="muted" style={styles.note}>
              Turn on Gym location in Friends to track gym visits here.
            </Txt>
          )}

          {otherUsuals.length > 0 ? (
            <FadeIn index={next()}>
              <PromptCard label={isMe ? "Your usuals" : "Usually eats"}>
                <View style={styles.chips}>
                  {otherUsuals.map((food) => (
                    <View key={food.name} style={styles.usual}>
                      <Txt variant="small" style={styles.strong} numberOfLines={1}>
                        {food.name}
                      </Txt>
                      <Txt variant="caption" tone="muted">
                        ×{food.times}
                        {food.protein ? ` · ${food.protein}g protein` : ""}
                      </Txt>
                    </View>
                  ))}
                </View>
              </PromptCard>
            </FadeIn>
          ) : null}

          {favorites.length > 0 ? (
            <FadeIn index={next()}>
              <PromptCard label="Favorite dishes" footer={isMe ? undefined : `Tap a heart to add it to your favorites.`}>
                <View style={styles.chips}>
                  {favorites.map((dish) =>
                    isMe ? (
                      <View key={dish} style={styles.favorite}>
                        <Ionicons name="heart" size={14} color={c.accent} />
                        <Txt variant="small" style={styles.strong}>
                          {dish}
                        </Txt>
                      </View>
                    ) : (
                      <View key={dish} style={[styles.favorite, styles.favoriteLikeable]}>
                        <Txt variant="small" style={styles.strong}>
                          {dish}
                        </Txt>
                        <HeartButton
                          size={18}
                          active={myFavorites.has(dishKey(dish))}
                          onPress={() => toggleFavorite(dish)}
                          label={myFavorites.has(dishKey(dish)) ? `Remove ${dish} from your favorites` : `Add ${dish} to your favorites`}
                        />
                      </View>
                    ),
                  )}
                </View>
              </PromptCard>
            </FadeIn>
          ) : null}

          <FadeIn index={next()}>
            <LogCalendar
              month={month || monthStartOf(profile.today)}
              days={monthDays}
              today={profile.today}
              selected={selectedDay}
              onSelect={(day) => loadDay(userId, day)}
              onPrev={() => changeMonth(-1)}
              onNext={() => changeMonth(1)}
              accent={accent}
            />
          </FadeIn>

          {selectedDay && (
            <FadeIn index={next()}>
              <Card style={styles.day}>
                <View style={{ gap: 2 }}>
                  <Txt variant="overline" tone="muted">
                    {selectedDay === profile.today ? "Today" : "Food log"}
                  </Txt>
                  <Txt variant="h2">{prettyDay(selectedDay)}</Txt>
                </View>
                {!dayLog ? (
                  <EmptyState
                    icon="calendar-clear-outline"
                    title="Nothing logged"
                    body={isMe ? "Pick another day, or log a meal from Menus." : `${firstName} didn't log anything this day.`}
                    style={styles.dayEmpty}
                  />
                ) : (
                  <>
                    <View style={styles.numbers}>
                      <Figure value={dayLog.calories} label="calories" />
                      <Figure value={dayLog.protein} suffix="g" label="protein" dot={c.protein} />
                      <Figure value={dayLog.carbs} suffix="g" label="carbs" dot={c.carbs} />
                      <Figure value={dayLog.fat} suffix="g" label="fat" dot={c.fat} />
                    </View>
                    {meals.map((group) => (
                      <View key={group.meal} style={styles.meal}>
                        <Txt variant="overline" tone="muted">
                          {group.meal === "other" ? "Other" : group.meal}
                        </Txt>
                        {group.entries.map((entry, index) => (
                          <View key={`${entry.name}-${index}`} style={styles.entry}>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Txt variant="small" style={styles.strong} numberOfLines={1}>
                                {entry.name}
                                {entry.servings && entry.servings !== 1 ? ` ×${entry.servings}` : ""}
                              </Txt>
                              <Txt variant="caption" tone="muted">
                                {entry.protein}g protein · {entry.carbs}g carbs · {entry.fat}g fat
                              </Txt>
                            </View>
                            <Txt variant="small" style={[styles.strong, styles.tabular]}>
                              {entry.calories} cal
                            </Txt>
                          </View>
                        ))}
                      </View>
                    ))}
                  </>
                )}
              </Card>
            </FadeIn>
          )}
        </>
      ) : (
        <FadeIn index={next()}>
          <Card>
            <EmptyState
              icon="lock-closed-outline"
              title="Food log is private"
              body={`${profile.display_name}'s food log is private.${profile.friendship !== "friends" ? " Add them as a friend to see what they eat." : ""}`}
              style={{ paddingVertical: space.lg }}
            />
          </Card>
        </FadeIn>
      )}
    </Screen>
  );
}

function formatMinutes(minutes) {
  const total = Math.round(Number(minutes) || 0);
  if (total < 60) return `${total}m`;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

// Big tabular number with a small caption under it (Instagram stats).
function Stat({ value, label, suffix = "", icon, iconColor }) {
  const styles = useStyles(makeStyles);
  const known = value != null && Number.isFinite(Number(value));
  return (
    <View style={styles.stat} accessible accessibilityLabel={`${known ? `${value}${suffix}` : "No data"} ${label}`}>
      <View style={styles.statValue}>
        {icon ? <Ionicons name={icon} size={18} color={iconColor} /> : null}
        {known ? (
          <NumberTicker value={Number(value)} format={(n) => `${Math.round(n).toLocaleString()}${suffix}`} style={styles.statNumber} />
        ) : (
          <Txt variant="number" tone="muted" style={styles.statNumber}>
            —
          </Txt>
        )}
      </View>
      <Txt variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

// Smaller number + caption used inside cards (gym, day totals).
function Figure({ value, text, suffix = "", label, dot }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.figure}>
      {text != null ? (
        <Txt variant="number" style={styles.tabular}>
          {text}
        </Txt>
      ) : (
        <NumberTicker value={Math.round(Number(value) || 0)} format={(n) => `${Math.round(n).toLocaleString()}${suffix}`} />
      )}
      <View style={styles.figureLabel}>
        {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
        <Txt variant="caption" tone="muted" numberOfLines={1}>
          {label}
        </Txt>
      </View>
    </View>
  );
}

// Non-interactive pill showing friendship state next to the main action.
function StatusPill({ icon, label, grow, accessibilityLabel }) {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.pill, grow && styles.flex]} accessible accessibilityLabel={accessibilityLabel || label}>
      <Ionicons name={icon} size={18} color={c.ink} />
      <Txt variant="bodyStrong">{label}</Txt>
    </View>
  );
}

const makeStyles = (c) => ({
  center: { alignItems: "center", justifyContent: "center", padding: space.lg },
  flex: { flex: 1 },
  strong: { fontFamily: type.bodyStrong.fontFamily },
  tabular: { fontVariant: ["tabular-nums"] },
  stats: {
    flexDirection: "row",
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.sm,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { flexDirection: "row", alignItems: "center", gap: 2, height: 32 },
  statNumber: { fontSize: 26, lineHeight: 32, letterSpacing: -0.6 },
  actionsBlock: { gap: space.md },
  actions: { flexDirection: "row", gap: space.sm },
  pill: {
    height: 48,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: c.sunken,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
  },
  visibility: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  note: { textAlign: "center", paddingHorizontal: space.xl },
  numbers: { flexDirection: "row", gap: space.sm, paddingVertical: space.xs },
  figure: { flex: 1, gap: 2 },
  figureLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs },
  usual: {
    backgroundColor: c.sunken,
    borderRadius: radius.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    maxWidth: "100%",
  },
  favorite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: c.sunken,
  },
  favoriteLikeable: { height: 44, paddingLeft: space.lg, paddingRight: 0, gap: 0 },
  day: { gap: space.lg },
  dayEmpty: { paddingVertical: space.md },
  meal: { gap: space.xs },
  entry: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
});
