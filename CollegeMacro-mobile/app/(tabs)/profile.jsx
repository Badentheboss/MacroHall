// Settings: grouped Instagram-style list on the warm Hinge background.
import React, { useState } from "react";
import { View, Pressable, Alert, Modal, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../context/ThemeContext";
import { supabase } from "../../utils/config";
import { useAppTheme, useStyles, radius, space } from "../../theme";
import { Button, Card, Divider, FadeIn, Row, Screen, Segmented, Tap, TextField, Txt } from "../../components/kit";
import PrivacyPolicy from "../../components/PrivacyPolicy";

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

const THEME_OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const ICON_SIZE = 36;
const ROW_INSET = space.lg + ICON_SIZE + space.md;

const makeStyles = (c) => ({
  group: { gap: space.sm },
  overline: { paddingHorizontal: space.xs },
  iconWrap: { width: ICON_SIZE, height: ICON_SIZE, borderRadius: ICON_SIZE / 2, alignItems: "center", justifyContent: "center" },
  row: { paddingHorizontal: space.lg, minHeight: 60 },
  divider: { marginLeft: ROW_INSET },
  appearance: { padding: space.lg, gap: space.md },
  appearanceHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  footer: { alignItems: "center", gap: space.xs, paddingTop: space.sm },
  backdrop: { flex: 1, backgroundColor: c.overlay, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: c.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.lg,
    maxHeight: "88%",
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
  },
  handle: { alignSelf: "center", width: 40, height: 5, borderRadius: 3, backgroundColor: c.hairline },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  sheetActions: { flexDirection: "row", gap: space.md },
  flex: { flex: 1 },
  multiline: { minHeight: 120, textAlignVertical: "top" },
});

// One settings row: icon in a sunken circle, title, optional subtitle, chevron.
function SettingsRow({ icon, title, subtitle, onPress, destructive, accessibilityLabel, trailing }) {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  return (
    <Tap onPress={onPress} scaleTo={0.985} accessibilityRole="button" accessibilityLabel={accessibilityLabel || title}>
      <Row
        style={styles.row}
        leading={
          <View style={[styles.iconWrap, { backgroundColor: destructive ? c.accentSoft : c.sunken }]}>
            <Ionicons name={icon} size={18} color={destructive ? c.accent : c.ink} />
          </View>
        }
        title={
          <Txt variant="bodyStrong" tone={destructive ? "accent" : "ink"} numberOfLines={1}>
            {title}
          </Txt>
        }
        subtitle={subtitle}
        trailing={trailing === undefined ? <Ionicons name="chevron-forward" size={18} color={c.faint} /> : trailing}
      />
    </Tap>
  );
}

function Group({ label, index, children }) {
  const styles = useStyles(makeStyles);
  return (
    <FadeIn index={index} style={styles.group}>
      <Txt variant="overline" tone="muted" style={styles.overline}>
        {label}
      </Txt>
      <Card padded={false}>{children}</Card>
    </FadeIn>
  );
}

// Bottom sheet used for the bug report, account removal and privacy policy.
function Sheet({ visible, onClose, title, children, closeDisabled }) {
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <View style={styles.backdrop}>
          <Pressable style={styles.flex} onPress={closeDisabled ? undefined : onClose} accessibilityRole="button" accessibilityLabel="Close" />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <Txt variant="h2">{title}</Txt>
              <Tap
                onPress={onClose}
                disabled={closeDisabled}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={8}
                style={[styles.iconWrap, { backgroundColor: c.sunken }]}
              >
                <Ionicons name="close" size={18} color={c.ink} />
              </Tap>
            </View>
            {children}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function Profile() {
  const { isDarkMode, themePreference, changeTheme } = useTheme();
  const { c } = useAppTheme();
  const styles = useStyles(makeStyles);
  const navigation = useNavigation();
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [privacyVisible, setPrivacyVisible] = useState(false);
  const [isSubmittingBug, setIsSubmittingBug] = useState(false);

  const appVersion = Constants.expoConfig?.version;

  const deleteAuthUser = async (userId) => {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${BACKEND_URL}/delete-user`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ userId }),
    });

    if (!response.ok) {
      let message = 'Failed to delete account.';
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }
  };

  const deleteUserProfileRow = async (userId) => {
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) throw new Error(error.message);
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Reset the entire navigation stack to Index
      navigation.reset({
        index: 0,
        routes: [{ name: 'Index' }],
      });
    } catch (error) {
      console.log('Error logging out:', error.message);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
  };

  const showBugReportModal = (withScreenshot) => {
    setIncludeScreenshot(withScreenshot);
    setBugModalVisible(true);
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const submitBugReport = async () => {
    try {
      setIsSubmittingBug(true);
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('internal')
        .insert([
          {
            bug: bugDescription,
            resolved: false
          }
        ]);

      if (error) throw error;

      Alert.alert('Success', 'Bug report submitted successfully');
      setBugModalVisible(false);
      setBugDescription('');
    } catch (error) {
      console.error('Error submitting bug report:', error);
      Alert.alert('Error', 'Failed to submit bug report. Please try again.');
    } finally {
      setIsSubmittingBug(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Please type DELETE to confirm.');
      return;
    }

    try {
      setIsDeleting(true);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) {
        Alert.alert('Error', 'No active session found. Please sign in again.');
        return;
      }

      const userId = session.user.id;

      await deleteUserProfileRow(userId);
      await deleteAuthUser(userId);

      setDeleteModalVisible(false);
      setDeleteConfirmation('');

      await supabase.auth.signOut();

      Alert.alert('Account Deleted', 'Your account has been permanently removed.');

      navigation.reset({
        index: 0,
        routes: [{ name: 'Index' }],
      });
    } catch (error) {
      console.error('Error deleting account:', error);
      const message = error instanceof Error ? error.message : 'Unable to remove account at this time. Please try again later.';
      Alert.alert('Error', message);
    } finally {
      setIsDeleting(false);
    }
  };

  const closeBugReport = () => {
    setBugModalVisible(false);
    setBugDescription('');
  };

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setDeleteModalVisible(false);
    setDeleteConfirmation('');
  };

  const deleteConfirmed = deleteConfirmation.trim().toUpperCase() === 'DELETE';

  return (
    <>
      <Screen showsVerticalScrollIndicator={false} contentStyle={{ gap: space.xl, paddingTop: space.sm }}>
        <Group label="Account" index={0}>
          <SettingsRow icon="person-outline" title="Edit profile" subtitle="Name, photo and bio" onPress={() => navigation.navigate('EditProfile')} />
          <Divider style={styles.divider} />
          <SettingsRow icon="body-outline" title="Body & goals" subtitle="Height, weight and daily targets" onPress={() => navigation.navigate('UserProfile')} />
          <Divider style={styles.divider} />
          <SettingsRow icon="leaf-outline" title="Dietary preferences" subtitle="Allergies and how you eat" onPress={() => navigation.navigate('DietaryPreferences')} />
        </Group>

        <Group label="Appearance" index={1}>
          <View style={styles.appearance}>
            <View style={styles.appearanceHead}>
              <View style={[styles.iconWrap, { backgroundColor: c.sunken }]}>
                <Ionicons name={isDarkMode ? "moon-outline" : "sunny-outline"} size={18} color={c.ink} />
              </View>
              <View style={styles.flex}>
                <Txt variant="bodyStrong">Theme</Txt>
                <Txt variant="small" tone="muted">System follows your phone</Txt>
              </View>
            </View>
            <Segmented options={THEME_OPTIONS} value={themePreference} onChange={changeTheme} />
          </View>
        </Group>

        <Group label="Support" index={2}>
          <SettingsRow icon="bug-outline" title="Report a bug" subtitle="Tell us what went wrong" onPress={() => setBugModalVisible(true)} />
          <Divider style={styles.divider} />
          <SettingsRow icon="shield-checkmark-outline" title="Privacy policy" subtitle="What we collect and why" onPress={() => setPrivacyVisible(true)} />
        </Group>

        <Group label="Account actions" index={3}>
          <SettingsRow icon="log-out-outline" title="Log out" destructive trailing={null} onPress={handleLogout} />
          <Divider style={styles.divider} />
          <SettingsRow
            icon="trash-outline"
            title="Remove account"
            subtitle="Permanently erase your data"
            destructive
            trailing={null}
            accessibilityLabel="Remove account"
            onPress={() => {
              setDeleteConfirmation('');
              setDeleteModalVisible(true);
            }}
          />
        </Group>

        <FadeIn index={4} style={styles.footer}>
          <Txt variant="caption" tone="muted">MacroHall{appVersion ? ` · Version ${appVersion}` : ''}</Txt>
        </FadeIn>
      </Screen>

      <Sheet visible={bugModalVisible} onClose={closeBugReport} title="Report a bug">
        <Txt variant="small" tone="muted">
          What happened, and what did you expect? A sentence or two helps us fix it fast.
        </Txt>
        <TextField
          label="What went wrong"
          placeholder="Describe the bug..."
          multiline={true}
          numberOfLines={4}
          value={bugDescription}
          onChangeText={setBugDescription}
          inputStyle={styles.multiline}
        />
        <View style={styles.sheetActions}>
          <View style={styles.flex}>
            <Button title="Cancel" variant="secondary" onPress={closeBugReport} />
          </View>
          <View style={styles.flex}>
            <Button
              title="Send"
              icon="paper-plane-outline"
              onPress={submitBugReport}
              loading={isSubmittingBug}
              disabled={!bugDescription.trim()}
            />
          </View>
        </View>
      </Sheet>

      <Sheet visible={deleteModalVisible} onClose={closeDeleteModal} title="Remove account" closeDisabled={isDeleting}>
        <Txt variant="body" tone="muted">
          Removing your account will permanently erase your meal logs and saved preferences. Type DELETE to confirm.
        </Txt>
        <TextField
          label="Confirm"
          placeholder="Type DELETE to confirm"
          value={deleteConfirmation}
          onChangeText={(text) => setDeleteConfirmation(text)}
          autoCapitalize="characters"
          editable={!isDeleting}
        />
        <View style={styles.sheetActions}>
          <View style={styles.flex}>
            <Button title="Cancel" variant="secondary" onPress={closeDeleteModal} disabled={isDeleting} />
          </View>
          <View style={styles.flex}>
            <Button
              title="Remove"
              variant="accent"
              onPress={handleDeleteAccount}
              loading={isDeleting}
              disabled={isDeleting || !deleteConfirmed}
            />
          </View>
        </View>
      </Sheet>

      <Sheet visible={privacyVisible} onClose={() => setPrivacyVisible(false)} title="Privacy policy">
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginHorizontal: -space.xl }}>
          <PrivacyPolicy isDarkMode={isDarkMode} defaultExpanded style={{ borderWidth: 0, borderRadius: 0, backgroundColor: 'transparent' }} />
        </ScrollView>
      </Sheet>
    </>
  );
}
