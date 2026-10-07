import React, { useEffect, useState } from "react";
// Defines the background geofence task; must load before any screen.
import "../utils/autoCheckIn";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Image, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from "@expo-google-fonts/manrope";

import Index from "./index";
import SignIn from "./SignIn";
import SignUp from "./SignUp";
import AddFood from "./(tabs)/AddFood";
import Dashboard from "./(tabs)/Dashboard";
import Log from "./(tabs)/Log";
import Settings from "./(tabs)/profile";
import UserProfile from "./(tabs)/UserProfile";
import Friends from "./(tabs)/Friends";
import Ask from "./(tabs)/Ask";
import DietaryPreferences from "./DietaryPreferences";
import Conversation from "./Conversation";
import PersonProfile from "./Profile";
import EditProfile from "./EditProfile";
import PlateBuilder from "./PlateBuilder";

import { RootStackParamList } from "../types";
import { ThemeProvider } from "../context/ThemeContext";
import { useAppTheme } from "../theme";
import { Avatar, IconButton } from "../components/kit";
import { fetchProfile, getMyUserId } from "../utils/profiles";

const Stack = createStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

// Shared header look: warm background, no rule, bold title on the left.
function useHeaderStyle() {
  const { c, type } = useAppTheme();
  return {
    headerStyle: { backgroundColor: c.bg, borderBottomWidth: 0, shadowOpacity: 0, elevation: 0 },
    headerTitleAlign: "left" as const,
    headerTitleStyle: { ...type.h2, color: c.ink },
    headerTintColor: c.ink,
    headerBackTitleVisible: false,
    cardStyle: { backgroundColor: c.bg },
  };
}

// Instagram puts your own picture in the tab bar (the default one until you add a photo).
function MeTabIcon({ focused }: { focused: boolean }) {
  const { c } = useAppTheme();
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    getMyUserId()
      .then((id) => (id ? fetchProfile(id) : null))
      .then((me) => setPath(me?.avatar_path ?? null))
      .catch(() => {});
  }, []);
  return (
    <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: focused ? c.school : "transparent", padding: 1 }}>
      <Avatar path={path} size={26} />
    </View>
  );
}

// The Macrohall wordmark, in a lighter green on dark backgrounds.
function Wordmark() {
  const { isDark } = useAppTheme();
  return (
    <Image
      source={isDark ? require("../assets/images/macrohall-logo-dark.png") : require("../assets/images/macrohall-logo.png")}
      style={{ width: 128, height: 35 }}
      resizeMode="contain"
      accessibilityRole="header"
      accessibilityLabel="Macrohall"
    />
  );
}

const TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Dashboard: ["home", "home-outline"],
  AddFood: ["restaurant", "restaurant-outline"],
  Log: ["add-circle", "add-circle-outline"],
  Friends: ["people", "people-outline"],
};

function TabNavigator() {
  const { c } = useAppTheme();
  const header = useHeaderStyle();

  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        ...header,
        tabBarShowLabel: false,
        tabBarActiveTintColor: c.school,
        tabBarInactiveTintColor: c.ink,
        tabBarStyle: { backgroundColor: c.bg, borderTopColor: c.hairline, borderTopWidth: 1, height: 64, paddingTop: 6 },
        sceneStyle: { backgroundColor: c.bg },
        tabBarIcon: ({ focused, color }) =>
          route.name === "Me" ? (
            <MeTabIcon focused={focused} />
          ) : (
            <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={route.name === "Log" ? 30 : 26} color={color} />
          ),
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={Dashboard}
        options={({ navigation }) => ({
          title: "Macrohall",
          tabBarAccessibilityLabel: "Home",
          headerTitle: () => <Wordmark />,
          headerRight: () => (
            <View style={{ flexDirection: "row", marginRight: 8 }}>
              <IconButton name="sparkles-outline" label="Ask MacroHall" onPress={() => navigation.navigate("Ask")} />
              <IconButton name="paper-plane-outline" label="Messages" onPress={() => navigation.navigate("Friends")} />
            </View>
          ),
        })}
      />
      <Tab.Screen name="AddFood" component={AddFood} options={{ title: "Menus", tabBarAccessibilityLabel: "Menus" }} />
      <Tab.Screen name="Log" component={Log} options={{ title: "Today", tabBarAccessibilityLabel: "Food log" }} />
      <Tab.Screen name="Friends" component={Friends} options={{ title: "Friends", tabBarAccessibilityLabel: "Friends" }} />
      <Tab.Screen
        name="Me"
        component={PersonProfile}
        options={({ navigation }) => ({
          title: "Profile",
          tabBarAccessibilityLabel: "Your profile",
          headerRight: () => (
            <IconButton name="menu-outline" label="Settings" size={26} onPress={() => navigation.navigate("Settings")} style={{ marginRight: 8 }} />
          ),
        })}
      />
    </Tab.Navigator>
  );
}

function RootStack() {
  const header = useHeaderStyle();
  return (
    <Stack.Navigator initialRouteName="Index" screenOptions={{ ...header, headerShown: false, gestureEnabled: true }}>
      <Stack.Group>
        <Stack.Screen name="Index" component={Index} />
        <Stack.Screen name="SignIn" component={SignIn} />
        <Stack.Screen name="SignUp" component={SignUp} />
      </Stack.Group>

      <Stack.Screen name="Main" component={TabNavigator} />

      <Stack.Group screenOptions={{ headerShown: true }}>
        <Stack.Screen name="Conversation" component={Conversation} options={{ headerTitleStyle: { ...header.headerTitleStyle, fontSize: 22 } }} />
        <Stack.Screen name="Profile" component={PersonProfile} />
        <Stack.Screen name="Ask" component={Ask} options={{ headerTitle: "Ask MacroHall" }} />
        <Stack.Screen name="PlateBuilder" component={PlateBuilder} options={{ headerTitle: "Hit my macros" }} />
        <Stack.Screen name="EditProfile" component={EditProfile} options={{ headerTitle: "Edit profile", presentation: "modal" }} />
        <Stack.Screen name="DietaryPreferences" component={DietaryPreferences} options={{ headerTitle: "Dietary preferences" }} />
        <Stack.Screen name="Settings" component={Settings} options={{ headerTitle: "Settings", presentation: "modal" }} />
        <Stack.Screen name="UserProfile" component={UserProfile} options={{ headerTitle: "Body & goals", presentation: "modal" }} />
      </Stack.Group>
    </Stack.Navigator>
  );
}

export default function Layout() {
  const [fontsLoaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <RootStack />
    </ThemeProvider>
  );
}
