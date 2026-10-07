import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  Alert,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
  Modal,
  Pressable,
} from "react-native";
import Animated, { Easing, ReduceMotion, SlideInDown } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { StackNavigationProp } from "@react-navigation/stack";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types"; // Import types
import { supabase } from "../utils/config";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from '../context/ThemeContext';
import PrivacyPolicy from "../components/PrivacyPolicy";
import SchoolPicker from "../components/SchoolPicker";
import {
  emailMatchesSchool,
  fetchSchools,
  isEduEmail,
  joinWaitlist,
  normalizeEmail,
} from "../utils/schools";
import { ensureUserProfile } from "../utils/profile";
import { motion, useAppTheme, useStyles } from "../theme";
import { Button, FadeIn, IconButton, ProgressBar, Tap, TextField, Txt } from "../components/kit";

type School = {
  id: number;
  slug: string;
  name: string;
  short_name: string | null;
  email_domains: string[];
  status: "live" | "coming_soon";
  city?: string | null;
  state?: string | null;
};

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, "SignUp">;

// One question per screen, Hinge style. "verify" comes after the account is created.
const FORM_STEPS = ["school", "name", "email", "birthday", "password"] as const;
type FormStep = (typeof FORM_STEPS)[number];
type Step = FormStep | "verify";

type FieldErrors = Partial<Record<"school" | "email" | "birthday" | "password" | "confirmPassword", string>>;

const STEP_COPY: Record<Step, { icon: keyof typeof Ionicons.glyphMap; title: string }> = {
  school: { icon: "school-outline", title: "What school do you go to?" },
  name: { icon: "person-outline", title: "What's your name?" },
  email: { icon: "mail-outline", title: "What's your school email?" },
  birthday: { icon: "calendar-outline", title: "When's your birthday?" },
  password: { icon: "lock-closed-outline", title: "Create a password" },
  verify: { icon: "shield-checkmark-outline", title: "Check your email" },
};

// Whole years between a birth date and today.
const ageOn = (birthDate: Date) => {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }
  return age;
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

export default function SignUp() {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const { isDarkMode } = useTheme();
  const { c, isDark, type, fonts } = useAppTheme();
  const styles = useStyles(makeStyles);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [birthday, setBirthday] = useState("");
  const [birthdayDate, setBirthdayDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [schools, setSchools] = useState<School[]>([]);
  const [school, setSchool] = useState<School | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [step, setStep] = useState<Step>("school");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [code, setCode] = useState("");
  const [missingVisible, setMissingVisible] = useState(false);
  const [missingSchoolName, setMissingSchoolName] = useState("");
  const [missingEmail, setMissingEmail] = useState("");

  const { email, username, password, confirmPassword } = formData;

  useEffect(() => {
    fetchSchools()
      .then(setSchools)
      .catch(() => Alert.alert("Error", "Couldn't load the school list. Check your connection."));
  }, []);

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const clearError = (field: keyof FieldErrors) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const onChange = (field: string, value: string) => {
    setFormData((prevState) => ({
      ...prevState,
      [field]: value,
    }));
    if (field === "email" || field === "password" || field === "confirmPassword") clearError(field);
  };

  const offerWaitlist = (target: School) => {
    Alert.alert(
      `MacroHall isn't at ${target.short_name || target.name} yet`,
      "Join the waitlist and we'll email you when your dining halls are live.",
      [
        { text: "Not now", style: "cancel" },
        {
          text: "Join waitlist",
          onPress: () => {
            if (!isEduEmail(email) || !emailMatchesSchool(email, target)) {
              setMissingSchoolName(target.name);
              setMissingEmail("");
              setMissingVisible(true);
              return;
            }
            joinWaitlist({ school: target, email })
              .then(() => Alert.alert("You're on the list", `We'll email ${normalizeEmail(email)}.`))
              .catch(() => Alert.alert("Error", "Couldn't join the waitlist. Try again."));
          },
        },
      ]
    );
  };

  const submitMissingSchool = async () => {
    if (missingSchoolName.trim().length < 2) {
      Alert.alert("Missing school", "Enter your school's name.");
      return;
    }
    if (!isEduEmail(missingEmail)) {
      Alert.alert("School email needed", "Use your .edu email so we can tell you when it's live.");
      return;
    }
    try {
      const listed = schools.find((s) => s.name === missingSchoolName.trim()) || null;
      await joinWaitlist({ school: listed, schoolName: missingSchoolName.trim(), email: missingEmail });
      setMissingVisible(false);
      Alert.alert("Thanks!", "We'll email you when MacroHall launches at your school.");
    } catch {
      Alert.alert("Error", "Couldn't send your request. Try again.");
    }
  };

  const finishSignUp = async () => {
    await ensureUserProfile();
    Alert.alert("Sign Up Successful", "Let's set up your profile.");
    navigation.reset({
      index: 1,
      // Land on the main tab navigator, then immediately show the profile modal
      routes: [
        { name: 'Main' },
        { name: 'UserProfile', params: { firstTimeSetup: true } },
      ],
    });
  };

  const verifyCode = async () => {
    if (code.trim().length < 6) {
      Alert.alert("Enter the code", "Type the code from the email we sent you.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: normalizeEmail(email),
        token: code.trim(),
        type: "email",
      });
      if (error) {
        Alert.alert("That code didn't work", error.message);
        return;
      }
      await finishSignUp();
    } catch (error) {
      Alert.alert("Unexpected Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    const { error } = await supabase.auth.resend({ type: "signup", email: normalizeEmail(email) });
    Alert.alert(error ? "Couldn't resend" : "Code sent", error ? error.message : `Check ${normalizeEmail(email)}.`);
  };

  // Final check and account creation. Every rule is checked again here even
  // though each step validates its own fields inline on the way.
  const onSubmit = async () => {
    if (!school) {
      Alert.alert("Pick your school", "Choose the college you attend first.");
      return;
    }

    if (school.status !== "live") {
      offerWaitlist(school);
      return;
    }

    if (!isEduEmail(email)) {
      Alert.alert("School email required", "MacroHall is for students. Sign up with your .edu email.");
      return;
    }

    if (!emailMatchesSchool(email, school)) {
      Alert.alert(
        "Email doesn't match your school",
        `Use your @${school.email_domains[0]} email for ${school.name}.`
      );
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password should be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match.");
      return;
    }

    if (!birthday) {
      Alert.alert("Error", "Please select your date of birth.");
      return;
    }

    const birthDate = new Date(birthday);
    if (Number.isNaN(birthDate.getTime())) {
      Alert.alert("Error", "Please choose a valid date of birth.");
      return;
    }

    if (ageOn(birthDate) < 13) {
      Alert.alert("Sorry", "You must be at least 13 years old to create an account.");
      return;
    }

    setLoading(true);

    try {
      // Profile details ride along as auth metadata so the profile row can be
      // created once the email is verified, even if that happens later.
      const { data, error: authError } = await supabase.auth.signUp({
        email: normalizeEmail(email),
        password: password,
        options: {
          data: { username: username.trim(), birthday, school_id: school.id },
        },
      });

      if (authError) {
        Alert.alert("Error", authError.message || "Error signing up.");
      } else if (data.session) {
        // Email confirmation is off in this Supabase project.
        await finishSignUp();
      } else {
        setCode("");
        setStep("verify");
      }
    } catch (error) {
      Alert.alert("Unexpected Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    onSubmit();
  };

  const setBirthdayFromDate = (selectedDate: Date) => {
    setBirthdayDate(selectedDate);
    setBirthday(selectedDate.toISOString().split('T')[0]);
    clearError("birthday");
  };

  const openDatePicker = () => {
    Keyboard.dismiss();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: birthday ? new Date(birthday) : birthdayDate,
        mode: 'date',
        maximumDate: new Date(),
        onChange: (_, selectedDate) => {
          if (selectedDate) {
            setBirthdayFromDate(selectedDate);
          }
        },
      });
      return;
    }

    setShowDatePicker(true);
  };

  // Inline checks for the current step; returns an error map (empty = OK).
  const validateStep = (current: FormStep): FieldErrors => {
    switch (current) {
      case "school":
        return school ? {} : { school: "Choose the college you attend first." };
      case "email":
        if (!isEduEmail(email)) return { email: "MacroHall is for students. Sign up with your .edu email." };
        if (school && !emailMatchesSchool(email, school)) {
          return { email: `Use your @${school.email_domains[0]} email for ${school.name}.` };
        }
        return {};
      case "birthday": {
        if (!birthday) return { birthday: "Please select your date of birth." };
        const birthDate = new Date(birthday);
        if (Platform.OS === "web" && !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
          return { birthday: "Use the format YYYY-MM-DD." };
        }
        if (Number.isNaN(birthDate.getTime())) return { birthday: "Please choose a valid date of birth." };
        if (ageOn(birthDate) < 13) return { birthday: "You must be at least 13 years old to create an account." };
        return {};
      }
      case "password":
        if (password.length < 6) return { password: "Password should be at least 6 characters long." };
        if (password !== confirmPassword) return { confirmPassword: "Passwords do not match." };
        return {};
      default:
        return {};
    }
  };

  const stepIndex = step === "verify" ? FORM_STEPS.length : FORM_STEPS.indexOf(step);

  const goNext = () => {
    if (step === "verify") return;
    if (step === "school" && school && school.status !== "live") {
      offerWaitlist(school);
      return;
    }
    const found = validateStep(step);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setErrors({});
    if (step === "password") {
      handleSubmit();
      return;
    }
    setStep(FORM_STEPS[stepIndex + 1]);
  };

  const goBack = () => {
    if (loading) return;
    setErrors({});
    if (step === "verify") {
      setStep("email");
    } else if (stepIndex > 0) {
      setStep(FORM_STEPS[stepIndex - 1]);
    } else {
      navigation.goBack();
    }
  };

  const schoolLabel = school?.short_name || school?.name;
  const stepBody: Record<Step, string> = {
    school: "MacroHall works with your campus dining halls, so we start there.",
    name: "This is how your friends will see you.",
    email: `We'll send a code to confirm you're a student${schoolLabel ? ` at ${schoolLabel}` : ""}.`,
    birthday: "You need to be at least 13 to use MacroHall.",
    password: "Use at least 6 characters.",
    verify: `We sent a code to ${normalizeEmail(email)}. Enter it to confirm you're a student at ${schoolLabel}.`,
  };

  const passwordToggle = (shown: boolean, toggle: () => void, label: string) => (
    <View style={styles.eye}>
      <IconButton
        name={shown ? "eye-off-outline" : "eye-outline"}
        label={shown ? `Hide ${label}` : `Show ${label}`}
        onPress={toggle}
        size={20}
        color={c.muted}
      />
    </View>
  );

  const renderStep = () => {
    switch (step) {
      case "school":
        return (
          <View style={styles.fields}>
            <Tap
              onPress={() => {
                clearError("school");
                setPickerVisible(true);
              }}
              disabled={loading}
              scaleTo={0.985}
              accessibilityRole="button"
              accessibilityLabel="Pick your school"
              style={[styles.schoolCard, errors.school ? styles.schoolCardError : null]}
            >
              <View style={[styles.schoolDisc, school ? styles.schoolDiscActive : null]}>
                {school ? (
                  <Txt variant="h2" tone="accent">
                    {(school.short_name || school.name).charAt(0).toUpperCase()}
                  </Txt>
                ) : (
                  <Ionicons name="search" size={20} color={c.ink} />
                )}
              </View>
              <View style={styles.flex}>
                <Txt variant="bodyStrong" numberOfLines={2}>
                  {school ? school.name : "Select your school"}
                </Txt>
                <Txt variant="caption" tone="muted" numberOfLines={1}>
                  {school
                    ? [[school.city, school.state].filter(Boolean).join(", "), `@${school.email_domains?.[0] || ""}`]
                        .filter((part) => part && part !== "@")
                        .join("  ·  ")
                    : "Search by name or email domain"}
                </Txt>
              </View>
              {school ? (
                <Txt variant="small" tone="accent" style={{ fontFamily: fonts.bold }}>
                  Change
                </Txt>
              ) : (
                <Ionicons name="chevron-forward" size={20} color={c.muted} />
              )}
            </Tap>
            {errors.school ? (
              <Txt variant="caption" tone="accent">
                {errors.school}
              </Txt>
            ) : null}
          </View>
        );
      case "name":
        return (
          <TextField
            label="Name"
            placeholder="First and last name"
            value={username}
            onChangeText={(text: string) => onChange("username", text)}
            autoCapitalize="words"
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={goNext}
            autoFocus
          />
        );
      case "email":
        return (
          <TextField
            ref={emailInputRef}
            label="School email"
            icon="mail-outline"
            placeholder={school?.email_domains?.length ? `you@${school.email_domains[0]}` : "School email (.edu)"}
            value={email}
            onChangeText={(text: string) => onChange("email", text)}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={goNext}
            error={errors.email}
            autoFocus
          />
        );
      case "birthday":
        return Platform.OS === "web" ? (
          // The native date pickers don't exist on web, so type the date.
          <TextField
            label="Date of birth"
            icon="calendar-outline"
            placeholder="YYYY-MM-DD"
            value={birthday}
            onChangeText={(text: string) => {
              setBirthday(text.replace(/[^0-9-]/g, "").slice(0, 10));
              clearError("birthday");
            }}
            keyboardType="numbers-and-punctuation"
            returnKeyType="next"
            onSubmitEditing={goNext}
            error={errors.birthday}
            hint="For example, 2005-09-14"
            autoFocus
          />
        ) : (
          <View style={styles.fieldGroup}>
            <Txt variant="small" style={{ fontFamily: fonts.semibold }}>
              Date of birth
            </Txt>
            <Tap
              onPress={openDatePicker}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={birthday ? `Date of birth, ${new Date(birthday).toLocaleDateString()}` : "Select date of birth"}
              style={[styles.dateField, errors.birthday ? styles.fieldError : null]}
            >
              <Ionicons name="calendar-outline" size={18} color={c.muted} />
              <Txt variant="body" tone={birthday ? "ink" : "faint"} style={styles.flex}>
                {birthday ? new Date(birthday).toLocaleDateString() : "Select date of birth"}
              </Txt>
              <Ionicons name="chevron-down" size={18} color={c.muted} />
            </Tap>
            {errors.birthday ? (
              <Txt variant="caption" tone="accent">
                {errors.birthday}
              </Txt>
            ) : null}
          </View>
        );
      case "password":
        return (
          <View style={styles.fields}>
            <View>
              <TextField
                ref={passwordInputRef}
                label="Password"
                icon="lock-closed-outline"
                placeholder="At least 6 characters"
                value={password}
                onChangeText={(text: string) => onChange("password", text)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="next"
                onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                blurOnSubmit={false}
                error={errors.password}
                inputStyle={styles.passwordInput}
                autoFocus
              />
              {passwordToggle(showPassword, () => setShowPassword(!showPassword), "password")}
            </View>
            <View>
              <TextField
                ref={confirmPasswordInputRef}
                label="Confirm password"
                icon="lock-closed-outline"
                placeholder="Type it again"
                value={confirmPassword}
                onChangeText={(text: string) => onChange("confirmPassword", text)}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                textContentType="newPassword"
                returnKeyType="go"
                onSubmitEditing={goNext}
                error={errors.confirmPassword}
                inputStyle={styles.passwordInput}
              />
              {passwordToggle(showConfirmPassword, () => setShowConfirmPassword(!showConfirmPassword), "confirm password")}
            </View>
            <View style={styles.policy}>
              <Txt variant="caption" tone="muted">
                By creating an account, you agree to how we handle your data:
              </Txt>
              <PrivacyPolicy isDarkMode={isDarkMode} />
            </View>
          </View>
        );
      case "verify":
        return (
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
        );
      default:
        return null;
    }
  };

  const copy = STEP_COPY[step];
  const primaryTitle = step === "verify" ? "Verify" : step === "password" ? "Create account" : "Continue";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={c.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <View style={styles.topBar}>
          <IconButton name="chevron-back" label="Back" onPress={goBack} size={26} />
          <View
            style={styles.progress}
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={step === "verify" ? "Last step" : `Step ${stepIndex + 1} of ${FORM_STEPS.length}`}
          >
            <ProgressBar value={(stepIndex + 1) / (FORM_STEPS.length + 1)} height={4} />
          </View>
          <View style={styles.topBarSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn key={`${step}-heading`} style={styles.heading}>
            <View style={styles.stepIcon}>
              <Ionicons name={copy.icon} size={22} color={c.ink} />
            </View>
            <Txt variant="h1" accessibilityRole="header">
              {copy.title}
            </Txt>
            <Txt variant="body" tone="muted">
              {stepBody[step]}
            </Txt>
          </FadeIn>

          <FadeIn key={`${step}-fields`} index={1}>
            {renderStep()}
          </FadeIn>
        </ScrollView>

        <View style={styles.footer}>
          <Button
            title={primaryTitle}
            size="lg"
            onPress={step === "verify" ? verifyCode : goNext}
            loading={loading}
          />
          {step === "school" ? (
            <Pressable
              onPress={() => navigation.navigate("SignIn")}
              accessibilityRole="button"
              accessibilityLabel="Already have an account? Sign in"
              hitSlop={8}
              style={styles.switchLink}
            >
              <Txt variant="small" tone="muted" style={{ textAlign: "center" }}>
                Already have an account?{" "}
                <Txt variant="small" tone="accent" style={{ fontFamily: fonts.bold }}>
                  Sign in
                </Txt>
              </Txt>
            </Pressable>
          ) : null}
          {step === "verify" ? (
            <View style={styles.verifyLinks}>
              <Button title="Resend code" variant="ghost" size="sm" onPress={resendCode} disabled={loading} />
              <Button
                title="Use a different email"
                variant="ghost"
                size="sm"
                onPress={() => setStep("email")}
                disabled={loading}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      <SchoolPicker
        visible={pickerVisible}
        schools={schools}
        isDarkMode={isDarkMode}
        selectedId={school?.id ?? null}
        onClose={() => setPickerVisible(false)}
        onSelect={(selected: School) => {
          setPickerVisible(false);
          if (selected.status === "live") {
            setSchool(selected);
            clearError("school");
          } else {
            // iOS drops alerts raised while a modal is still animating closed.
            setTimeout(() => offerWaitlist(selected), 450);
          }
        }}
        onRequestMissing={() => {
          setPickerVisible(false);
          setMissingSchoolName("");
          setMissingEmail(email);
          setTimeout(() => setMissingVisible(true), 450);
        }}
      />

      <Sheet
        visible={missingVisible}
        onClose={() => setMissingVisible(false)}
        title="Bring MacroHall to your school"
        body="Tell us where you go and we'll email you when it's live."
      >
        <TextField
          label="School name"
          icon="school-outline"
          placeholder="School name"
          value={missingSchoolName}
          onChangeText={setMissingSchoolName}
        />
        <TextField
          label="School email"
          icon="mail-outline"
          placeholder="Your .edu email"
          value={missingEmail}
          onChangeText={setMissingEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.sheetActions}>
          <Button title="Join waitlist" size="lg" onPress={submitMissingSchool} />
          <Button title="Cancel" variant="ghost" onPress={() => setMissingVisible(false)} />
        </View>
      </Sheet>

      {Platform.OS === 'ios' && (
        <Sheet visible={showDatePicker} onClose={() => setShowDatePicker(false)} title="Your date of birth">
          <View style={styles.datePickerWheelWrapper}>
            <DateTimePicker
              value={birthday ? new Date(birthday) : birthdayDate}
              mode="date"
              display="spinner"
              themeVariant={isDark ? 'dark' : 'light'}
              textColor={c.ink}
              maximumDate={new Date()}
              onChange={(_, selectedDate) => {
                if (selectedDate) {
                  setBirthdayFromDate(selectedDate);
                }
              }}
              style={styles.datePickerWheel}
            />
          </View>
          <Button title="Done" size="lg" onPress={() => setShowDatePicker(false)} />
        </Sheet>
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: any, { space, radius }: any) => ({
  safe: { flex: 1, backgroundColor: c.bg },
  flex: { flex: 1 },
  topBar: { flexDirection: "row" as const, alignItems: "center" as const, paddingHorizontal: space.sm, paddingTop: space.xs, gap: space.sm },
  progress: { flex: 1 },
  topBarSpacer: { width: 44 },
  scroll: { flexGrow: 1, paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.xl, gap: space.xxl },
  heading: { gap: space.md },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.surface,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginBottom: space.xs,
  },
  fields: { gap: space.lg },
  fieldGroup: { gap: 6 },
  schoolCard: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space.md,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: space.lg,
    minHeight: 76,
  },
  schoolCardError: { borderWidth: 1.5, borderColor: c.accent },
  schoolDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.sunken,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  schoolDiscActive: { backgroundColor: c.accentSoft },
  dateField: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: space.sm,
    backgroundColor: c.sunken,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  fieldError: { borderWidth: 1.5, borderColor: c.accent },
  passwordInput: { paddingRight: 44 },
  eye: { position: "absolute" as const, right: space.xs, top: 30 },
  policy: { gap: space.sm, marginTop: space.sm },
  codeInput: { textAlign: "center" as const, letterSpacing: 10, paddingVertical: space.sm },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: space.sm, gap: space.md },
  switchLink: { alignSelf: "center" as const, paddingVertical: space.sm },
  verifyLinks: { flexDirection: "row" as const, justifyContent: "center" as const, gap: space.sm },
  sheetActions: { gap: space.sm, marginTop: space.xs },
  datePickerWheelWrapper: { width: "100%" as const, alignItems: "center" as const, justifyContent: "center" as const },
  datePickerWheel: { width: 320, alignSelf: "center" as const },
});
