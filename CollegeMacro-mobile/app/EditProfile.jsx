import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Chip, ChipRow, FadeIn, ProfilePanel, Row, Screen, Tap, TextField, Txt } from "../components/kit";
import { radius, space, useAppTheme, useStyles } from "../theme";
import { fetchHalls, fetchMySchool } from "../utils/schools";
import { ACCENTS, AVATARS, GOALS, VISIBILITY, fetchProfile, getMyUserId, updateMyProfile } from "../utils/profiles";

const CURRENT_YEAR = new Date().getFullYear();
const CLASS_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);

// Hinge-style profile editor: a live preview of your card on top, then
// pickers for your emoji and color, your details, and who sees your log.
export default function EditProfile({ navigation }) {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);

  const [form, setForm] = useState(null);
  const [halls, setHalls] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [profile, school] = await Promise.all([getMyUserId().then(fetchProfile), fetchMySchool()]);
      setForm({
        display_name: profile?.display_name || "",
        username: profile?.username || "",
        bio: profile?.bio || "",
        avatar_emoji: profile?.avatar_emoji || "🍽️",
        accent_color: profile?.accent_color || "#32745f",
        goal: profile?.goal || null,
        class_year: profile?.class_year || null,
        favorite_hall_id: profile?.favorite_hall?.id || null,
        log_visibility: profile?.log_visibility || "friends",
      });
      if (school) setHalls(await fetchHalls(school.id));
    })().catch(() => Alert.alert("Error", "Couldn't load your profile."));
  }, []);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const toggle = (key, value) => setForm((current) => ({ ...current, [key]: current[key] === value ? null : value }));

  const save = async () => {
    if (!form.display_name.trim()) {
      Alert.alert("Name required", "Add the name friends will see.");
      return;
    }
    setSaving(true);
    try {
      await updateMyProfile({
        ...form,
        display_name: form.display_name.trim(),
        username: form.username.trim().toLowerCase() || null,
        bio: form.bio.trim() || null,
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert("Couldn't save", error.message);
    } finally {
      setSaving(false);
    }
  };

  if (!form) {
    return (
      <Screen scroll={false} style={styles.center}>
        <ActivityIndicator color={c.muted} />
      </Screen>
    );
  }

  const previewSubtitle = [form.username ? `@${form.username}` : null, form.class_year ? `Class of ${form.class_year}` : null].filter(Boolean).join(" · ");

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen contentStyle={styles.content}>
        <FadeIn index={0}>
          <ProfilePanel
            emoji={form.avatar_emoji}
            color={form.accent_color}
            name={form.display_name.trim() || "Your name"}
            subtitle={previewSubtitle || "This is how friends see you"}
            height={320}
          />
        </FadeIn>

        <FadeIn index={1}>
          <Section title="Avatar" caption="Pick the emoji on your profile.">
            <View style={styles.grid}>
              {AVATARS.map((emoji) => {
                const selected = form.avatar_emoji === emoji;
                return (
                  <View key={emoji} style={styles.emojiCell}>
                    <Tap
                      onPress={() => set("avatar_emoji", emoji)}
                      accessibilityRole="button"
                      accessibilityLabel={`Avatar ${emoji}`}
                      accessibilityState={{ selected }}
                      style={[styles.ringWrap, selected && styles.ringOn]}
                    >
                      <View style={styles.emoji}>
                        <Txt style={styles.emojiText}>{emoji}</Txt>
                      </View>
                    </Tap>
                  </View>
                );
              })}
            </View>
          </Section>
        </FadeIn>

        <FadeIn index={2}>
          <Section title="Color" caption="Tints your profile card.">
            <View style={styles.grid}>
              {ACCENTS.map((color) => {
                const selected = form.accent_color === color;
                return (
                  <View key={color} style={styles.swatchCell}>
                    <Tap
                      onPress={() => set("accent_color", color)}
                      accessibilityRole="button"
                      accessibilityLabel={`Color ${color}`}
                      accessibilityState={{ selected }}
                      style={[styles.swatchRing, selected && styles.ringOn]}
                    >
                      <View style={[styles.swatch, { backgroundColor: color }]}>
                        {selected ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
                      </View>
                    </Tap>
                  </View>
                );
              })}
            </View>
          </Section>
        </FadeIn>

        <FadeIn index={3}>
          <Section title="About you">
            <TextField
              label="Name"
              value={form.display_name}
              onChangeText={(v) => set("display_name", v)}
              maxLength={60}
              placeholder="The name friends will see"
            />
            <TextField
              label="Username"
              icon="at"
              value={form.username}
              onChangeText={(v) => set("username", v.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              placeholder="so friends can find you"
            />
            <TextField
              label="Bio"
              value={form.bio}
              onChangeText={(v) => set("bio", v)}
              maxLength={160}
              multiline
              placeholder="PPL 6x/week · chasing 180g protein"
              inputStyle={styles.bioInput}
              hint={`${form.bio.length}/160`}
            />
          </Section>
        </FadeIn>

        <FadeIn index={4}>
          <Section title="Goal">
            <View style={styles.wrap}>
              {GOALS.map((goal) => (
                <Chip key={goal.key} label={goal.label} active={form.goal === goal.key} onPress={() => toggle("goal", goal.key)} />
              ))}
            </View>
          </Section>
        </FadeIn>

        <FadeIn index={5}>
          <Section title="Class of">
            <View style={styles.bleed}>
              <ChipRow style={styles.bleedContent}>
                {CLASS_YEARS.map((year) => (
                  <Chip key={year} label={String(year)} active={form.class_year === year} onPress={() => toggle("class_year", year)} />
                ))}
              </ChipRow>
            </View>
          </Section>
        </FadeIn>

        {halls.length > 0 && (
          <FadeIn index={6}>
            <Section title="Favorite dining hall">
              <View style={styles.bleed}>
                <ChipRow style={styles.bleedContent}>
                  {halls.map((hall) => (
                    <Chip
                      key={hall.id}
                      label={hall.name}
                      icon="location-outline"
                      active={form.favorite_hall_id === hall.id}
                      onPress={() => toggle("favorite_hall_id", hall.id)}
                    />
                  ))}
                </ChipRow>
              </View>
            </Section>
          </FadeIn>
        )}

        <FadeIn index={7}>
          <Section title="Who can see what you eat">
            <View>
              {VISIBILITY.map((option, index) => {
                const selected = form.log_visibility === option.key;
                return (
                  <Tap
                    key={option.key}
                    onPress={() => set("log_visibility", option.key)}
                    scaleTo={0.985}
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    accessibilityLabel={`${option.label}. ${option.hint}`}
                    style={index > 0 ? styles.divided : null}
                  >
                    <Row
                      title={option.label}
                      subtitle={option.hint}
                      trailing={
                        <View style={[styles.check, selected && styles.checkOn]}>
                          {selected ? <Ionicons name="checkmark" size={16} color={c.inverse} /> : null}
                        </View>
                      }
                    />
                  </Tap>
                );
              })}
            </View>
          </Section>
        </FadeIn>

        <Button title="Save" size="lg" onPress={save} loading={saving} disabled={saving} accessibilityLabel={saving ? "Saving" : "Save"} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Section({ title, caption, children }) {
  const styles = useStyles(makeStyles);
  return (
    <Card style={styles.section}>
      <View style={{ gap: 2 }}>
        <Txt variant="title">{title}</Txt>
        {caption ? (
          <Txt variant="caption" tone="muted">
            {caption}
          </Txt>
        ) : null}
      </View>
      {children}
    </Card>
  );
}

const makeStyles = (c) => ({
  flex: { flex: 1, backgroundColor: c.bg },
  center: { alignItems: "center", justifyContent: "center" },
  content: { paddingBottom: space.xxxl + space.xl },
  section: { gap: space.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space.sm },
  emojiCell: { width: `${100 / 6}%`, alignItems: "center" },
  ringWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.sunken,
    borderWidth: 2,
    borderColor: "transparent",
  },
  ringOn: { borderColor: c.ink },
  emoji: { alignItems: "center", justifyContent: "center" },
  emojiText: { fontSize: 24, lineHeight: 30 },
  swatchCell: { width: "20%", alignItems: "center" },
  swatchRing: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  // Let horizontal chip rows scroll edge to edge of the card.
  bleed: { marginHorizontal: -(space.lg + 4) },
  bleedContent: { paddingHorizontal: space.lg + 4 },
  bioInput: { minHeight: 88, textAlignVertical: "top" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  divided: { borderTopWidth: 1, borderTopColor: c.hairline },
  check: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.faint, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: c.ink, borderColor: c.ink },
});
