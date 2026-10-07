import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { useTheme } from "../../context/ThemeContext";
import { postToBackend } from "../../utils/api";

const SUGGESTIONS = [
  "What's the highest-protein dinner on campus tonight?",
  "How much protein do I have left today?",
  "Build me a 700-calorie lunch",
  "When does the rec center close?",
];

// The backend is stateless; the app keeps the conversation and sends the
// recent turns with each question.
export default function Ask() {
  const { isDarkMode } = useTheme();
  const styles = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef(null);

  const ask = async (text) => {
    const question = text.trim();
    if (!question || thinking) return;

    // Failed exchanges are left out so turns keep alternating user/assistant.
    const history = [...messages.filter((m) => !m.error && !m.failed), { role: "user", content: question }];
    setMessages((current) => [...current, { role: "user", content: question }]);
    setDraft("");
    setThinking(true);

    try {
      const { reply } = await postToBackend("/chat", { messages: history.slice(-20) });
      setMessages((current) => [...current, { role: "assistant", content: reply }]);
    } catch (error) {
      setMessages((current) => {
        const withFailedQuestion = current.map((m, i) => (i === current.length - 1 ? { ...m, failed: true } : m));
        return [...withFailedQuestion, { role: "assistant", content: error.message, error: true }];
      });
    } finally {
      setThinking(false);
    }
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
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.intro}>
            <MaterialIcons name="restaurant-menu" size={36} color="#32745f" />
            <Text style={styles.introTitle}>Ask about food on campus</Text>
            <Text style={styles.introText}>
              I know today's dining hall menus, your macro targets and what you've logged.
            </Text>
            {SUGGESTIONS.map((suggestion) => (
              <TouchableOpacity key={suggestion} style={styles.suggestion} onPress={() => ask(suggestion)}>
                <Text style={styles.suggestionText}>{suggestion}</Text>
              </TouchableOpacity>
            ))}
          </View>
        }
        ListFooterComponent={
          thinking ? (
            <View style={[styles.bubble, styles.theirs, styles.thinking]}>
              <ActivityIndicator size="small" color="#32745f" />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const mine = item.role === "user";
          return (
            <View style={[styles.bubble, mine ? styles.mine : styles.theirs, item.error && styles.errorBubble]}>
              <Text style={mine ? styles.mineText : styles.theirsText}>{item.content}</Text>
            </View>
          );
        }}
      />

      <Text style={styles.disclaimer}>AI can make mistakes. Confirm allergens with dining staff.</Text>
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Ask about menus, macros, or campus"
          placeholderTextColor="#888"
          maxLength={2000}
          multiline
        />
        <TouchableOpacity onPress={() => ask(draft)} disabled={thinking || !draft.trim()} accessibilityLabel="Send">
          <MaterialIcons name="send" size={26} color={draft.trim() && !thinking ? "#32745f" : "#999"} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (isDarkMode) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDarkMode ? "#121212" : "#f5f7fa" },
    list: { padding: 16, flexGrow: 1 },
    intro: { alignItems: "center", paddingTop: 24 },
    introTitle: { fontSize: 20, fontWeight: "800", color: isDarkMode ? "#E0E0E0" : "#32745f", marginTop: 8 },
    introText: {
      fontSize: 14,
      color: isDarkMode ? "#AAA" : "#666",
      textAlign: "center",
      marginTop: 6,
      marginBottom: 16,
      lineHeight: 20,
    },
    suggestion: {
      alignSelf: "stretch",
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "rgba(50,116,95,0.25)",
      backgroundColor: isDarkMode ? "#1E1E1E" : "#fff",
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    suggestionText: { color: isDarkMode ? "#E0E0E0" : "#32745f", fontSize: 14, fontWeight: "600" },
    bubble: { maxWidth: "85%", borderRadius: 16, paddingVertical: 9, paddingHorizontal: 13, marginBottom: 8 },
    mine: { alignSelf: "flex-end", backgroundColor: "#32745f" },
    theirs: { alignSelf: "flex-start", backgroundColor: isDarkMode ? "#2A2A2A" : "#fff" },
    errorBubble: { borderWidth: 1, borderColor: "#E57373" },
    thinking: { paddingVertical: 12 },
    mineText: { color: "#fff", fontSize: 15, lineHeight: 21 },
    theirsText: { color: isDarkMode ? "#E0E0E0" : "#222", fontSize: 15, lineHeight: 21 },
    disclaimer: { fontSize: 11, color: isDarkMode ? "#777" : "#888", textAlign: "center", paddingBottom: 4 },
    composer: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: isDarkMode ? "#333" : "#ddd",
      backgroundColor: isDarkMode ? "#1E1E1E" : "#fff",
    },
    input: { flex: 1, maxHeight: 110, fontSize: 15, color: isDarkMode ? "#E0E0E0" : "#222", paddingVertical: 8 },
  });
