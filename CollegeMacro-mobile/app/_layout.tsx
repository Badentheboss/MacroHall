import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { NavigationProp } from "@react-navigation/native";
import { Image, TouchableOpacity } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

import Index from "./index";
import SignIn from "./SignIn";
import SignUp from "./SignUp";
import AddFood from "./(tabs)/AddFood";
import Dashboard from "./(tabs)/Dashboard";
import Log from "./(tabs)/Log";
import Profile from "./(tabs)/profile";
import UserProfile from "./(tabs)/UserProfile";
import DietaryPreferences from "./DietaryPreferences";

import { RootStackParamList } from "../types";
import { ThemeProvider } from "../context/ThemeContext";
import { useTheme } from "../context/ThemeContext";

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabNavigator({
  navigation,
}: {
  navigation: NavigationProp<RootStackParamList>;
}) {
  const { isDarkMode } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ navigation }) => ({
        tabBarActiveTintColor: "#32745f",
        tabBarInactiveTintColor: isDarkMode ? "#888" : "#6E6E6E",
        tabBarStyle: {
          backgroundColor: isDarkMode ? "#242424" : "#fff",
          borderTopColor: isDarkMode ? "#333" : "rgba(50,116,95,0.1)",
          borderTopWidth: 1,
        },
        headerStyle: {
          backgroundColor: isDarkMode ? "#121212" : "#fff",
          borderBottomColor: isDarkMode ? "#333" : "rgba(50,116,95,0.1)",
          borderBottomWidth: 1,
        },
        headerTintColor: isDarkMode ? "#E0E0E0" : "#32745f",
        headerRight: () => (
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            style={{ marginRight: 16 }}
          >
            <MaterialIcons
              name="settings"
              size={24}
              color={isDarkMode ? "#E0E0E0" : "#32745f"}
            />
          </TouchableOpacity>
        ),
      })}
    >
      <Tab.Screen
        name="Log"
        component={Log}
        options={{
          headerTitle: () => (
            <Image
              source={require("../assets/images/nutriNavlogo.png")}
              style={{ width: 150, height: 50, resizeMode: "contain" }}
            />
          ),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="restaurant-menu" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="Dashboard"
        component={Dashboard}
        options={({ navigation }) => ({
          headerTitle: () => (
            <Image
              source={require("../assets/images/nutriNavlogo.png")}
              style={{ width: 150, height: 50, resizeMode: "contain" }}
            />
          ),
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => navigation.navigate("UserProfile")}
              style={{ marginLeft: 16 }}
            >
              <MaterialIcons
                name="person"
                size={24}
                color={isDarkMode ? "#E0E0E0" : "#32745f"}
              />
            </TouchableOpacity>
          ),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="dashboard" size={size} color={color} />
          ),
        })}
      />

      <Tab.Screen
        name="AddFood"
        component={AddFood}
        options={{
          headerTitle: () => (
            <Image
              source={require("../assets/images/nutriNavlogo.png")}
              style={{ width: 150, height: 50, resizeMode: "contain" }}
            />
          ),
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="add-circle" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function Layout() {
  return (
    <ThemeProvider>
      <Stack.Navigator
        initialRouteName="Index"
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
        }}
      >
        <Stack.Group>
          <Stack.Screen name="Index" component={Index} />
          <Stack.Screen name="SignIn" component={SignIn} />
          <Stack.Screen name="SignUp" component={SignUp} />
        </Stack.Group>

        <Stack.Screen
          name="Main"
          component={TabNavigator}
          options={{
            headerShown: false,
            headerLeft: () => null,
          }}
        />

        <Stack.Screen
          name="DietaryPreferences"
          component={DietaryPreferences}
          options={{
            headerTitle: "Dietary Preferences",
            headerStyle: {
              backgroundColor: "#fff",
            },
            headerTintColor: "#32745f",
          }}
        />

        <Stack.Screen
          name="Settings"
          component={Profile}
          options={{
            presentation: "modal",
            headerTitle: "Settings",
            headerStyle: {
              backgroundColor: "#121212",
            },
            headerTintColor: "#E0E0E0",
          }}
        />

        <Stack.Screen
          name="UserProfile"
          component={UserProfile}
          options={{
            presentation: "modal",
            headerTitle: "Profile",
            headerStyle: {
              backgroundColor: "#fff",
            },
            headerTintColor: "#32745f",
          }}
        />
      </Stack.Navigator>
    </ThemeProvider>
  );
}
