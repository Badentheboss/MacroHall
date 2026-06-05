import React, { useState, useRef } from "react";
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
} from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types"; // Import types
import { supabase } from "../utils/config";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import PrivacyPolicy from "../components/PrivacyPolicy";

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

  const { email, username, password, confirmPassword } = formData;

  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);

  const onChange = (field: string, value: string) => {
    setFormData((prevState) => ({
      ...prevState,
      [field]: value,
    }));
  };

  const onSubmit = async () => {
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
      const { error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
      });

      const { error: profileError } = await supabase
        .from("users")
        .insert({ username: username.trim(), email: email.trim(), birthday });

      if (authError || profileError) {
        Alert.alert("Error", authError?.message || profileError?.message || "Error signing up.");
      } else {
        Alert.alert("Sign Up Successful", "Let's set up your profile.");
        navigation.reset({
          index: 1,
          // Land on the main tab navigator, then immediately show the profile modal
          routes: [
            { name: 'Main' },
            { name: 'UserProfile', params: { firstTimeSetup: true } },
          ],
        });
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
          <Text style={styles.title}>Sign Up</Text>
        </View>

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
          placeholder="Email"
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

        <PrivacyPolicy isDarkMode={isDarkMode} style={styles.policySection} />
      </ScrollView>

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
