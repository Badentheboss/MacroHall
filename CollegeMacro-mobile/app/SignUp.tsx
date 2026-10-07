import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  ScrollView,
  Modal,
} from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types"; // Import types
import { supabase } from "../utils/config";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
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

type School = {
  id: number;
  slug: string;
  name: string;
  short_name: string | null;
  email_domains: string[];
  status: "live" | "coming_soon";
};

type SignUpScreenNavigationProp = StackNavigationProp<RootStackParamList, "SignUp">;

export default function SignUp() {
  const navigation = useNavigation<SignUpScreenNavigationProp>();
  const { isDarkMode } = useTheme();
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
  const [step, setStep] = useState<"form" | "verify">("form");
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

  const onChange = (field: string, value: string) => {
    setFormData((prevState) => ({
      ...prevState,
      [field]: value,
    }));
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

    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }

    if (age < 13) {
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#fff',
      paddingTop: '15%',
      paddingHorizontal: 20,
    },
    scrollContent: {
      paddingBottom: 40,
      flexGrow: 1,
    },
    headerContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 30,
      position: 'relative',
    },
    backButton: {
      position: 'absolute',
      left: 0,
      zIndex: 1,
      padding: 5,
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: "#32745f",
      flex: 1,
      textAlign: 'center',
    },
    input: {
      height: 55,
      width: "100%",
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.2)",
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 15,
      marginBottom: 20,
      fontSize: 16,
      backgroundColor: isDarkMode ? '#242424' : "#fff",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
    },
    passwordContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.2)",
      borderWidth: 1.5,
      borderRadius: 12,
      width: "100%",
      paddingHorizontal: 15,
      marginBottom: 20,
      backgroundColor: isDarkMode ? '#242424' : "#fff",
    },
    passwordInput: {
      flex: 1,
      fontSize: 16,
      height: 55,
      color: isDarkMode ? '#E0E0E0' : "#32745f",
    },
    button: {
      backgroundColor: "#32745f",
      paddingVertical: 16,
      width: "100%",
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 15,
      shadowColor: isDarkMode ? '#000' : "#32745f",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 5,
    },
    buttonText: {
      color: "#fff",
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
    linkText: {
      marginTop: 15,
      color: isDarkMode ? '#E0E0E0' : "#2E7D32",
      fontSize: 16,
      textAlign: "center",
      fontWeight: "600",
    },
    policySection: {
      marginTop: 32,
      marginBottom: 16,
    },
    helperText: {
      fontSize: 16,
      lineHeight: 22,
      color: isDarkMode ? '#D3D3D3' : '#555',
      marginBottom: 20,
      textAlign: 'center',
    },
    codeInput: {
      fontSize: 24,
      letterSpacing: 8,
      textAlign: 'center',
    },
    datePickerButton: {
      height: 55,
      width: "100%",
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.2)",
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 15,
      marginBottom: 20,
      backgroundColor: isDarkMode ? '#242424' : "#fff",
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    datePickerText: {
      fontSize: 16,
      color: isDarkMode ? '#E0E0E0' : '#32745f',
    },
    datePickerPlaceholderText: {
      color: isDarkMode ? '#888' : '#999',
    },
    datePickerModal: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    datePickerContainer: {
      backgroundColor: isDarkMode ? '#1f1f1f' : '#fff',
      borderRadius: 16,
      padding: 20,
      width: '90%',
      maxWidth: 360,
      alignItems: 'center',
    },
    datePickerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDarkMode ? '#E0E0E0' : '#32745f',
      textAlign: 'center',
      marginBottom: 16,
    },
    datePickerWheelWrapper: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
    datePickerWheel: {
      width: Platform.OS === 'ios' ? 320 : '100%',
      alignSelf: 'center',
    },
    datePickerDoneButton: {
      marginTop: 16,
      alignSelf: 'center',
      backgroundColor: '#32745f',
      paddingVertical: 10,
      paddingHorizontal: 24,
      borderRadius: 10,
    },
    datePickerDoneText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 16,
    },
  });

  const handleSubmit = () => {
    onSubmit();
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
            setBirthdayDate(selectedDate);
            setBirthday(selectedDate.toISOString().split('T')[0]);
          }
        },
      });
      return;
    }

    setShowDatePicker(true);
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={isDarkMode ? "#121212" : "#fff"}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons 
              name="arrow-back" 
              size={28} 
              color={isDarkMode ? '#E0E0E0' : '#32745f'} 
            />
          </TouchableOpacity>
          <Text style={styles.title}>{step === "verify" ? "Verify Email" : "Sign Up"}</Text>
        </View>

        {step === "verify" ? (
          <View>
            <Text style={styles.helperText}>
              We sent a code to {normalizeEmail(email)}. Enter it to confirm you're a student at {school?.short_name || school?.name}.
            </Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="Code"
              value={code}
              onChangeText={(text) => setCode(text.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={10}
              placeholderTextColor="#888"
              editable={!loading}
            />
            <TouchableOpacity style={styles.button} onPress={verifyCode} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Verifying..." : "Verify"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={resendCode} disabled={loading}>
              <Text style={styles.linkText}>Didn't get it? Resend code</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setStep("form")} disabled={loading}>
              <Text style={styles.linkText}>Use a different email</Text>
            </TouchableOpacity>
          </View>
        ) : (
        <>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setPickerVisible(true)}
          disabled={loading}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Pick your school"
        >
          <Text style={[styles.datePickerText, !school && styles.datePickerPlaceholderText]} numberOfLines={1}>
            {school ? school.name : "Select Your School"}
          </Text>
          <MaterialIcons name="school" size={22} color={isDarkMode ? '#E0E0E0' : '#32745f'} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="Name"
          value={username}
          onChangeText={(text) => onChange("username", text)}
          autoCapitalize="words"
          placeholderTextColor="#888"
          returnKeyType="done"
          blurOnSubmit={true}
        />

        <TextInput
          ref={emailInputRef}
          style={styles.input}
          placeholder={school?.email_domains?.length ? `you@${school.email_domains[0]}` : "School email (.edu)"}
          value={email}
          onChangeText={(text) => onChange("email", text)}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#888"
          returnKeyType="done"
          blurOnSubmit={true}
        />

        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={openDatePicker}
          disabled={loading}
          activeOpacity={0.9}
        >
          <Text
            style={[
              styles.datePickerText,
              !birthday && styles.datePickerPlaceholderText,
            ]}
          >
            {birthday ? new Date(birthday).toLocaleDateString() : 'Select Date of Birth'}
          </Text>
          <MaterialIcons
            name="calendar-today"
            size={22}
            color={isDarkMode ? '#E0E0E0' : '#32745f'}
          />
        </TouchableOpacity>

        <View style={styles.passwordContainer}>
          <TextInput
            ref={passwordInputRef}
            style={styles.passwordInput}
            placeholder="Password"
            value={password}
            onChangeText={(text) => onChange("password", text)}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            placeholderTextColor="#888"
            returnKeyType="done"
            blurOnSubmit={true}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            {showPassword ? (
              <MaterialIcons name="visibility" size={20} color="#5c5c5c" />
            ) : (
              <MaterialIcons name="visibility-off" size={20} color="#5c5c5c" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.passwordContainer}>
          <TextInput
            ref={confirmPasswordInputRef}
            style={styles.passwordInput}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => onChange("confirmPassword", text)}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            placeholderTextColor="#888"
            returnKeyType="done"
            blurOnSubmit={true}
          />
          <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
            {showConfirmPassword ? (
              <MaterialIcons name="visibility" size={20} color="#5c5c5c" />
            ) : (
              <MaterialIcons name="visibility-off" size={20} color="#5c5c5c" />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Signing Up..." : "Sign Up"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
          <Text style={styles.linkText}>Already have an account? Sign In</Text>
        </TouchableOpacity>
        </>
        )}

        <PrivacyPolicy isDarkMode={isDarkMode} style={styles.policySection} />
      </ScrollView>

      <SchoolPicker
        visible={pickerVisible}
        schools={schools}
        isDarkMode={isDarkMode}
        onClose={() => setPickerVisible(false)}
        onSelect={(selected: School) => {
          setPickerVisible(false);
          if (selected.status === "live") {
            setSchool(selected);
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

      <Modal
        transparent
        visible={missingVisible}
        animationType="fade"
        onRequestClose={() => setMissingVisible(false)}
      >
        <View style={styles.datePickerModal}>
          <View style={styles.datePickerContainer}>
            <Text style={styles.datePickerTitle}>Bring MacroHall to your school</Text>
            <TextInput
              style={styles.input}
              placeholder="School name"
              value={missingSchoolName}
              onChangeText={setMissingSchoolName}
              placeholderTextColor="#888"
            />
            <TextInput
              style={styles.input}
              placeholder="Your .edu email"
              value={missingEmail}
              onChangeText={setMissingEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#888"
            />
            <TouchableOpacity style={styles.button} onPress={submitMissingSchool}>
              <Text style={styles.buttonText}>Join waitlist</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMissingVisible(false)}>
              <Text style={styles.linkText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'ios' && showDatePicker && (
        <View style={styles.datePickerModal}>
          <View style={styles.datePickerContainer}>
            <Text style={styles.datePickerTitle}>Select Your Date of Birth</Text>
            <View style={styles.datePickerWheelWrapper}>
              <DateTimePicker
                value={birthday ? new Date(birthday) : birthdayDate}
                mode="date"
                display="spinner"
                themeVariant={isDarkMode ? 'dark' : 'light'}
                textColor={isDarkMode ? '#FFFFFF' : '#000000'}
                maximumDate={new Date()}
                onChange={(_, selectedDate) => {
                  if (selectedDate) {
                    setBirthdayDate(selectedDate);
                    setBirthday(selectedDate.toISOString().split('T')[0]);
                  }
                }}
                style={styles.datePickerWheel}
              />
            </View>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.datePickerDoneButton}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.datePickerDoneText}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
