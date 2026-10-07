import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Location from "expo-location";
import { MaterialIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { supabase } from "../../utils/config";
import { useTheme } from "../../context/ThemeContext";
import { fetchHalls, fetchMySchool } from "../../utils/schools";
import { fetchProfile, searchPeople } from "../../utils/profiles";
import Avatar from "../../components/Avatar";

const REFRESH_MS = 60 * 1000;
const REPORT_REASONS = ["Harassment", "Spam", "Something else"];

function minutesAgo(timestamp) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

export default function Friends() {
  const { isDarkMode } = useTheme();
  const navigation = useNavigation();
  const styles = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);

  const [me, setMe] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [looks, setLooks] = useState({}); // id -> { avatar_emoji, accent_color, username }
  const [myHall, setMyHall] = useState(null);
  const [ghostMode, setGhostMode] = useState(false);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [unread, setUnread] = useState({});
  const [halls, setHalls] = useState([]);
  const [hallPickerVisible, setHallPickerVisible] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const searchTimer = useRef(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);

    const [presenceRes, friendsRes, requestsRes, unreadRes, profileRes] = await Promise.all([
      supabase.from("presence").select("expires_at, dining_halls(name)").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("get_friends_presence"),
      supabase.from("friendships").select("requester_id").eq("addressee_id", user.id).eq("status", "pending"),
      supabase.from("messages").select("sender_id").eq("recipient_id", user.id).is("read_at", null),
      supabase.from("profiles").select("share_presence").eq("id", user.id).maybeSingle(),
    ]);

    fetchProfile(user.id).then(setMyProfile).catch(() => {});
    const friendIds = (friendsRes.data || []).map((f) => f.friend_id);
    if (friendIds.length > 0) {
      const { data: friendLooks } = await supabase
        .from("profiles")
        .select("id, avatar_emoji, accent_color, username")
        .in("id", friendIds);
      setLooks(Object.fromEntries((friendLooks || []).map((p) => [p.id, p])));
    }

    const presence = presenceRes.data;
    setMyHall(presence && new Date(presence.expires_at) > new Date() ? presence.dining_halls?.name : null);
    setGhostMode(profileRes.data ? !profileRes.data.share_presence : false);
    if (!friendsRes.error) setFriends(friendsRes.data || []);

    const counts = {};
    for (const message of unreadRes.data || []) counts[message.sender_id] = (counts[message.sender_id] || 0) + 1;
    setUnread(counts);

    const requesterIds = (requestsRes.data || []).map((row) => row.requester_id);
    if (requesterIds.length > 0) {
      const { data: names } = await supabase.from("profiles").select("id, display_name").in("id", requesterIds);
      setIncoming(names || []);
    } else {
      setIncoming([]);
    }
  }, []);

  useEffect(() => {
    fetchMySchool()
      .then((school) => (school ? fetchHalls(school.id) : []))
      .then(setHalls)
      .catch(() => setHalls([]));
  }, []);

  // Refresh when the tab is shown and every minute while it stays open.
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, REFRESH_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const checkIn = async () => {
    setCheckingIn(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location is off",
          "Allow location to check in automatically, or pick your dining hall yourself.",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Pick hall", onPress: () => setHallPickerVisible(true) },
          ]
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { data, error } = await supabase.rpc("check_in", {
        p_lat: position.coords.latitude,
        p_lng: position.coords.longitude,
        p_accuracy_m: position.coords.accuracy,
      });
      if (error) throw error;

      const hall = data?.[0]?.hall_name;
      if (!hall) {
        Alert.alert("Not at a dining hall", "We couldn't place you in a dining hall. You can pick one yourself.", [
          { text: "OK", style: "cancel" },
          { text: "Pick hall", onPress: () => setHallPickerVisible(true) },
        ]);
      } else if (ghostMode) {
        Alert.alert(`You're at ${hall}`, "Ghost mode is on, so friends won't see it.");
      }
      await load();
    } catch (error) {
      Alert.alert("Couldn't check in", error.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const checkInManually = async (hall) => {
    setHallPickerVisible(false);
    const { error } = await supabase.rpc("check_in_hall", { p_hall_id: hall.id });
    if (error) Alert.alert("Couldn't check in", error.message);
    await load();
  };

  const checkOut = async () => {
    await supabase.rpc("check_out");
    await load();
  };

  const toggleGhost = async (enabled) => {
    setGhostMode(enabled);
    const { error } = await supabase.rpc("set_ghost_mode", { p_enabled: enabled });
    if (error) {
      setGhostMode(!enabled);
      Alert.alert("Couldn't update", error.message);
    }
    await load();
  };

  const search = (text) => {
    setQuery(text);
    clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setResults(await searchPeople(text).catch(() => []));
    }, 300);
  };

  const sendRequest = async (person) => {
    const { error } = await supabase.rpc("send_friend_request", { p_target: person.id });
    if (error) {
      Alert.alert("Couldn't add friend", error.message);
      return;
    }
    search(query);
    load();
  };

  const respond = async (person, accept) => {
    const { error } = await supabase.rpc("respond_friend_request", { p_requester: person.id, p_accept: accept });
    if (error) Alert.alert("Error", error.message);
    load();
  };

  const report = (friend) => {
    Alert.alert(`Report ${friend.display_name}`, "What's going on?", [
      ...REPORT_REASONS.map((reason) => ({
        text: reason,
        onPress: async () => {
          const { error } = await supabase.from("reports").insert({ reported_user_id: friend.friend_id, reason });
          Alert.alert(error ? "Couldn't send report" : "Report sent", error ? error.message : "Thanks. We review every report.");
        },
      })),
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const friendActions = (friend) => {
    Alert.alert(friend.display_name, undefined, [
      {
        text: "Remove friend",
        onPress: async () => {
          await supabase.rpc("remove_friend", { p_other: friend.friend_id });
          load();
        },
      },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await supabase.rpc("block_user", { p_target: friend.friend_id });
          load();
        },
      },
      { text: "Report", onPress: () => report(friend) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const openProfile = (userId) => navigation.navigate("Profile", { userId });

  const openChat = (friend) => {
    navigation.navigate("Conversation", { friendId: friend.friend_id, friendName: friend.display_name });
  };

  const atHallCount = friends.filter((friend) => friend.hall_name).length;

  const header = (
    <View>
      <TouchableOpacity style={styles.meRow} onPress={() => navigation.navigate("Profile")} accessibilityRole="button">
        <Avatar emoji={myProfile?.avatar_emoji} color={myProfile?.accent_color} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>Your profile</Text>
          <Text style={styles.muted}>
            {myProfile?.username ? `@${myProfile.username}` : "Add a username so friends can find you"}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#888" />
      </TouchableOpacity>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <MaterialIcons name={myHall ? "place" : "location-off"} size={22} color={myHall ? "#32745f" : "#888"} />
          <Text style={styles.cardTitle}>{myHall ? `You're at ${myHall}` : "You're not at a dining hall"}</Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.primaryButton} onPress={checkIn} disabled={checkingIn} accessibilityRole="button">
            {checkingIn ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>{myHall ? "Update" : "Check in"}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={() => setHallPickerVisible(true)} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Pick hall</Text>
          </TouchableOpacity>
          {myHall && (
            <TouchableOpacity style={styles.secondaryButton} onPress={checkOut} accessibilityRole="button">
              <Text style={styles.secondaryButtonText}>Leave</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.ghostRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ghostTitle}>Ghost mode</Text>
            <Text style={styles.ghostText}>Friends see you as "Not at a dining hall".</Text>
          </View>
          <Switch value={ghostMode} onValueChange={toggleGhost} trackColor={{ true: "#32745f" }} />
        </View>
        <Text style={styles.privacyNote}>
          Your location is used once to find your hall and is never saved. Only friends see the hall name, and check-ins expire after 90 minutes.
        </Text>
      </View>

      {incoming.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Friend requests</Text>
          {incoming.map((person) => (
            <View key={person.id} style={styles.row}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => openProfile(person.id)}>
                <Text style={styles.name}>{person.display_name}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallPrimary} onPress={() => respond(person, true)}>
                <Text style={styles.smallPrimaryText}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.smallSecondary} onPress={() => respond(person, false)}>
                <Text style={styles.smallSecondaryText}>Decline</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add friends</Text>
        <TextInput
          style={styles.search}
          placeholder="Search classmates by name or @username"
          placeholderTextColor="#888"
          value={query}
          onChangeText={search}
          autoCorrect={false}
        />
        {results.map((person) => (
          <View key={person.id} style={styles.row}>
            <TouchableOpacity style={styles.personTap} onPress={() => openProfile(person.id)} accessibilityRole="button">
              <Avatar emoji={person.avatar_emoji} color={person.accent_color} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{person.display_name}</Text>
                {person.username ? <Text style={styles.muted}>@{person.username}</Text> : null}
              </View>
            </TouchableOpacity>
            {person.friendship === "none" && (
              <TouchableOpacity style={styles.smallPrimary} onPress={() => sendRequest(person)}>
                <Text style={styles.smallPrimaryText}>Add</Text>
              </TouchableOpacity>
            )}
            {person.friendship === "incoming" && (
              <TouchableOpacity style={styles.smallPrimary} onPress={() => sendRequest(person)}>
                <Text style={styles.smallPrimaryText}>Accept</Text>
              </TouchableOpacity>
            )}
            {person.friendship === "requested" && <Text style={styles.muted}>Requested</Text>}
            {person.friendship === "friends" && <Text style={styles.muted}>Friends</Text>}
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>
        Friends {friends.length > 0 ? `· ${atHallCount} at a dining hall` : ""}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(friend) => friend.friend_id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Add classmates to see who's eating where.</Text>}
        renderItem={({ item: friend }) => (
          <TouchableOpacity
            style={styles.friendRow}
            onPress={() => openProfile(friend.friend_id)}
            onLongPress={() => friendActions(friend)}
            accessibilityRole="button"
            accessibilityHint="Opens their profile. Long press for more options."
          >
            <View>
              <Avatar emoji={looks[friend.friend_id]?.avatar_emoji} color={looks[friend.friend_id]?.accent_color} size={42} />
              <View style={[styles.statusDot, styles.statusBadge, { backgroundColor: friend.hall_name ? "#32745f" : isDarkMode ? "#444" : "#ccc" }]} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{friend.display_name}</Text>
              <Text style={friend.hall_name ? styles.atHall : styles.muted}>
                {friend.hall_name ? `At ${friend.hall_name} · ${minutesAgo(friend.checked_in_at)}` : "Not at a dining hall"}
              </Text>
            </View>
            {unread[friend.friend_id] > 0 && (
              <View style={styles.unread}>
                <Text style={styles.unreadText}>{unread[friend.friend_id]}</Text>
              </View>
            )}
            <TouchableOpacity onPress={() => openChat(friend)} hitSlop={10} accessibilityLabel={`Message ${friend.display_name}`}>
              <MaterialIcons name="chat-bubble-outline" size={22} color={isDarkMode ? "#E0E0E0" : "#32745f"} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
      />

      <Modal visible={hallPickerVisible} transparent animationType="fade" onRequestClose={() => setHallPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Where are you eating?</Text>
            {halls.length === 0 && <Text style={styles.muted}>No dining halls found for your school.</Text>}
            {halls.map((hall) => (
              <TouchableOpacity key={hall.id} style={styles.hallOption} onPress={() => checkInManually(hall)}>
                <Text style={styles.name}>{hall.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setHallPickerVisible(false)} style={{ marginTop: 12 }}>
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (isDarkMode) => {
  const text = isDarkMode ? "#E0E0E0" : "#222";
  const subtle = isDarkMode ? "#999" : "#666";
  const surface = isDarkMode ? "#1E1E1E" : "#fff";
  const border = isDarkMode ? "#333" : "rgba(50,116,95,0.15)";

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: isDarkMode ? "#121212" : "#f5f7fa", paddingHorizontal: 16 },
    card: { backgroundColor: surface, borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: border },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    cardTitle: { fontSize: 18, fontWeight: "700", color: text, flexShrink: 1 },
    buttonRow: { flexDirection: "row", gap: 8, marginTop: 14 },
    primaryButton: { backgroundColor: "#32745f", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, minWidth: 96, alignItems: "center" },
    primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
    secondaryButton: { borderWidth: 1.5, borderColor: "#32745f", borderRadius: 10, paddingVertical: 9, paddingHorizontal: 14 },
    secondaryButtonText: { color: isDarkMode ? "#E0E0E0" : "#32745f", fontWeight: "700", fontSize: 15 },
    ghostRow: { flexDirection: "row", alignItems: "center", marginTop: 14 },
    ghostTitle: { fontSize: 15, fontWeight: "600", color: text },
    ghostText: { fontSize: 13, color: subtle, marginTop: 2 },
    privacyNote: { fontSize: 12, color: subtle, marginTop: 12, lineHeight: 17 },
    section: { marginTop: 20 },
    sectionTitle: { fontSize: 16, fontWeight: "700", color: isDarkMode ? "#E0E0E0" : "#32745f", marginTop: 20, marginBottom: 8 },
    search: {
      height: 46,
      borderWidth: 1.5,
      borderColor: border,
      borderRadius: 12,
      paddingHorizontal: 14,
      fontSize: 15,
      backgroundColor: surface,
      color: text,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
    friendRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: surface,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: border,
    },
    statusDot: { width: 10, height: 10, borderRadius: 5 },
    statusBadge: { position: "absolute", right: -1, bottom: -1, width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: surface },
    meRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: surface, borderRadius: 16, padding: 14, marginTop: 16, borderWidth: 1, borderColor: border },
    personTap: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
    name: { fontSize: 16, fontWeight: "600", color: text, flex: 1 },
    atHall: { fontSize: 13, color: "#32745f", fontWeight: "600", marginTop: 2 },
    muted: { fontSize: 13, color: subtle, marginTop: 2 },
    empty: { textAlign: "center", color: subtle, marginTop: 12 },
    smallPrimary: { backgroundColor: "#32745f", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
    smallPrimaryText: { color: "#fff", fontWeight: "700" },
    smallSecondary: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: border },
    smallSecondaryText: { color: subtle, fontWeight: "600" },
    unread: { backgroundColor: "#E53935", borderRadius: 10, minWidth: 20, height: 20, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    unreadText: { color: "#fff", fontSize: 12, fontWeight: "700" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" },
    modalContent: { backgroundColor: surface, borderRadius: 16, padding: 20, width: "85%" },
    modalTitle: { fontSize: 18, fontWeight: "700", color: text, marginBottom: 12 },
    hallOption: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: border },
    cancel: { textAlign: "center", color: subtle, fontWeight: "600", fontSize: 15 },
  });
};
