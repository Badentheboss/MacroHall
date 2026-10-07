import React, { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { postToBackend } from "../../utils/api";
import { radius, space, type, useAppTheme, useStyles } from "../../theme";
import { FadeIn, Tap, Txt } from "../../components/kit";

// react-native-web renders a multiline input as a two-row textarea; start at one.
const WEB_SINGLE_ROW = Platform.OS === "web" ? { numberOfLines: 1 } : {};

const SUGGESTIONS = [
  "What's the highest-protein dinner on campus tonight?",
  "How much protein do I have left today?",
  "Build me a 700-calorie lunch",
  "When does the rec center close?",
];

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
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.ink, alignItems: "center", justifyContent: "center" }}
    >
      <Ionicons name="arrow-up" size={20} color={c.inverse} />
    </Tap>
  );
}

// One dot of the typing indicator; dots breathe one after another.
function TypingDot({ delay }) {
  const { c } = useAppTheme();
  const opacity = useSharedValue(0.3);
  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(withTiming(1, { duration: 360, easing: Easing.out(Easing.quad) }), withTiming(0.3, { duration: 360, easing: Easing.in(Easing.quad) })),
        -1
      )
    );
  }, [delay, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.muted }, animated]} />;
}

function Typing() {
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.bubble, styles.theirs, styles.typing]} accessible accessibilityLabel="MacroHall is thinking">
      <TypingDot delay={0} />
      <TypingDot delay={160} />
      <TypingDot delay={320} />
    </View>
  );
}

// The backend is stateless; the app keeps the conversation and sends the
// recent turns with each question.
export default function Ask() {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
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

  const canSend = !!draft.trim() && !thinking;

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
            <FadeIn style={styles.introHead}>
              <View style={styles.introIcon}>
                <Ionicons name="sparkles" size={28} color={c.ink} />
              </View>
              <Txt variant="h1" style={{ textAlign: "center" }}>
                Ask about food on campus
              </Txt>
              <Txt variant="body" tone="muted" style={{ textAlign: "center", maxWidth: 320 }}>
                I know today's dining hall menus, your macro targets and what you've logged.
              </Txt>
            </FadeIn>
            <View style={styles.suggestions}>
              <Txt variant="overline" tone="muted" style={{ marginBottom: space.xs }}>
                Try asking
              </Txt>
              {SUGGESTIONS.map((suggestion, index) => (
                <FadeIn key={suggestion} index={index + 1}>
                  <Tap onPress={() => ask(suggestion)} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={`Ask: ${suggestion}`} style={styles.suggestion}>
                    <Txt variant="bodyStrong" style={{ flex: 1 }}>
                      {suggestion}
                    </Txt>
                    <Ionicons name="arrow-forward" size={18} color={c.muted} />
                  </Tap>
                </FadeIn>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={thinking ? <Typing /> : null}
        renderItem={({ item, index }) => {
          const mine = item.role === "user";
          const prev = messages[index - 1];
          const joinsPrev = prev && prev.role === item.role;
          // The question that failed sits just before its error bubble.
          const failedQuestion = item.error ? messages[index - 1]?.content : null;
          return (
            <View style={{ marginTop: index === 0 ? 0 : joinsPrev ? 2 : space.md }}>
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                {item.error ? (
                  <View style={styles.errorHead}>
                    <Ionicons name="alert-circle-outline" size={16} color={c.accent} />
                    <Txt variant="caption" tone="accent" style={{ fontFamily: type.bodyStrong.fontFamily }}>
                      Couldn't answer
                    </Txt>
                  </View>
                ) : null}
                <Txt variant="body" tone={mine ? "inverse" : item.error ? "accent" : "ink"} selectable>
                  {item.content}
                </Txt>
              </View>
              {item.error && failedQuestion ? (
                <Tap
                  onPress={() => ask(failedQuestion)}
                  disabled={thinking}
                  accessibilityRole="button"
                  accessibilityLabel="Try again"
                  hitSlop={8}
                  style={styles.retry}
                >
                  <Ionicons name="refresh" size={14} color={c.muted} />
                  <Txt variant="caption" tone="muted">
                    Tap to try again
                  </Txt>
                </Tap>
              ) : null}
            </View>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
        <Txt variant="caption" tone="muted" style={{ textAlign: "center" }}>
          AI can make mistakes. Confirm allergens with dining staff.
        </Txt>
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about menus, macros, or campus"
            placeholderTextColor={c.faint}
            maxLength={2000}
            multiline
            {...WEB_SINGLE_ROW}
            accessibilityLabel="Ask MacroHall"
          />
          <SendButton onPress={() => ask(draft)} disabled={!canSend} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (c) => ({
  container: { flex: 1, backgroundColor: c.bg },
  list: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, flexGrow: 1 },
  intro: { flex: 1, justifyContent: "center", gap: space.xxl, paddingVertical: space.xl },
  introHead: { alignItems: "center", gap: space.md },
  introIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: c.sunken, alignItems: "center", justifyContent: "center", marginBottom: space.xs },
  suggestions: { gap: space.sm },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg + space.xs,
  },
  bubble: { maxWidth: "85%", borderRadius: 22, paddingVertical: space.sm, paddingHorizontal: space.lg },
  mine: { alignSelf: "flex-end", backgroundColor: c.ink },
  theirs: { alignSelf: "flex-start", backgroundColor: c.surface },
  errorHead: { flexDirection: "row", alignItems: "center", gap: space.xs, marginBottom: space.xs },
  retry: { flexDirection: "row", alignItems: "center", gap: space.xs, alignSelf: "flex-start", paddingVertical: space.xs, paddingHorizontal: space.sm, marginTop: space.xs },
  typing: { flexDirection: "row", alignItems: "center", gap: space.xs, height: 40, marginTop: space.md },
  footer: { backgroundColor: c.bg, paddingTop: space.sm, gap: space.sm },
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
  input: { ...type.body, flex: 1, maxHeight: 120, color: c.ink, paddingVertical: space.sm, outlineStyle: "none" },
});
