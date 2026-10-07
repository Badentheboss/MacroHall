import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { supabase } from "../utils/config";
import { useTheme } from "../context/ThemeContext";

const QUICK_REPLIES = ["Save me a seat", "On my way!", "Which hall?", "Want to grab food?"];

export default function Conversation({ route, navigation }) {
  const { friendId, friendName } = route.params;
  const { isDarkMode } = useTheme();
  const styles = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);

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
      headerRight: () => (
        <TouchableOpacity onPress={report} style={{ marginRight: 16 }} accessibilityLabel="Report or block">
          <MaterialIcons name="more-horiz" size={24} color={isDarkMode ? "#E0E0E0" : "#32745f"} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, friendName, report, isDarkMode]);

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
        ListEmptyComponent={<Text style={styles.empty}>Say hi to {friendName}.</Text>}
        renderItem={({ item }) => {
          const mine = item.sender_id === me;
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
              <Text style={mine ? styles.mineText : styles.theirsText}>{item.body}</Text>
            </View>
          );
        }}
      />

      <View style={styles.quickRow}>
        {QUICK_REPLIES.map((reply) => (
          <TouchableOpacity key={reply} style={styles.quick} onPress={() => send(reply)} disabled={sending}>
            <Text style={styles.quickText}>{reply}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor="#888"
          maxLength={1000}
          multiline
        />
        <TouchableOpacity onPress={() => send(draft)} disabled={sending || !draft.trim()} accessibilityLabel="Send">
          <MaterialIcons name="send" size={26} color={draft.trim() ? "#32745f" : "#999"} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDarkMode ? "#121212" : "#f5f7fa" },
    list: { padding: 16, flexGrow: 1 },
    empty: { textAlign: "center", color: isDarkMode ? "#999" : "#666", marginTop: 40 },
    bubble: { maxWidth: "78%", borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8 },
    mine: { alignSelf: "flex-end", backgroundColor: "#32745f" },
    theirs: { alignSelf: "flex-start", backgroundColor: isDarkMode ? "#2A2A2A" : "#fff" },
    mineText: { color: "#fff", fontSize: 15 },
    theirsText: { color: isDarkMode ? "#E0E0E0" : "#222", fontSize: 15 },
    quickRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingBottom: 6 },
    quick: {
      borderWidth: 1,
      borderColor: isDarkMode ? "#444" : "rgba(50,116,95,0.3)",
      borderRadius: 14,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    quickText: { color: isDarkMode ? "#E0E0E0" : "#32745f", fontSize: 13, fontWeight: "600" },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDarkMode ? "#333" : "#ddd",
      backgroundColor: isDarkMode ? "#1E1E1E" : "#fff",
    },
    input: {
      flex: 1,
      maxHeight: 110,
      fontSize: 15,
      color: isDarkMode ? "#E0E0E0" : "#222",
      paddingVertical: 8,
    },
  });
