import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../types"; // Import types
import { supabase } from "../utils/config";
import { MaterialIcons } from "@expo/vector-icons";
import { useTheme } from '../context/ThemeContext';

type SignInScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "SignIn"
>;

type Props = {
  navigation: SignInScreenNavigationProp;
};

export default function SignIn({ navigation }: Props) {
  const { isDarkMode } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

  const handleSignIn = async () => {
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      Alert.alert("Sign-In Error", error.message);
      setLoading(false);
      return;
    }

    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });

    setLoading(false);
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#fff',
      paddingTop: '15%',
      paddingHorizontal: 20,
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
    modalContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    modalContent: {
      backgroundColor: isDarkMode ? '#242424' : "#fff",
      padding: 25,
      borderRadius: 20,
      width: "90%",
      alignItems: "center",
    },
    modalTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      marginBottom: 20,
    },
    cancelButton: {
      backgroundColor: 'transparent',
      paddingVertical: 16,
      width: "100%",
      borderRadius: 12,
      alignItems: "center",
      marginBottom: 15,
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#E0E0E0' : "#32745f",
    },
    cancelButtonText: {
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      fontSize: 18,
      fontWeight: "700",
      letterSpacing: 0.5,
    },
  });

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={isDarkMode ? "#121212" : "#fff"}
      />
      
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
        <Text style={styles.title}>Sign In</Text>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholderTextColor="#888"
        returnKeyType="next"
        onSubmitEditing={() => passwordInputRef.current?.focus()}
        blurOnSubmit={false}
        editable={!loading}
      />

      <View style={styles.passwordContainer}>
        <TextInput
          ref={passwordInputRef}
          style={styles.passwordInput}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          placeholderTextColor="#888"
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
          editable={!loading}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          {showPassword ? (
            <MaterialIcons name="visibility" size={20} color="#5c5c5c" />
          ) : (
            <MaterialIcons name="visibility-off" size={20} color="#5c5c5c" />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={handleSignIn}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Signing In..." : "Sign In"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("SignUp")} disabled={loading}>
        <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setResetModalVisible(true)} disabled={loading}>
        <Text style={styles.linkText}>Forgot your password? Reset it</Text>
      </TouchableOpacity>

      {/* Reset Password Modal */}
      <Modal
        transparent={true}
        visible={resetModalVisible}
        onRequestClose={() => setResetModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Reset Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your email"
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor="#888"
              editable={!loading}
            />
            <TouchableOpacity
              style={styles.button}
              onPress={handlePasswordReset}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Send Reset Link</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => setResetModalVisible(false)}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
