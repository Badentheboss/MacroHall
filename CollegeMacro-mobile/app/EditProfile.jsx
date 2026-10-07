import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Button, Card, Chip, ChipRow, FadeIn, ProfilePanel, Row, Screen, Tap, TextField, Txt } from "../components/kit";
import { radius, space, useAppTheme, useStyles } from "../theme";
import { fetchHalls, fetchMySchool } from "../utils/schools";
import { GOALS, VISIBILITY, fetchProfile, getMyUserId, updateMyProfile } from "../utils/profiles";
import { removeAvatar, uploadAvatar } from "../utils/avatars";

const CURRENT_YEAR = new Date().getFullYear();
const CLASS_YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + i);

// Hinge-style profile editor: a live preview of your card on top, then your
// profile photo, your details, and who sees your log.
export default function EditProfile({ navigation }) {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);

  const [form, setForm] = useState(null);
  const [halls, setHalls] = useState([]);
  const [saving, setSaving] = useState(false);
  // Profile photo. Uploads (and removals) save right away, apart from "Save".
  const [userId, setUserId] = useState(null);
  const [avatarPath, setAvatarPath] = useState(null);
  const [pickedUri, setPickedUri] = useState(null); // instant preview of a fresh upload
  const [photoBusy, setPhotoBusy] = useState(null); // null | "upload" | "remove"
  const [photoError, setPhotoError] = useState(null);

  useEffect(() => {
    (async () => {
      const id = await getMyUserId();
      setUserId(id);
      const [profile, school] = await Promise.all([fetchProfile(id), fetchMySchool()]);
      setAvatarPath(profile?.avatar_path || null);
      setForm({
        display_name: profile?.display_name || "",
        username: profile?.username || "",
        bio: profile?.bio || "",
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

  // Alert does nothing on web, so photo errors also show inline.
  const photoFailed = (title, message) => {
    setPhotoError(message);
    Alert.alert(title, message);
  };

  const pickPhoto = async () => {
    if (photoBusy || !userId) return;
    setPhotoError(null);
    try {
      if (Platform.OS !== "web") {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          photoFailed("Photos are off", "Allow access to your photos to add a profile picture.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 5],
        quality: 0.6,
        base64: true,
      });
      const asset = result.canceled ? null : result.assets?.[0];
      if (!asset) return;
      // On web the picked file can arrive as a data URI instead of base64.
      const dataUri = asset.uri?.startsWith("data:") ? asset.uri : null;
      const base64 = asset.base64 || (dataUri ? dataUri.slice(dataUri.indexOf(",") + 1) : null);
      const mimeType = asset.mimeType || (dataUri ? dataUri.slice(5, dataUri.indexOf(";")) : null) || "image/jpeg";
      if (!base64) {
        photoFailed("Couldn't add photo", "That photo couldn't be read. Try another one.");
        return;
      }
      setPhotoBusy("upload");
      const path = await uploadAvatar({ userId, base64, mimeType, previousPath: avatarPath });
      setAvatarPath(path);
      setPickedUri(dataUri || `data:${mimeType};base64,${base64}`);
    } catch (error) {
      photoFailed("Couldn't add photo", error?.message || "Try again in a moment.");
    } finally {
      setPhotoBusy(null);
    }
  };

  const deletePhoto = async () => {
    if (photoBusy || !userId) return;
    setPhotoError(null);
    setPhotoBusy("remove");
    try {
      await removeAvatar({ userId, path: avatarPath });
      setAvatarPath(null);
      setPickedUri(null);
    } catch (error) {
      photoFailed("Couldn't remove photo", error?.message || "Try again in a moment.");
    } finally {
      setPhotoBusy(null);
    }
  };

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
            key={avatarPath || "none"}
            path={avatarPath}
            uri={pickedUri}
            name={form.display_name.trim() || "Your name"}
            subtitle={previewSubtitle || "This is how friends see you"}
            height={320}
          >
            {photoBusy ? (
              <View style={styles.photoBusy} accessibilityLiveRegion="polite" accessibilityLabel={photoBusy === "upload" ? "Uploading photo" : "Removing photo"}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </ProfilePanel>
        </FadeIn>

        <FadeIn index={1}>
          <Section title="Profile photo" caption="Friends see it on your profile and in their friends list.">
            <View style={styles.photoActions}>
              <Button
                title={avatarPath ? "Change photo" : "Add photo"}
                icon="image-outline"
                variant="secondary"
                onPress={pickPhoto}
                loading={photoBusy === "upload"}
                disabled={!!photoBusy}
                accessibilityLabel={photoBusy === "upload" ? "Uploading photo" : avatarPath ? "Change photo" : "Add photo"}
              />
              {avatarPath ? (
                <Button
                  title="Remove photo"
                  variant="ghost"
                  onPress={deletePhoto}
                  loading={photoBusy === "remove"}
                  disabled={!!photoBusy}
                  accessibilityLabel={photoBusy === "remove" ? "Removing photo" : "Remove photo"}
                />
              ) : null}
            </View>
            {photoError ? (
              <Txt variant="caption" tone="accent" accessibilityLiveRegion="polite">
                {photoError}
              </Txt>
            ) : null}
          </Section>
        </FadeIn>

        <FadeIn index={2}>
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

        <FadeIn index={3}>
          <Section title="Goal">
            <View style={styles.wrap}>
              {GOALS.map((goal) => (
                <Chip key={goal.key} label={goal.label} active={form.goal === goal.key} onPress={() => toggle("goal", goal.key)} />
              ))}
            </View>
          </Section>
        </FadeIn>

        <FadeIn index={4}>
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
          <FadeIn index={5}>
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

        <FadeIn index={6}>
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
                          {selected ? <Ionicons name="checkmark" size={16} color={c.onPrimary} /> : null}
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
  photoActions: { gap: space.xs },
  photoBusy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  // Let horizontal chip rows scroll edge to edge of the card.
  bleed: { marginHorizontal: -(space.lg + 4) },
  bleedContent: { paddingHorizontal: space.lg + 4 },
  bioInput: { minHeight: 88, textAlignVertical: "top" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  divided: { borderTopWidth: 1, borderTopColor: c.hairline },
  check: { width: 24, height: 24, borderRadius: radius.pill, borderWidth: 1.5, borderColor: c.faint, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: c.primary, borderColor: c.primary },
});
