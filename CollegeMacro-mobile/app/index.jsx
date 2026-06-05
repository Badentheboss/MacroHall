import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from '../context/ThemeContext';

export default function Home({ navigation }) {
  const { isDarkMode } = useTheme();

  // Dynamic styles based on theme
  const currentStyles = isDarkMode ? darkStyles : lightStyles;

  return (
    <SafeAreaView style={currentStyles.container}>
      {/* StatusBar styling */}
      <StatusBar
        barStyle={isDarkMode ? "light-content" : "dark-content"}
        backgroundColor={isDarkMode ? "#121212" : "#E6EBDE"}
      />

      {/* Header Section */}
      <View style={currentStyles.headerContainer}>
        <Image
          source={require("../assets/images/nutriNavlogo.png")}
          style={currentStyles.headerLogo}
        />
      </View>

      {/* Main Content */}
      <View style={currentStyles.content}>
        {/* Header Section */}
        <View style={currentStyles.header}>
          <Text style={currentStyles.title}>
            Eat Smart, Track Anywhere:{" "}
            <Text style={currentStyles.highlight}>Your Campus Food Diary</Text>
          </Text>
          <Text style={[currentStyles.description, currentStyles.boldText]}>
            Record your meals at any Michigan dining hall, track your dietary needs, and achieve your goals—all in one place.
          </Text>
        </View>

        {/* Call to Action Section */}
        <View style={currentStyles.callToAction}>
          <Text style={[currentStyles.callToActionText, currentStyles.boldText]}>
            NutriNav's new mobile app is your ultimate dining companion—simplifying meal tracking and enhancing your dining experience!
          </Text>
        </View>

        {/* Buttons Section */}
        <View style={currentStyles.buttonContainer}>
          <TouchableOpacity
            style={[currentStyles.button, currentStyles.primaryButton]}
            onPress={() => navigation.navigate("SignIn")}
          >
            <Text style={currentStyles.buttonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[currentStyles.button, currentStyles.secondaryButton]}
            onPress={() => navigation.navigate("SignUp")}
          >
            <Text style={currentStyles.secondaryButtonText}>Start Today</Text>
          </TouchableOpacity>
        </View>

        {/* Phone Graphic Section */}
        <View style={currentStyles.phoneGraphicContainer}>
          <Image
            source={require("../assets/images/nutrinavphonegraphic-removebg-preview.jpg")}
            style={currentStyles.phoneGraphic}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const baseStyles = {
  container: {
    flex: 1,
  },
  headerContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  headerLogo: {
    width: 300,
    height: 70,
    resizeMode: "contain",
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  header: {
    marginBottom: 20,
    marginTop: 10,
  },
  title: {
    fontSize: 27.6,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 25,
  },
  highlight: {
    fontWeight: "bold",
  },
  description: {
    fontSize: 16,
    marginTop: 10,
    textAlign: "center",
    fontWeight: "500",
  },
  callToAction: {
    marginVertical: 10,
    paddingHorizontal: 10,
  },
  callToActionText: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
  },
  boldText: {
    fontWeight: "bold",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-evenly",
    marginTop: 30,
    marginBottom: 0,
  },
  button: {
    paddingVertical: 15,
    paddingHorizontal: 25,
    borderRadius: 15,
  },
  primaryButton: {
    borderWidth: 1,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  phoneGraphicContainer: {
    alignItems: "center",
    marginTop: -20,
  },
  phoneGraphic: {
    width: 500,
    height: 300,
    resizeMode: "contain",
  },
};

// Light Theme Styles
const lightStyles = StyleSheet.create({
  ...baseStyles,
  container: {
    ...baseStyles.container,
    backgroundColor: "#FFFFFF",
  },
  headerContainer: {
    ...baseStyles.headerContainer,
    backgroundColor: "#FFFFFF",
  },
  title: {
    ...baseStyles.title,
    color: "#32745f",
  },
  highlight: {
    ...baseStyles.highlight,
    color: "#2E7D32",
  },
  description: {
    ...baseStyles.description,
    color: "#6E6E6E",
  },
  callToActionText: {
    ...baseStyles.callToActionText,
    color: "#6E6E6E",
  },
  primaryButton: {
    ...baseStyles.primaryButton,
    backgroundColor: "#32745f",
    borderColor: "#32745f",
  },
  buttonText: {
    ...baseStyles.buttonText,
    color: "#FFFF",
  },
  secondaryButton: {
    ...baseStyles.secondaryButton,
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  secondaryButtonText: {
    ...baseStyles.secondaryButtonText,
    color: "#FFFF",
  },
});

// Dark Theme Styles
const darkStyles = StyleSheet.create({
  ...baseStyles,
  container: {
    ...baseStyles.container,
    backgroundColor: "#121212",
  },
  headerContainer: {
    ...baseStyles.headerContainer,
    backgroundColor: "#121212",
  },
  title: {
    ...baseStyles.title,
    color: "#32745f",
  },
  highlight: {
    ...baseStyles.highlight,
    color: "#2E7D32",
  },
  description: {
    ...baseStyles.description,
    color: "#D3D3D3",
  },
  callToActionText: {
    ...baseStyles.callToActionText,
    color: "#D3D3D3",
  },
  primaryButton: {
    ...baseStyles.primaryButton,
    backgroundColor: "#32745f",
    borderColor: "#32745f",
  },
  buttonText: {
    ...baseStyles.buttonText,
    color: "#FFFFFF",
  },
  secondaryButton: {
    ...baseStyles.secondaryButton,
    backgroundColor: "#2E7D32",
    borderColor: "#2E7D32",
  },
  secondaryButtonText: {
    ...baseStyles.secondaryButtonText,
    color: "#FFFFFF",
  },
});
