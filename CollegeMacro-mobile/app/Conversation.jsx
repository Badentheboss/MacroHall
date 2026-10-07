import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../utils/config";
import { radius, space, type, useAppTheme, useStyles } from "../theme";
import { Chip, ChipRow, EmptyState, IconButton, Tap, Txt } from "../components/kit";

// react-native-web renders a multiline input as a two-row textarea; start at one.
const WEB_SINGLE_ROW = Platform.OS === "web" ? { numberOfLines: 1 } : {};

const QUICK_REPLIES = ["Save me a seat", "On my way!", "Which hall?", "Want to grab food?"];
const GROUP_MS = 5 * 60 * 1000; // consecutive bubbles within 5 min sit close together
const STAMP_MS = 30 * 60 * 1000; // a timestamp appears after a 30 min gap

function stampLabel(timestamp) {
  const date = new Date(timestamp);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return `Today ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  const sameWeek = today.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000;
  const day = date.toLocaleDateString([], sameWeek ? { weekday: "short" } : { month: "short", day: "numeric" });
  return `${day} ${time}`;
}

// Instagram's send button: a small ink disc with an up arrow, faded when empty.
function SendButton({ onPress, disabled }) {
  const { c } = useAppTheme();
  return (
    <Tap
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Send"
      accessibilityState={{ disabled }}
      hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name="arrow-up" size={20} color={c.onPrimary} />
    </Tap>
  );
}

export default function Conversation({ route, navigation }) {
  const { friendId, friendName } = route.params;
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();

  const [me, setMe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const report = useCallback(() => {
    Alert.alert(`Report ${friendName}`, "We review every report.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          const lastFromFriend = [...messages].reverse().find((m) => m.sender_id === friendId);
          const { error } = await supabase.from("reports").insert({
            reported_user_id: friendId,
            message_id: lastFromFriend?.id ?? null,
            reason: "Reported from chat",
          });
          Alert.alert(error ? "Couldn't send report" : "Report sent", error?.message);
        },
      },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await supabase.rpc("block_user", { p_target: friendId });
          navigation.goBack();
        },
      },
    ]);
  }, [friendId, friendName, messages, navigation]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: friendName,
      headerRight: () => <IconButton name="ellipsis-horizontal" label="Report or block" onPress={report} style={{ marginRight: space.sm }} />,
    });
  }, [navigation, friendName, report]);

  useEffect(() => {
    let channel;

    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setMe(user.id);

      const { data } = await supabase
        .from("messages")
        .select("id, sender_id, recipient_id, body, created_at, read_at")
        .or(`and(sender_id.eq.${user.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${user.id})`)
        .order("created_at", { ascending: true })
        .limit(200);
      setMessages(data || []);
      supabase.rpc("mark_conversation_read", { p_other: friendId });

      // New messages from this friend arrive live; row-level security limits
      // the stream to conversations this user is part of.
      channel = supabase
        .channel(`dm-${user.id}-${friendId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
          (payload) => {
            if (payload.new.sender_id !== friendId) return;
            setMessages((current) => (current.some((m) => m.id === payload.new.id) ? current : [...current, payload.new]));
            supabase.rpc("mark_conversation_read", { p_other: friendId });
          }
        )
        .subscribe();
    };

    start();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [friendId]);

  const send = async (text) => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const { data, error } = await supabase
      .from("messages")
      .insert({ recipient_id: friendId, body })
      .select("id, sender_id, recipient_id, body, created_at, read_at")
      .single();
    setSending(false);

    if (error) {
      Alert.alert("Couldn't send", "You can only message friends who haven't blocked you.");
      return;
    }
    setDraft("");
    setMessages((current) => [...current, data]);
  };

  // "Seen" sits under my latest message once the friend has read it.
  const lastMineIndex = messages.reduce((found, m, i) => (m.sender_id === me ? i : found), -1);
  const canSend = !!draft.trim() && !sending;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => String(message.id)}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.empty}>
            <EmptyState icon="chatbubbles-outline" title={`Say hi to ${friendName}`} body="Ask where they're eating, or tap a quick reply below." />
          </View>
        }
        renderItem={({ item, index }) => {
          const mine = item.sender_id === me;
          const prev = messages[index - 1];
          const next = messages[index + 1];
          const time = new Date(item.created_at).getTime();
          const showStamp = !prev || time - new Date(prev.created_at).getTime() > STAMP_MS;
          const joinsPrev = !showStamp && prev && prev.sender_id === item.sender_id && time - new Date(prev.created_at).getTime() < GROUP_MS;
          const nextStamp = next && new Date(next.created_at).getTime() - time > STAMP_MS;
          const joinsNext = next && !nextStamp && next.sender_id === item.sender_id && new Date(next.created_at).getTime() - time < GROUP_MS;
          const tight = 6; // inner corner radius where bubbles join
          const corners = mine
            ? { borderTopRightRadius: joinsPrev ? tight : 22, borderBottomRightRadius: joinsNext ? tight : 22 }
            : { borderTopLeftRadius: joinsPrev ? tight : 22, borderBottomLeftRadius: joinsNext ? tight : 22 };
          return (
            <View>
              {showStamp ? (
                <Txt variant="caption" tone="muted" style={styles.stamp}>
                  {stampLabel(item.created_at)}
                </Txt>
              ) : null}
              <View
                style={[styles.bubble, mine ? styles.mine : styles.theirs, corners, { marginTop: showStamp ? 0 : joinsPrev ? 2 : space.md }]}
                accessible
                accessibilityLabel={`${mine ? "You" : friendName}: ${item.body}`}
              >
                <Txt variant="body" tone={mine ? "inverse" : "ink"} selectable>
                  {item.body}
                </Txt>
              </View>
              {mine && index === lastMineIndex && item.read_at ? (
                <Txt variant="caption" tone="muted" style={styles.seen}>
                  Seen
                </Txt>
              ) : null}
            </View>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <ChipRow style={styles.quickRow}>
          {QUICK_REPLIES.map((reply) => (
            <Chip key={reply} label={reply} onPress={() => send(reply)} />
          ))}
        </ChipRow>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={c.faint}
            maxLength={1000}
            multiline
            {...WEB_SINGLE_ROW}
            accessibilityLabel={`Message ${friendName}`}
          />
          <SendButton onPress={() => send(draft)} disabled={!canSend} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  list: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, flexGrow: 1 },
  empty: { flex: 1, justifyContent: "center" },
  stamp: { textAlign: "center", marginTop: space.xl, marginBottom: space.md },
  bubble: { maxWidth: "78%", borderRadius: 22, paddingVertical: space.sm, paddingHorizontal: space.lg },
  mine: { alignSelf: "flex-end", backgroundColor: c.primary },
  theirs: { alignSelf: "flex-start", backgroundColor: c.surface },
  seen: { alignSelf: "flex-end", marginTop: space.xs, marginRight: space.xs },
  footer: { backgroundColor: c.bg, paddingTop: space.sm, gap: space.sm },
  quickRow: { paddingHorizontal: space.lg },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    marginHorizontal: space.lg,
    paddingLeft: space.lg,
    paddingRight: space.xs,
    paddingVertical: space.xs,
    minHeight: 44,
    borderRadius: radius.xl,
    backgroundColor: c.sunken,
  },
  input: {
    ...type.body,
    flex: 1,
    maxHeight: 120,
    color: c.ink,
    paddingVertical: space.sm,
    outlineStyle: "none",
  },
});
