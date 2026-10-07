import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../utils/config";
import { useTheme } from "../context/ThemeContext";
import Avatar from "../components/Avatar";
import LogCalendar from "../components/LogCalendar";
import { VISIBILITY, fetchLogDay, fetchLogMonth, fetchProfile, getMyUserId, goalFor } from "../utils/profiles";

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
export default function Profile({ route, navigation }) {
  const { isDarkMode } = useTheme();
  const styles = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);

  const [userId, setUserId] = useState(route.params?.userId ?? null);
  const [profile, setProfile] = useState(undefined); // undefined = loading, null = unavailable
  const [month, setMonth] = useState(null);
  const [monthDays, setMonthDays] = useState({});
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayLog, setDayLog] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // Read by load() without making it re-run on every calendar tap.
  const viewRef = useRef({ month: null, day: null });

  const isMe = profile?.friendship === "self";
  const accent = profile?.accent_color || "#32745f";

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: profile?.username ? `@${profile.username}` : "Profile",
      headerRight: isMe
        ? () => (
            <TouchableOpacity onPress={() => navigation.navigate("EditProfile")} style={{ marginRight: 16 }} accessibilityLabel="Edit profile">
              <MaterialIcons name="edit" size={22} color={isDarkMode ? "#E0E0E0" : "#32745f"} />
            </TouchableOpacity>
          )
        : undefined,
    });
  }, [navigation, profile?.username, isMe, isDarkMode]);

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
    }, [load])
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

  if (profile === undefined) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color="#32745f" />
      </View>
    );
  }

  if (profile === null) {
    return (
      <View style={[styles.container, styles.center]}>
        <MaterialIcons name="lock-outline" size={36} color="#888" />
        <Text style={styles.muted}>This profile isn't available.</Text>
      </View>
    );
  }

  const goal = goalFor(profile.goal);
  const subtitle = [profile.school, profile.class_year && `Class of ${profile.class_year}`].filter(Boolean).join(" · ");
  const meals = dayLog?.entries
    ? MEAL_ORDER.concat("other")
        .map((meal) => ({
          meal,
          entries: dayLog.entries.filter((e) => (MEAL_ORDER.includes(e.meal) ? e.meal === meal : meal === "other")),
        }))
        .filter((group) => group.entries.length > 0)
    : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.headerCard}>
        <Avatar emoji={profile.avatar_emoji} color={accent} size={84} />
        <Text style={styles.name}>{profile.display_name}</Text>
        {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
        <View style={styles.chips}>
          {goal && (
            <View style={[styles.chip, { borderColor: accent }]}>
              <Text style={styles.chipText}>{goal.emoji} {goal.label}</Text>
            </View>
          )}
          {profile.favorite_hall && (
            <View style={[styles.chip, { borderColor: accent }]}>
              <Text style={styles.chipText}>📍 {profile.favorite_hall.name}</Text>
            </View>
          )}
          <View style={[styles.chip, { borderColor: accent }]}>
            <Text style={styles.chipText}>👥 {profile.friend_count} {profile.friend_count === 1 ? "friend" : "friends"}</Text>
          </View>
        </View>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <View style={styles.actions}>
          {isMe && (
            <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={() => navigation.navigate("EditProfile")}>
              <Text style={styles.buttonText}>Edit profile</Text>
            </TouchableOpacity>
          )}
          {profile.friendship === "none" && (
            <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={friendAction}>
              <Text style={styles.buttonText}>Add friend</Text>
            </TouchableOpacity>
          )}
          {profile.friendship === "incoming" && (
            <TouchableOpacity style={[styles.button, { backgroundColor: accent }]} onPress={friendAction}>
              <Text style={styles.buttonText}>Accept request</Text>
            </TouchableOpacity>
          )}
          {profile.friendship === "requested" && (
            <View style={[styles.button, styles.buttonGhost]}>
              <Text style={styles.buttonGhostText}>Requested</Text>
            </View>
          )}
          {profile.friendship === "friends" && (
            <TouchableOpacity
              style={[styles.button, { backgroundColor: accent }]}
              onPress={() => navigation.navigate("Conversation", { friendId: profile.id, friendName: profile.display_name })}
            >
              <Text style={styles.buttonText}>Message</Text>
            </TouchableOpacity>
          )}
        </View>
        {isMe && (
          <Text style={styles.visibility}>
            Food log visible to: {VISIBILITY.find((v) => v.key === profile.log_visibility)?.label || "Friends"}
          </Text>
        )}
      </View>

      {profile.can_view_log ? (
        <>
          <View style={styles.statsRow}>
            <Stat label="Day streak" value={`🔥 ${profile.stats.streak}`} styles={styles} />
            <Stat label="Days logged (30d)" value={profile.stats.days_logged_30} styles={styles} />
            <Stat label="Avg cal (7d)" value={profile.stats.avg_calories_7 ?? "—"} styles={styles} />
            <Stat label="Avg protein (7d)" value={profile.stats.avg_protein_7 != null ? `${profile.stats.avg_protein_7}g` : "—"} styles={styles} />
          </View>

          {profile.gym && (
            <View style={styles.card}>
              <View style={styles.gymHeader}>
                <Text style={styles.sectionTitle}>🏋️ Gym</Text>
                {profile.gym.at_gym_now && (
                  <View style={styles.liveChip}>
                    <Text style={styles.liveChipText}>At {profile.gym.at_gym_now} now</Text>
                  </View>
                )}
              </View>
              <View style={styles.totals}>
                <Macro label="Gym days (7d)" value={profile.gym.gym_days_7} styles={styles} />
                <Macro label="Time this week" value={formatMinutes(profile.gym.gym_minutes_7)} styles={styles} />
                <Macro label="Gym days (30d)" value={profile.gym.gym_days_30} styles={styles} />
              </View>
              {profile.gym.last_visit && !profile.gym.at_gym_now && (
                <Text style={[styles.muted, { marginTop: 8 }]}>Last visit {new Date(profile.gym.last_visit).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</Text>
              )}
            </View>
          )}
          {isMe && profile.track_gym === false && (
            <Text style={[styles.muted, { textAlign: "center", marginTop: 10 }]}>Turn on Gym location in Friends to track gym visits here.</Text>
          )}

          {profile.favorites?.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>❤️ Favorite dishes</Text>
              <View style={styles.chips}>
                {profile.favorites.map((dish) => (
                  <View key={dish} style={styles.usual}>
                    <Text style={styles.usualName}>{dish}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{isMe ? "Your usuals" : "Usually eats"}</Text>
            {profile.usuals.length === 0 ? (
              <Text style={styles.muted}>Nothing logged in the last 30 days.</Text>
            ) : (
              <View style={styles.chips}>
                {profile.usuals.map((food) => (
                  <View key={food.name} style={styles.usual}>
                    <Text style={styles.usualName}>{food.name}</Text>
                    <Text style={styles.usualMeta}>
                      ×{food.times}
                      {food.protein ? ` · ${food.protein}g protein` : ""}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View style={styles.card}>
            <LogCalendar
              month={month || monthStartOf(profile.today)}
              days={monthDays}
              today={profile.today}
              selected={selectedDay}
              onSelect={(day) => loadDay(userId, day)}
              onPrev={() => changeMonth(-1)}
              onNext={() => changeMonth(1)}
              accent={accent}
              isDarkMode={isDarkMode}
            />
          </View>

          {selectedDay && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>{prettyDay(selectedDay)}</Text>
              {!dayLog ? (
                <Text style={styles.muted}>Nothing logged.</Text>
              ) : (
                <>
                  <View style={styles.totals}>
                    <Macro label="Calories" value={dayLog.calories} styles={styles} />
                    <Macro label="Protein" value={`${Math.round(dayLog.protein)}g`} styles={styles} />
                    <Macro label="Carbs" value={`${Math.round(dayLog.carbs)}g`} styles={styles} />
                    <Macro label="Fat" value={`${Math.round(dayLog.fat)}g`} styles={styles} />
                  </View>
                  {meals.map((group) => (
                    <View key={group.meal} style={{ marginTop: 10 }}>
                      <Text style={styles.mealTitle}>{group.meal === "other" ? "Other" : group.meal.replace(/^\w/, (c) => c.toUpperCase())}</Text>
                      {group.entries.map((entry, index) => (
                        <View key={`${entry.name}-${index}`} style={styles.entry}>
                          <Text style={styles.entryName} numberOfLines={1}>
                            {entry.name}
                            {entry.servings && entry.servings !== 1 ? ` ×${entry.servings}` : ""}
                          </Text>
                          <Text style={styles.entryMacros}>
                            {entry.calories} cal · {entry.protein}p · {entry.carbs}c · {entry.fat}f
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </>
      ) : (
        <View style={[styles.card, styles.center]}>
          <MaterialIcons name="lock-outline" size={28} color="#888" />
          <Text style={[styles.muted, { textAlign: "center", marginTop: 6 }]}>
            {profile.display_name}'s food log is private.
            {profile.friendship !== "friends" ? " Add them as a friend to see what they eat." : ""}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function formatMinutes(minutes) {
  const total = Math.round(Number(minutes) || 0);
  if (total < 60) return `${total}m`;
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function Stat({ label, value, styles }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Macro({ label, value, styles }) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const makeStyles = (isDarkMode) => {
  const text = isDarkMode ? "#E0E0E0" : "#222";
  const subtle = isDarkMode ? "#999" : "#666";
  const surface = isDarkMode ? "#1E1E1E" : "#fff";
  const border = isDarkMode ? "#333" : "rgba(50,116,95,0.15)";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDarkMode ? "#121212" : "#f5f7fa" },
    content: { padding: 16, paddingBottom: 48 },
    center: { alignItems: "center", justifyContent: "center" },
    headerCard: { alignItems: "center", backgroundColor: surface, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: border },
    name: { fontSize: 24, fontWeight: "800", color: text, marginTop: 10 },
    handle: { fontSize: 15, color: subtle, marginTop: 2 },
    muted: { fontSize: 14, color: subtle, marginTop: 4 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" },
    chip: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 },
    chipText: { fontSize: 13, fontWeight: "600", color: text },
    bio: { fontSize: 15, color: text, textAlign: "center", marginTop: 12, lineHeight: 21 },
    actions: { flexDirection: "row", gap: 10, marginTop: 16 },
    button: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 22 },
    buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    buttonGhost: { borderWidth: 1.5, borderColor: border },
    buttonGhostText: { color: subtle, fontWeight: "700", fontSize: 15 },
    visibility: { fontSize: 12, color: subtle, marginTop: 12 },
    statsRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    stat: { flex: 1, backgroundColor: surface, borderRadius: 14, paddingVertical: 12, alignItems: "center", borderWidth: 1, borderColor: border },
    statValue: { fontSize: 18, fontWeight: "800", color: text },
    statLabel: { fontSize: 11, color: subtle, marginTop: 2, textAlign: "center" },
    card: { backgroundColor: surface, borderRadius: 16, padding: 16, marginTop: 14, borderWidth: 1, borderColor: border },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: text, marginBottom: 4 },
    usual: { backgroundColor: isDarkMode ? "#2A2A2A" : "#F1F5F3", borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
    usualName: { fontSize: 14, fontWeight: "600", color: text },
    usualMeta: { fontSize: 12, color: subtle },
    totals: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
    macro: { alignItems: "center", flex: 1 },
    macroValue: { fontSize: 17, fontWeight: "800", color: text },
    gymHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    liveChip: { backgroundColor: "#E3F2FD", borderRadius: 12, paddingVertical: 3, paddingHorizontal: 10 },
    liveChipText: { color: "#1565C0", fontSize: 12, fontWeight: "700" },
    mealTitle: { fontSize: 13, fontWeight: "700", color: "#32745f", textTransform: "uppercase", marginBottom: 4 },
    entry: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, gap: 8 },
    entryName: { fontSize: 14, color: text, flex: 1 },
    entryMacros: { fontSize: 12, color: subtle },
  });
};
