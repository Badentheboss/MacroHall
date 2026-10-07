import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, Switch, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { supabase } from "../../utils/config";
import { fetchHalls, fetchMySchool } from "../../utils/schools";
import { fetchProfile, searchPeople } from "../../utils/profiles";
import { disableAutoCheckIn, enableAutoCheckIn, isAutoCheckInEnabled, refreshAutoCheckIn } from "../../utils/autoCheckIn";
import { radius, space, type, useAppTheme, useStyles } from "../../theme";
import {
  Avatar,
  Button,
  Card,
  Chip,
  EmptyState,
  FadeIn,
  IconButton,
  LiveDot,
  Row,
  SectionHeader,
  StoryBubble,
  Tap,
  TextField,
  Txt,
} from "../../components/kit";

const REFRESH_MS = 60 * 1000;
const REPORT_REASONS = ["Harassment", "Spam", "Something else"];

function minutesAgo(timestamp) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(timestamp).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

function minutesLeft(timestamp) {
  if (!timestamp) return null;
  const minutes = Math.max(0, Math.round((new Date(timestamp).getTime() - Date.now()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

// A person row whose trailing control sits beside (not inside) the tappable
// area, so buttons never nest.
function PersonRow({ onPress, onLongPress, accessibilityLabel, accessibilityHint, leading, title, subtitle, trailing }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
      <View style={{ flex: 1 }}>
        <Tap
          onPress={onPress}
          onLongPress={onLongPress}
          scaleTo={0.985}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
        >
          <Row leading={<View style={{ width: 60, alignItems: "center" }}>{leading}</View>} title={title} subtitle={subtitle} />
        </Tap>
      </View>
      {trailing}
    </View>
  );
}

const firstName = (name) => (name || "").trim().split(/\s+/)[0] || name;

// The "You" bubble at the head of the stories strip, with Instagram's small
// plus badge. Built here because StoryBubble has no badge slot.
function YouStory({ profile, place, onPress }) {
  const { c } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={place ? `You, at ${place.name}. Change where you are` : "You. Check in"}
      style={{ width: 76, alignItems: "center", gap: 6 }}
    >
      <View>
        <Avatar path={profile?.avatar_path} size={62} live={!!place} ring={!place} />
        <View
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: c.primary,
            borderWidth: 2,
            borderColor: c.bg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="add" size={15} color={c.onPrimary} />
        </View>
      </View>
      <View style={{ alignItems: "center" }}>
        <Txt variant="caption" numberOfLines={1} style={{ maxWidth: 76 }}>
          You
        </Txt>
        <Txt variant="caption" tone="muted" numberOfLines={1} style={{ maxWidth: 76, fontSize: 11 }}>
          {place ? place.name : "Check in"}
        </Txt>
      </View>
    </Pressable>
  );
}

// RN Switch in the kit's colors: Macrohall green when on, white thumb.
function Toggle({ value, onValueChange, label }) {
  const { c } = useAppTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      accessibilityLabel={label}
      trackColor={{ true: c.primary, false: c.faint }}
      thumbColor="#FFFFFF"
      activeThumbColor="#FFFFFF"
      ios_backgroundColor={c.faint}
    />
  );
}

// Non-tappable state pill for search results ("Requested", "Friends").
function StatePill({ label, icon }) {
  const { c } = useAppTheme();
  return (
    <View style={{ height: 36, paddingHorizontal: space.md, borderRadius: radius.pill, backgroundColor: c.sunken, flexDirection: "row", alignItems: "center", gap: space.xs }}>
      {icon ? <Ionicons name={icon} size={14} color={c.muted} /> : null}
      <Txt variant="small" tone="muted" style={{ fontFamily: type.bodyStrong.fontFamily }}>
        {label}
      </Txt>
    </View>
  );
}

export default function Friends() {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();

  const [me, setMe] = useState(null);
  const [myProfile, setMyProfile] = useState(null);
  const [looks, setLooks] = useState({}); // id -> { avatar_path, avatar_emoji, accent_color, username }
  const [myPlace, setMyPlace] = useState(null); // { type: 'hall' | 'gym', name, expiresAt }
  const [shareDining, setShareDining] = useState(true);
  const [trackGym, setTrackGym] = useState(false);
  const [autoCheckIn, setAutoCheckIn] = useState(false);
  const [gyms, setGyms] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [unread, setUnread] = useState({});
  const [halls, setHalls] = useState([]);
  const [hallPickerVisible, setHallPickerVisible] = useState(false);
  const [sharingOpen, setSharingOpen] = useState(false);
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
      supabase.from("presence").select("expires_at, dining_halls(name), gym_facilities(name)").eq("user_id", user.id).maybeSingle(),
      supabase.rpc("get_friends_presence"),
      supabase.from("friendships").select("requester_id").eq("addressee_id", user.id).eq("status", "pending"),
      supabase.from("messages").select("sender_id").eq("recipient_id", user.id).is("read_at", null),
      supabase.from("profiles").select("share_presence, track_gym").eq("id", user.id).maybeSingle(),
    ]);

    fetchProfile(user.id).then(setMyProfile).catch(() => {});
    const friendIds = (friendsRes.data || []).map((f) => f.friend_id);
    if (friendIds.length > 0) {
      const { data: friendLooks } = await supabase
        .from("profiles")
        .select("id, avatar_path, avatar_emoji, accent_color, username")
        .in("id", friendIds);
      setLooks(Object.fromEntries((friendLooks || []).map((p) => [p.id, p])));
    }

    const presence = presenceRes.data;
    const current = presence && new Date(presence.expires_at) > new Date() ? presence : null;
    setMyPlace(
      current?.gym_facilities?.name
        ? { type: "gym", name: current.gym_facilities.name, expiresAt: current.expires_at }
        : current?.dining_halls?.name
          ? { type: "hall", name: current.dining_halls.name, expiresAt: current.expires_at }
          : null
    );
    if (profileRes.data) {
      setShareDining(profileRes.data.share_presence);
      setTrackGym(profileRes.data.track_gym);
    }
    isAutoCheckInEnabled().then(setAutoCheckIn);
    if (!friendsRes.error) setFriends(friendsRes.data || []);

    const counts = {};
    for (const message of unreadRes.data || []) counts[message.sender_id] = (counts[message.sender_id] || 0) + 1;
    setUnread(counts);

    const requesterIds = (requestsRes.data || []).map((row) => row.requester_id);
    if (requesterIds.length > 0) {
      const { data: names } = await supabase.from("profiles").select("id, display_name, avatar_path").in("id", requesterIds);
      setIncoming(names || []);
    } else {
      setIncoming([]);
    }
  }, []);

  useEffect(() => {
    fetchMySchool()
      .then(async (school) => {
        if (!school) return;
        setHalls(await fetchHalls(school.id));
        const { data } = await supabase
          .from("gym_facilities")
          .select("id, name")
          .eq("school_id", school.id)
          .eq("is_active", true)
          .order("name");
        setGyms(data || []);
      })
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
      const { data, error } = await supabase.rpc("check_in_place", {
        p_lat: position.coords.latitude,
        p_lng: position.coords.longitude,
        p_accuracy_m: position.coords.accuracy,
      });
      if (error) throw error;

      const place = data?.[0];
      if (!place) {
        Alert.alert(
          trackGym ? "Not at a dining hall or gym" : "Not at a dining hall",
          "We couldn't place you. You can pick the place yourself.",
          [
            { text: "OK", style: "cancel" },
            { text: "Pick place", onPress: () => setHallPickerVisible(true) },
          ]
        );
      } else if (place.place_type === "hall" && !shareDining) {
        Alert.alert(`You're at ${place.place_name}`, "Dining hall location is off, so friends won't see it.");
      }
      await load();
    } catch (error) {
      Alert.alert("Couldn't check in", error.message);
    } finally {
      setCheckingIn(false);
    }
  };

  const checkInManually = async (place, type) => {
    setHallPickerVisible(false);
    const { error } =
      type === "gym"
        ? await supabase.rpc("check_in_gym", { p_gym_id: place.id })
        : await supabase.rpc("check_in_hall", { p_hall_id: place.id });
    if (error) Alert.alert("Couldn't check in", error.message);
    await load();
  };

  const checkOut = async () => {
    await supabase.rpc("check_out");
    await load();
  };

  // Dining-hall and gym location are separate switches.
  const setSharing = async (dining, gym) => {
    const previous = { dining: shareDining, gym: trackGym };
    setShareDining(dining);
    setTrackGym(gym);
    const { error } = await supabase.rpc("set_location_sharing", { p_dining: dining, p_gym: gym });
    if (error) {
      setShareDining(previous.dining);
      setTrackGym(previous.gym);
      Alert.alert("Couldn't update", error.message);
      return;
    }
    refreshAutoCheckIn({ dining, gym }).catch(() => {});
    await load();
  };

  const toggleAutoCheckIn = async (enabled) => {
    if (!enabled) {
      await disableAutoCheckIn();
      setAutoCheckIn(false);
      return;
    }
    const result = await enableAutoCheckIn({ dining: shareDining, gym: trackGym });
    setAutoCheckIn(result.ok);
    if (!result.ok) Alert.alert("Automatic check-in is off", result.reason);
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
  const atGymCount = friends.filter((friend) => friend.gym_name).length;
  const isOut = (friend) => !!(friend.gym_name || friend.hall_name);
  // Stories: friends who are out right now come first.
  const storyFriends = [...friends.filter(isOut), ...friends.filter((friend) => !isOut(friend))];

  const friendStatus = (friend) =>
    friend.gym_name
      ? `Gym · ${friend.gym_name} · ${minutesAgo(friend.checked_in_at)}`
      : friend.hall_name
        ? `At ${friend.hall_name} · ${minutesAgo(friend.checked_in_at)}`
        : "Not at a dining hall";

  const friendsSummary = [
    friends.length > 0 ? `${atHallCount} eating` : null,
    atGymCount > 0 ? `${atGymCount} at the gym` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const sharingSummary = [
    `Dining ${shareDining ? "on" : "off"}`,
    `Gym ${trackGym ? "on" : "off"}`,
    shareDining || trackGym ? `Auto ${autoCheckIn ? "on" : "off"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const expiry = myPlace ? minutesLeft(myPlace.expiresAt) : null;

  const header = (
    <View style={styles.header}>
      {/* Stories strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.stories} contentContainerStyle={styles.storiesContent}>
        <YouStory profile={myProfile} place={myPlace} onPress={() => setHallPickerVisible(true)} />
        {storyFriends.map((friend) => {
          const look = looks[friend.friend_id];
          return (
            <StoryBubble
              key={friend.friend_id}
              path={look?.avatar_path}
              name={firstName(friend.display_name)}
              caption={friend.gym_name || friend.hall_name || null}
              live={isOut(friend)}
              onPress={() => openProfile(friend.friend_id)}
            />
          );
        })}
      </ScrollView>

      {/* Where you are */}
      <FadeIn index={0}>
        <Card style={{ gap: space.lg }}>
          <View style={styles.statusTop}>
            <View style={[styles.statusIcon, myPlace && { backgroundColor: c.accentSoft }]}>
              <Ionicons
                name={myPlace?.type === "gym" ? "barbell-outline" : myPlace ? "restaurant-outline" : "location-outline"}
                size={20}
                color={myPlace ? c.accent : c.ink}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="overline" tone="muted">
                Where you are
              </Txt>
              <Txt variant="h2" numberOfLines={1}>
                {myPlace ? `At ${myPlace.name}` : "Not checked in"}
              </Txt>
            </View>
          </View>
          <Txt variant="caption" tone="muted">
            {myPlace
              ? `Friends can see this${expiry ? ` for ${expiry} more` : ""}. ${myPlace.type === "gym" ? "Gym check-ins last 2 hours." : "Dining check-ins last 90 minutes."}`
              : trackGym
                ? "Not at a dining hall or gym. Check in so friends can find you."
                : "You're not at a dining hall. Check in so friends can find you."}
          </Txt>
          <View style={styles.buttonRow}>
            <View style={{ flex: 1 }}>
              <Button
                title={myPlace ? "Update" : "Check in"}
                icon="navigate-outline"
                onPress={checkIn}
                loading={checkingIn}
                accessibilityLabel={myPlace ? "Update check-in" : "Check in"}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Pick place" variant="secondary" icon="list-outline" onPress={() => setHallPickerVisible(true)} />
            </View>
          </View>
          {myPlace ? <Button title="Check out" variant="ghost" size="sm" onPress={checkOut} style={{ alignSelf: "center", marginTop: -space.sm }} /> : null}

          {/* Location sharing */}
          <View style={styles.sharing}>
            <Row
              onPress={() => setSharingOpen((open) => !open)}
              leading={<Ionicons name="shield-checkmark-outline" size={20} color={c.ink} />}
              title={<Txt variant="small" style={{ fontFamily: type.bodyStrong.fontFamily }}>Location sharing</Txt>}
              subtitle={<Txt variant="caption" tone="muted">{sharingSummary}</Txt>}
              trailing={<Ionicons name={sharingOpen ? "chevron-up" : "chevron-down"} size={18} color={c.muted} />}
            />
            {sharingOpen ? (
              <View>
                <Row
                  title={<Txt variant="small" style={{ fontFamily: type.bodyStrong.fontFamily }}>Dining hall location</Txt>}
                  subtitle={<Txt variant="caption" tone="muted">Friends see which hall you're in</Txt>}
                  trailing={<Toggle value={shareDining} onValueChange={(v) => setSharing(v, trackGym)} label="Dining hall location" />}
                />
                <Row
                  title={<Txt variant="small" style={{ fontFamily: type.bodyStrong.fontFamily }}>Gym location</Txt>}
                  subtitle={<Txt variant="caption" tone="muted">Log gym visits and show friends</Txt>}
                  trailing={<Toggle value={trackGym} onValueChange={(v) => setSharing(shareDining, v)} label="Gym location" />}
                />
                {(shareDining || trackGym) && (
                  <Row
                    title={<Txt variant="small" style={{ fontFamily: type.bodyStrong.fontFamily }}>Automatic check-in</Txt>}
                    subtitle={<Txt variant="caption" tone="muted">In and out as you come and go. Needs "Always" location</Txt>}
                    trailing={<Toggle value={autoCheckIn} onValueChange={toggleAutoCheckIn} label="Automatic check-in" />}
                  />
                )}
                <Txt variant="caption" tone="muted" style={{ marginTop: space.sm }}>
                  Your location is only used to find which hall or gym you're in and is never saved. Only friends see the place name. Dining check-ins expire after 90 minutes, gym check-ins after 2 hours.
                </Txt>
              </View>
            ) : null}
          </View>
        </Card>
      </FadeIn>

      {/* Friend requests */}
      {incoming.length > 0 && (
        <View>
          <SectionHeader title={`Requests · ${incoming.length}`} />
          {incoming.map((person, index) => (
            <FadeIn key={person.id} index={index}>
              <PersonRow
                onPress={() => openProfile(person.id)}
                leading={<Avatar path={person.avatar_path} size={48} />}
                title={person.display_name}
                subtitle="Wants to be friends"
                trailing={
                  <View style={styles.requestActions}>
                    <Button title="Accept" variant="secondary" size="sm" onPress={() => respond(person, true)} accessibilityLabel={`Accept ${person.display_name}`} />
                    <Button title="Decline" variant="ghost" size="sm" onPress={() => respond(person, false)} accessibilityLabel={`Decline ${person.display_name}`} style={{ paddingHorizontal: space.md }} />
                  </View>
                }
              />
            </FadeIn>
          ))}
        </View>
      )}

      {/* Add friends */}
      <View style={{ gap: space.sm }}>
        <TextField
          icon="search"
          placeholder="Search classmates"
          value={query}
          onChangeText={search}
          autoCorrect={false}
          autoCapitalize="none"
          accessibilityLabel="Search classmates by name or @username"
          returnKeyType="search"
        />
        {results.map((person, index) => (
          <FadeIn key={person.id} index={index}>
            <PersonRow
              onPress={() => openProfile(person.id)}
              leading={<Avatar path={person.avatar_path} size={48} />}
              title={person.display_name}
              subtitle={person.username ? `@${person.username}` : undefined}
              trailing={
                person.friendship === "none" ? (
                  <Chip label="Add" icon="person-add-outline" active onPress={() => sendRequest(person)} />
                ) : person.friendship === "incoming" ? (
                  <Chip label="Accept" icon="checkmark" active onPress={() => sendRequest(person)} />
                ) : person.friendship === "requested" ? (
                  <StatePill label="Requested" icon="time-outline" />
                ) : person.friendship === "friends" ? (
                  <StatePill label="Friends" icon="checkmark" />
                ) : null
              }
            />
          </FadeIn>
        ))}
      </View>

      {friends.length > 0 ? (
        <View style={styles.friendsHeader}>
          <Txt variant="title">Friends</Txt>
          {friendsSummary ? (
            <Txt variant="small" tone="muted">
              {friendsSummary}
            </Txt>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        keyExtractor={(friend) => friend.friend_id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.muted} />}
        ListEmptyComponent={
          <EmptyState icon="people-outline" title="No friends yet" body="Add classmates to see where they're eating." />
        }
        renderItem={({ item: friend, index }) => {
          const look = looks[friend.friend_id];
          const out = isOut(friend);
          return (
            <FadeIn index={index}>
              <PersonRow
                onPress={() => openProfile(friend.friend_id)}
                onLongPress={() => friendActions(friend)}
                accessibilityLabel={`${friend.display_name}, ${friendStatus(friend)}`}
                accessibilityHint="Opens their profile. Long press for more options."
                leading={<Avatar path={look?.avatar_path} size={52} live={out} />}
                title={friend.display_name}
                subtitle={
                  <View style={styles.statusLine}>
                    {out ? <LiveDot size={6} /> : null}
                    <Txt variant="small" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
                      {friendStatus(friend)}
                    </Txt>
                  </View>
                }
                trailing={
                  <IconButton
                    name="chatbubble-outline"
                    label={unread[friend.friend_id] > 0 ? `Message ${friend.display_name}, ${unread[friend.friend_id]} unread` : `Message ${friend.display_name}`}
                    badge={unread[friend.friend_id] > 0 ? unread[friend.friend_id] : undefined}
                    onPress={() => openChat(friend)}
                  />
                }
              />
            </FadeIn>
          );
        }}
        contentContainerStyle={styles.list}
      />

      <Modal visible={hallPickerVisible} transparent animationType="fade" onRequestClose={() => setHallPickerVisible(false)}>
        <View style={styles.modalOverlay}>
          <Pressable style={{ flex: 1 }} onPress={() => setHallPickerVisible(false)} accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <View style={styles.grabber} />
            <Txt variant="h2">Where are you?</Txt>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingVertical: space.sm }}>
              {halls.length === 0 && (
                <Txt variant="small" tone="muted">
                  No dining halls found for your school.
                </Txt>
              )}
              {halls.map((hall) => (
                <Row
                  key={`h${hall.id}`}
                  onPress={() => checkInManually(hall, "hall")}
                  leading={
                    <View style={styles.placeIcon}>
                      <Ionicons name="restaurant-outline" size={18} color={c.ink} />
                    </View>
                  }
                  title={hall.name}
                  trailing={<Ionicons name="chevron-forward" size={18} color={c.muted} />}
                />
              ))}
              {trackGym &&
                gyms.map((gym) => (
                  <Row
                    key={`g${gym.id}`}
                    onPress={() => checkInManually(gym, "gym")}
                    leading={
                      <View style={styles.placeIcon}>
                        <Ionicons name="barbell-outline" size={18} color={c.ink} />
                      </View>
                    }
                    title={gym.name}
                    subtitle="Gym"
                    trailing={<Ionicons name="chevron-forward" size={18} color={c.muted} />}
                  />
                ))}
            </ScrollView>
            <Button title="Cancel" variant="secondary" onPress={() => setHallPickerVisible(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  header: { gap: space.xl, paddingBottom: space.sm },
  stories: { marginHorizontal: -space.lg },
  storiesContent: { paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.sm },
  statusTop: { flexDirection: "row", alignItems: "center", gap: space.md },
  statusIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center" },
  buttonRow: { flexDirection: "row", gap: space.sm },
  sharing: { backgroundColor: c.bg, borderRadius: radius.md, paddingHorizontal: space.md, marginHorizontal: -space.xs },
  requestActions: { flexDirection: "row", alignItems: "center" },
  friendsHeader: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: -space.sm },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  modalOverlay: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.sm,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: c.hairline, marginBottom: space.sm },
  placeIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center" },
});
