import React, { useState, useRef } from "react";
import {
  View,
  TextInput,
  Alert,
  Modal,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
} from "react-native";
import Animated, { Easing, ReduceMotion, SlideInDown } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types"; // Import types
import { supabase } from "../utils/config";
import { ensureUserProfile } from "../utils/profile";
import { normalizeEmail } from "../utils/schools";
import { motion, useAppTheme, useStyles } from "../theme";
import { Button, FadeIn, IconButton, TextField, Txt } from "../components/kit";

type SignInScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "SignIn"
>;

type Props = {
  navigation: SignInScreenNavigationProp;
};

// Bottom sheet on a dimmed backdrop: grabber, serif title, then content.
function Sheet({
  visible,
  onClose,
  title,
  body,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  const { c, isDark, space, radius } = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: c.overlay }}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <Animated.View
          entering={SlideInDown.duration(motion.base).easing(Easing.bezier(0.33, 1, 0.68, 1)).reduceMotion(ReduceMotion.System)}
          accessibilityViewIsModal
          style={{
            backgroundColor: isDark ? c.surface : c.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingHorizontal: space.xl,
            paddingTop: space.md,
            paddingBottom: insets.bottom + space.xl,
            gap: space.lg,
            width: "100%",
            maxWidth: 560,
            alignSelf: "center",
          }}
        >
          <View style={{ alignSelf: "center", width: 40, height: 5, borderRadius: radius.pill, backgroundColor: c.hairline }} />
          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Txt variant="h1" accessibilityRole="header">
              {title}
            </Txt>
            {body ? (
              <Txt variant="body" tone="muted">
                {body}
              </Txt>
            ) : null}
          </View>
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function SignIn({ navigation }: Props) {
  const { c, isDark, type, fonts } = useAppTheme();
  const styles = useStyles(makeStyles);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [verifyVisible, setVerifyVisible] = useState(false);
  const [code, setCode] = useState("");
  const passwordInputRef = useRef<TextInput>(null);

  const enterApp = async () => {
    try {
      // Accounts verified after sign-up get their profile row on first sign-in.
      await ensureUserProfile();
    } catch (error) {
      console.error("Error creating profile:", error);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const handleSignIn = async () => {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error) {
      setLoading(false);
      if (/not confirmed/i.test(error.message)) {
        await supabase.auth.resend({ type: "signup", email: normalizeEmail(email) });
        setCode("");
        setVerifyVisible(true);
        return;
      }
      Alert.alert("Sign-In Error", error.message);
      return;
    }

    await enterApp();
    setLoading(false);
  };

  const handleVerify = async () => {
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email: normalizeEmail(email),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (error) {
      Alert.alert("That code didn't work", error.message);
      return;
    }
    setVerifyVisible(false);
    await enterApp();
  };

  const handleResendCode = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email: normalizeEmail(email) });
    Alert.alert(error ? "Couldn't resend" : "Code sent", error ? error.message : `Check ${normalizeEmail(email)}.`);
  };

  const handlePasswordReset = async () => {
    if (!resetEmail.trim()) {
      Alert.alert("Missing Email", "Please enter your email.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim());

    if (error) {
      Alert.alert("Reset Password Error", error.message);
    } else {
      Alert.alert(
        "Reset Password Email Sent",
        "Check your email for the password reset link."
      );
      setResetModalVisible(false);
    }
  };

  const handleSubmit = () => {
    handleSignIn(); // Your existing sign in function
  };

  const openReset = () => {
    setResetEmail((current) => current || email.trim());
    setResetModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={c.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <View style={styles.topBar}>
          <IconButton name="chevron-back" label="Back" onPress={() => navigation.goBack()} size={26} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn style={styles.heading}>
            <Txt variant="h1" accessibilityRole="header">
              Welcome back
            </Txt>
            <Txt variant="body" tone="muted">
              Sign in with your school email to pick up where you left off.
            </Txt>
          </FadeIn>

          <FadeIn index={1} style={styles.fields}>
            <TextField
              label="School email"
              icon="mail-outline"
              placeholder="you@school.edu"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
              blurOnSubmit={false}
              editable={!loading}
            />

            <View>
              <TextField
                ref={passwordInputRef}
                label="Password"
                icon="lock-closed-outline"
                placeholder="Your password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                editable={!loading}
                inputStyle={styles.passwordInput}
              />
              <View style={styles.eye}>
                <IconButton
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  label={showPassword ? "Hide password" : "Show password"}
                  onPress={() => setShowPassword(!showPassword)}
                  size={20}
                  color={c.muted}
                />
              </View>
            </View>

            <Button
              title="Forgot password?"
              variant="ghost"
              size="sm"
              onPress={openReset}
              disabled={loading}
              style={styles.forgot}
            />
          </FadeIn>
        </ScrollView>

        <FadeIn index={2} style={styles.footer}>
          <Button title="Sign in" size="lg" onPress={handleSignIn} loading={loading} />
          <Pressable
            onPress={() => navigation.navigate("SignUp")}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="New here? Create an account"
            hitSlop={8}
            style={styles.switchLink}
          >
            <Txt variant="small" tone="muted" style={{ textAlign: "center" }}>
              New here?{" "}
              <Txt variant="small" tone="accent" style={{ fontFamily: fonts.bold }}>
                Create an account
              </Txt>
            </Txt>
          </Pressable>
        </FadeIn>
      </KeyboardAvoidingView>

      {/* Email verification for accounts that never entered their sign-up code */}
      <Sheet
        visible={verifyVisible}
        onClose={() => setVerifyVisible(false)}
        title="Verify your email"
        body={`We sent a new code to ${normalizeEmail(email)}.`}
      >
        <TextField
          accessibilityLabel="Verification code"
          placeholder="000000"
          value={code}
          onChangeText={(text: string) => setCode(text.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={10}
          editable={!loading}
          autoFocus
          inputStyle={[type.h1, styles.codeInput]}
        />
        <View style={styles.sheetActions}>
          <Button title="Verify" size="lg" onPress={handleVerify} loading={loading} />
          <Button title="Resend code" variant="ghost" onPress={handleResendCode} disabled={loading} />
          <Button title="Cancel" variant="ghost" size="sm" onPress={() => setVerifyVisible(false)} disabled={loading} />
        </View>
      </Sheet>

      {/* Reset Password Modal */}
      <Sheet
        visible={resetModalVisible}
        onClose={() => setResetModalVisible(false)}
        title="Reset your password"
        body="We'll email you a link to choose a new one."
      >
        <TextField
          label="School email"
          icon="mail-outline"
          placeholder="you@school.edu"
          value={resetEmail}
          onChangeText={setResetEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        <View style={styles.sheetActions}>
          <Button title="Send reset link" size="lg" onPress={handlePasswordReset} disabled={loading} />
          <Button title="Cancel" variant="ghost" onPress={() => setResetModalVisible(false)} disabled={loading} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

const makeStyles = (c: any, { space }: any) => ({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  topBar: { paddingHorizontal: space.sm, paddingTop: space.xs },
  scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xl, gap: space.xxl },
  heading: { gap: space.sm },
  fields: { gap: space.lg },
  passwordInput: { paddingRight: 44 },
  eye: { position: "absolute" as const, right: space.xs, bottom: 4 },
  forgot: { alignSelf: "flex-end" as const, marginTop: -space.sm, marginRight: -space.md },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: space.sm, gap: space.lg },
  switchLink: { alignSelf: "center" as const, paddingVertical: space.sm },
  codeInput: { textAlign: "center" as const, letterSpacing: 10, paddingVertical: space.sm },
  sheetActions: { gap: space.sm, marginTop: space.xs },
});
