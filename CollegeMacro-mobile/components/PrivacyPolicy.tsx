import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TouchableOpacity,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

type PrivacyPolicyProps = {
  isDarkMode?: boolean;
  style?: StyleProp<ViewStyle>;
  defaultExpanded?: boolean;
};

type BulletListProps = {
  items: string[];
  styles: ReturnType<typeof createStyles>;
};

const BulletList: React.FC<BulletListProps> = ({ items, styles }) => (
  <View style={styles.list}>
    {items.map((item) => (
      <View key={item} style={styles.listItem}>
        <Text style={styles.bullet}>•</Text>
        <Text style={styles.body}>{item}</Text>
      </View>
    ))}
  </View>
);

const createStyles = (isDarkMode: boolean) =>
  StyleSheet.create({
    container: {
      borderWidth: 1,
      borderColor: isDarkMode ? "#333" : "rgba(50, 116, 95, 0.2)",
      borderRadius: 16,
      backgroundColor: isDarkMode ? "#1E1E1E" : "#FFFFFF",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerLeft: {
      flex: 1,
    },
    title: {
      fontSize: 20,
      fontWeight: "700",
      color: isDarkMode ? "#E0E0E0" : "#32745f",
    },
    updated: {
      fontSize: 14,
      color: isDarkMode ? "#B0B0B0" : "#4F4F4F",
    },
    content: {
      paddingHorizontal: 20,
      paddingBottom: 20,
    },
    section: {
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      color: isDarkMode ? "#E0E0E0" : "#32745f",
      marginBottom: 6,
    },
    subheading: {
      fontSize: 15,
      fontWeight: "600",
      color: isDarkMode ? "#E0E0E0" : "#333333",
      marginTop: 8,
      marginBottom: 4,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      color: isDarkMode ? "#CFCFCF" : "#444444",
      flexShrink: 1,
    },
    list: {
      marginTop: 4,
      marginBottom: 4,
    },
    listItem: {
      flexDirection: "row",
      alignItems: "flex-start",
      marginBottom: 4,
    },
    bullet: {
      width: 16,
      fontSize: 14,
      color: isDarkMode ? "#CFCFCF" : "#444444",
      lineHeight: 20,
    },
    contact: {
      fontSize: 14,
      lineHeight: 20,
      color: isDarkMode ? "#CFCFCF" : "#444444",
    },
  });

const PrivacyPolicy: React.FC<PrivacyPolicyProps> = ({
  isDarkMode = false,
  style,
  defaultExpanded = false,
}) => {
  const styles = useMemo(() => createStyles(isDarkMode), [isDarkMode]);
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={0.8}
        onPress={() => setExpanded((prev) => !prev)}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.title}>Privacy Policy for NutriNav</Text>
          <Text style={styles.updated}>Last Updated: October 29, 2025</Text>
        </View>
        <MaterialIcons
          name={expanded ? "expand-less" : "expand-more"}
          size={24}
          color={isDarkMode ? "#E0E0E0" : "#32745f"}
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>1. Information We Collect</Text>
            <Text style={styles.body}>
              When you create an account or use NutriNav, we may collect the
              following types of information:
            </Text>
            <Text style={styles.subheading}>Personal Information</Text>
            <BulletList
              items={[
                "Email address",
                "Username",
                "Date of birth",
                "Sex",
                "Unique user identifiers (UUID)",
              ]}
              styles={styles}
            />
            <Text style={styles.subheading}>Health & Wellness Information</Text>
            <BulletList
              items={[
                "Height and weight",
                "Weight goals",
                "Nutrition preferences",
                "Allergens",
                "Activity level",
                "Dining hall selections and nutrition logs",
              ]}
              styles={styles}
            />
            <Text style={styles.subheading}>Account & Usage Information</Text>
            <BulletList
              items={[
                "Authentication metadata (confirmation timestamps, token status)",
                "App settings such as theme or measurement preferences",
                "Timestamps for account creation, updates, and sign-ins",
              ]}
              styles={styles}
            />
            <Text style={styles.body}>
              We do not collect analytics or advertising data.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
            <Text style={styles.body}>We use your information to:</Text>
            <BulletList
              items={[
                "Provide personalized nutrition recommendations",
                "Save your dietary preferences and progress",
                "Maintain your account and login functionality",
                "Improve core features of the NutriNav app",
                "Communicate with you regarding account-related matters",
              ]}
              styles={styles}
            />
            <Text style={styles.body}>
              We do not sell, rent, or share your personal information with third
              parties.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>3. Data Storage and Security</Text>
            <Text style={styles.body}>
              All data is securely stored using Supabase, which provides encryption
              in transit and industry-standard protections. Passwords are stored in
              a hashed format. While we work to safeguard your data, no system can
              guarantee absolute security.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>4. Children’s Privacy</Text>
            <Text style={styles.body}>
              NutriNav is not intended for users under the age of 13. We do not
              knowingly collect information from children below this age threshold.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              5. Account Deletion and Data Removal
            </Text>
            <Text style={styles.body}>
              Users can delete their accounts directly within the NutriNav app. When
              you choose to delete your account, all personal and health-related
              information associated with your profile — including height, weight,
              preferences, and nutrition data — will be permanently removed from our
              systems within a reasonable timeframe. Once deletion is confirmed,
              this process cannot be undone.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>6. Changes to This Policy</Text>
            <Text style={styles.body}>
              We may update this Privacy Policy from time to time. Updated versions
              will be posted on this page with a revised “Last Updated” date.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>7. Contact Us</Text>
            <Text style={styles.contact}>
              If you have questions about this Privacy Policy or your data, you may
              contact us at:
            </Text>
            <Text style={styles.contact}>Email: zionamir2004@gmail.com</Text>
          </View>
        </View>
      )}
    </View>
  );
};

export default PrivacyPolicy;
