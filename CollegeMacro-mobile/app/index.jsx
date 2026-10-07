import React from "react";
import { Image, ScrollView, StatusBar, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAppTheme, useStyles } from "../theme";
import { Avatar, Button, FadeIn, LiveDot, MacroRing, ProgressBar, Txt } from "../components/kit";
import { DEMO_MODE } from "../utils/config";

// Friends out right now, in the hero collage (default pictures, live rings).
const FRIENDS = [1, 2, 3, 4];

// Hinge-style welcome: the logo, a small collage of what the app does, a
// headline, and the ways in.
export default function Home({ navigation }) {
  const { c, isDark, fonts } = useAppTheme();
  const styles = useStyles(makeStyles);
  // Short phones (SE-sized) get a tighter collage so every button stays above the fold.
  const compact = useWindowDimensions().height < 760;

  const exploreDemo = () => navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  const createAccount = () => navigation.navigate("SignUp");
  const signIn = () => navigation.navigate("SignIn");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={c.bg} />
      <ScrollView contentContainerStyle={styles.scroll} bounces={false} showsVerticalScrollIndicator={false}>
        <FadeIn style={styles.header}>
          <Image
            source={isDark ? require("../assets/images/macrohall-logo-dark.png") : require("../assets/images/macrohall-logo.png")}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="header"
            accessibilityLabel="Macrohall"
          />
        </FadeIn>

        {/* Hero collage, composed from kit pieces instead of images. */}
        <View style={[styles.collage, compact && styles.collageCompact]} accessible={false} importantForAccessibility="no-hide-descendants">
          <View style={[styles.stage, compact && styles.stageCompact]}>
            <FadeIn index={1} style={[styles.ringCardSlot, compact && styles.ringCardSlotCompact]}>
              <View style={[styles.card, styles.ringCard]}>
                <MacroRing progress={0.62} size={84} stroke={8} color={c.accent}>
                  <Ionicons name="restaurant-outline" size={22} color={c.ink} />
                </MacroRing>
                <View style={styles.ringText}>
                  <Txt variant="overline" tone="muted">
                    Today
                  </Txt>
                  <Txt variant="number">1,700</Txt>
                  <Txt variant="caption" tone="muted">
                    cal left
                  </Txt>
                </View>
                {compact ? null : (
                  <View style={styles.macroBars}>
                    <ProgressBar value={0.7} color={c.protein} height={4} />
                    <ProgressBar value={0.45} color={c.carbs} height={4} />
                    <ProgressBar value={0.3} color={c.fat} height={4} />
                  </View>
                )}
              </View>
            </FadeIn>

            <FadeIn index={2} style={styles.friendsCardSlot}>
              <View style={[styles.card, styles.friendsCard]}>
                <View style={styles.avatarStack}>
                  {FRIENDS.map((friend, i) => (
                    <View key={friend} style={[styles.avatarSlot, i > 0 && styles.avatarOverlap, { zIndex: FRIENDS.length - i }]}>
                      <View style={styles.avatarBackdrop}>
                        <Avatar size={40} live />
                      </View>
                    </View>
                  ))}
                </View>
                <View style={styles.liveLine}>
                  <LiveDot size={7} />
                  <Txt variant="caption" numberOfLines={1}>
                    Maya is at South Quad
                  </Txt>
                </View>
              </View>
            </FadeIn>

            <FadeIn index={3} style={styles.heartChipSlot}>
              <View style={styles.heartChip}>
                <View style={styles.heartDisc}>
                  <Ionicons name="heart" size={16} color={c.accent} />
                </View>
                <View>
                  <Txt variant="small" style={{ fontFamily: fonts.bold }}>
                    Teriyaki Salmon
                  </Txt>
                  <Txt variant="caption" tone="muted">
                    38g protein
                  </Txt>
                </View>
              </View>
            </FadeIn>
          </View>
        </View>

        <FadeIn index={4} style={styles.copy}>
          <Txt variant="display" accessibilityRole="header">
            Eat well at the{"\n"}
            <Txt variant="display" color={c.primary}>
              dining hall.
            </Txt>
          </Txt>
          <Txt variant="body" tone="muted">
            Track your macros, find the best plate at every hall, and see where your friends are eating.
          </Txt>
        </FadeIn>

        <FadeIn index={5} style={styles.actions}>
          {DEMO_MODE ? (
            <>
              <Button title="Explore the demo" size="lg" onPress={exploreDemo} />
              <Button title="Create account" variant="secondary" size="lg" onPress={createAccount} />
              <Button title="I already have an account" variant="ghost" onPress={signIn} />
            </>
          ) : (
            <>
              <Button title="Create account" size="lg" onPress={createAccount} />
              <Button title="I already have an account" variant="secondary" size="lg" onPress={signIn} />
            </>
          )}
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (c, { space, radius }) => ({
  safe: { flex: 1, backgroundColor: c.bg },
  scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingBottom: space.lg },
  header: { alignItems: "center", paddingTop: space.md, paddingBottom: space.sm },
  logo: { width: 176, height: 48 },
  collage: { flexGrow: 1, justifyContent: "center", marginVertical: space.lg },
  collageCompact: { marginVertical: space.sm },
  stageCompact: { height: 236 },
  ringCardSlotCompact: { top: 60 },
  stage: { height: 296, width: "100%", maxWidth: 400, alignSelf: "center" },
  card: { backgroundColor: c.surface, borderRadius: radius.lg, padding: space.lg },
  ringCardSlot: { position: "absolute", left: 0, top: 64, width: 236 },
  ringCard: {
    width: 236,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: space.lg,
    transform: [{ rotate: "-5deg" }],
  },
  ringText: { gap: 2 },
  macroBars: { width: "100%", gap: space.xs },
  friendsCardSlot: { position: "absolute", right: 0, top: 0, width: 196 },
  friendsCard: { alignSelf: "flex-end", gap: space.md, transform: [{ rotate: "4deg" }] },
  avatarStack: { flexDirection: "row" },
  avatarSlot: { borderRadius: radius.pill },
  avatarOverlap: { marginLeft: -space.md },
  avatarBackdrop: { backgroundColor: c.surface, borderRadius: radius.pill },
  liveLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  heartChipSlot: { position: "absolute", right: space.sm, bottom: 0 },
  heartChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: c.surface,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingLeft: space.sm,
    paddingRight: space.xl,
    transform: [{ rotate: "-3deg" }],
  },
  heartDisc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: space.md, marginBottom: space.xl },
  actions: { gap: space.md },
});
