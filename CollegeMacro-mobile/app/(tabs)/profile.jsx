// Profile.tsx
import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Alert, Modal, TextInput, ActivityIndicator, ScrollView } from "react-native";
import { useTheme } from '../../context/ThemeContext';
import { supabase, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } from "../../utils/config";
import { useNavigation } from "@react-navigation/native";
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import PrivacyPolicy from "../../components/PrivacyPolicy";

export default function Profile() {
  const { isDarkMode, themePreference, changeTheme } = useTheme();
  const navigation = useNavigation();
  const [bugModalVisible, setBugModalVisible] = useState(false);
  const [bugDescription, setBugDescription] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteAuthUser = async (userId) => {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!response.ok) {
      let message = 'Failed to delete account.';
      try {
        const data = await response.json();
        if (data?.message) {
          message = data.message;
        }
      } catch {
        // ignore parse errors, fall back to default message
      }
      throw new Error(message);
    }
  };

  const deleteUserProfileRow = async (userId) => {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        Prefer: 'return=minimal',
      },
    });

    if (!response.ok && response.status !== 404) {
      let message = 'Failed to delete user profile.';
      try {
        const data = await response.json();
        if (data?.message) {
          message = data.message;
        }
      } catch {
        // ignore parse errors
      }
      throw new Error(message);
    }
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : "#f5f7fa",
      padding: 20,
    },
    scrollContent: {
      paddingBottom: 40,
      paddingTop: 4,
      flexGrow: 1,
    },
    titleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
    },
    title: {
      fontSize: 28,
      fontWeight: "800",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
    },
    closeButton: {
      position: 'absolute',
      right: 0,
      padding: 8,
    },
    section: {
      backgroundColor: isDarkMode ? '#242424' : "#fff",
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: isDarkMode ? '#E0E0E0' : '#333',
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 8,
    },
    label: {
      fontSize: 16,
      color: isDarkMode ? '#E0E0E0' : '#333',
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#242424' : "#fff",
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
    },
    buttonText: {
      fontSize: 16,
      color: isDarkMode ? '#E0E0E0' : '#333',
      marginLeft: 10,
    },
    deleteButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#242424' : '#fff',
      padding: 16,
      borderRadius: 12,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDarkMode ? '#333' : "rgba(50, 116, 95, 0.1)",
    },
    deleteButtonText: {
      fontSize: 16,
      color: isDarkMode ? '#E0E0E0' : '#333',
      marginLeft: 10,
      fontWeight: '600',
    },
    logoutButton: {
      backgroundColor: '#32745f',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      marginTop: 24,
    },
    logoutButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '600',
    },
    themeContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      backgroundColor: isDarkMode ? '#333' : '#f5f5f5',
      borderRadius: 12,
      padding: 8,
      marginTop: 12,
    },
    themeOption: {
      alignItems: 'center',
      padding: 12,
      borderRadius: 8,
      flex: 1,
      marginHorizontal: 4,
    },
    selectedTheme: {
      backgroundColor: isDarkMode ? '#444' : '#fff',
      shadowColor: "#000",
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    themeText: {
      marginTop: 4,
      fontSize: 12,
      color: isDarkMode ? '#E0E0E0' : '#32745f',
      fontWeight: '500',
    },
    headerContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    sectionHeader: {
      fontSize: 20,
      fontWeight: "700",
      color: isDarkMode ? '#E0E0E0' : "#32745f",
      marginBottom: 16,
      marginTop: 8,
    },
    modalContainer: {
      flex: 1,
      justifyContent: 'flex-start',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      paddingTop: 100,
    },
    modalContent: {
      backgroundColor: isDarkMode ? '#242424' : '#fff',
      padding: 20,
      borderRadius: 12,
      width: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: isDarkMode ? '#E0E0E0' : '#32745f',
    },
    bugInput: {
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : '#ddd',
      borderRadius: 8,
      padding: 10,
      marginBottom: 16,
      color: isDarkMode ? '#E0E0E0' : '#000',
      height: 100,
      textAlignVertical: 'top',
    },
    imageSection: {
      marginBottom: 16,
    },
    imageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDarkMode ? '#333' : 'rgba(50, 116, 95, 0.1)',
      padding: 12,
      borderRadius: 8,
      justifyContent: 'center',
    },
    imageSelected: {
      color: isDarkMode ? '#E0E0E0' : '#32745f',
      textAlign: 'center',
      marginTop: 8,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    cancelButton: {
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: isDarkMode ? '#E0E0E0' : '#32745f',
      flex: 1,
      marginRight: 8,
      alignItems: 'center',
    },
    submitButton: {
      padding: 12,
      borderRadius: 8,
      backgroundColor: '#32745f',
      flex: 1,
      marginLeft: 8,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: isDarkMode ? '#E0E0E0' : '#32745f',
      fontWeight: '600',
    },
    submitButtonText: {
      color: '#fff',
      fontWeight: '600',
    },
    modalCloseButton: {
      position: 'absolute',
      right: 0,
      padding: 8,
    },
    deleteWarningText: {
      marginTop: 4,
      fontSize: 14,
      lineHeight: 20,
      color: isDarkMode ? '#E0E0E0' : '#444',
      marginBottom: 16,
    },
    deleteInput: {
      borderWidth: 1,
      borderColor: isDarkMode ? '#555' : 'rgba(50, 116, 95, 0.25)',
      borderRadius: 10,
      padding: 12,
      color: isDarkMode ? '#E0E0E0' : '#333',
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      marginBottom: 20,
    },
    deleteModalButtons: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      marginTop: 8,
    },
    deleteCancelButton: {
      paddingVertical: 12,
      paddingHorizontal: 18,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDarkMode ? '#444' : 'rgba(50, 116, 95, 0.35)',
      backgroundColor: isDarkMode ? '#1E1E1E' : '#FFFFFF',
      marginRight: 12,
    },
    deleteCancelButtonText: {
      color: isDarkMode ? '#E0E0E0' : '#32745f',
      fontWeight: '600',
    },
    deleteConfirmButton: {
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 10,
      backgroundColor: '#32745f',
      alignItems: 'center',
    },
    deleteConfirmButtonDisabled: {
      opacity: 0.6,
    },
    deleteConfirmButtonText: {
      color: '#fff',
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    policySection: {
      marginTop: 24,
      marginBottom: 16,
    },
  });

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.headerContainer}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Settings</Text>
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => navigation.goBack()}
            >
              <MaterialIcons 
                name="close" 
                size={24} 
                color={isDarkMode ? '#E0E0E0' : '#32745f'} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sectionHeader}>Nutritional Settings</Text>
        
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('DietaryPreferences')}
        >
          <MaterialIcons 
            name="restaurant" 
            size={24} 
            color={isDarkMode ? '#E0E0E0' : '#32745f'} 
          />
          <Text style={styles.buttonText}>Dietary Preferences</Text>
        </TouchableOpacity>

        <Text style={styles.sectionHeader}>User Settings</Text>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Theme</Text>
          <View style={styles.themeContainer}>
            <Pressable 
              style={[
                styles.themeOption,
                themePreference === 'light' && styles.selectedTheme
              ]}
              onPress={() => changeTheme('light')}
            >
              <MaterialIcons 
                name="light-mode" 
                size={24} 
                color={isDarkMode ? '#E0E0E0' : '#32745f'} 
              />
              <Text style={styles.themeText}>Light</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.themeOption,
                themePreference === 'dark' && styles.selectedTheme
              ]}
              onPress={() => changeTheme('dark')}
            >
              <MaterialIcons 
                name="dark-mode" 
                size={24} 
                color={isDarkMode ? '#E0E0E0' : '#32745f'} 
              />
              <Text style={styles.themeText}>Dark</Text>
            </Pressable>

            <Pressable 
              style={[
                styles.themeOption,
                themePreference === 'system' && styles.selectedTheme
              ]}
              onPress={() => changeTheme('system')}
            >
              <MaterialIcons 
                name="computer" 
                size={24} 
                color={isDarkMode ? '#E0E0E0' : '#32745f'} 
              />
              <Text style={styles.themeText}>System</Text>
            </Pressable>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => setBugModalVisible(true)}
        >
          <MaterialIcons 
            name="bug-report" 
            size={24} 
            color={isDarkMode ? '#E0E0E0' : '#32745f'} 
          />
          <Text style={styles.buttonText}>Report a Bug</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            setDeleteConfirmation('');
            setDeleteModalVisible(true);
          }}
          accessibilityLabel="Remove account"
        >
          <MaterialIcons
            name="delete-forever"
            size={24}
            color={isDarkMode ? '#E0E0E0' : '#32745f'}
          />
          <Text style={styles.deleteButtonText}>Remove Account</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Log Out</Text>
        </TouchableOpacity>

        <PrivacyPolicy isDarkMode={isDarkMode} style={styles.policySection} />
      </ScrollView>

      <Modal
        visible={bugModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setBugModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Report a Bug</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => {
                  setBugModalVisible(false);
                  setBugDescription('');
                }}
              >
                <MaterialIcons 
                  name="close" 
                  size={24} 
                  color={isDarkMode ? '#E0E0E0' : '#32745f'} 
                />
              </TouchableOpacity>
            </View>
            
            <TextInput
              style={styles.bugInput}
              placeholder="Describe the bug..."
              multiline={true}
              numberOfLines={4}
              value={bugDescription}
              onChangeText={setBugDescription}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={() => {
                  setBugModalVisible(false);
                  setBugDescription('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={submitBugReport}
              >
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) {
            setDeleteModalVisible(false);
            setDeleteConfirmation('');
          }
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Remove Account</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => {
                  if (isDeleting) return;
                  setDeleteModalVisible(false);
                  setDeleteConfirmation('');
                }}
                disabled={isDeleting}
              >
                <MaterialIcons
                  name="close"
                  size={24}
                  color={isDarkMode ? '#E0E0E0' : '#32745f'}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.deleteWarningText}>
              Removing your account will permanently erase your meal logs and saved preferences. Type DELETE to confirm.
            </Text>

            <TextInput
              style={styles.deleteInput}
              placeholder="Type DELETE to confirm"
              placeholderTextColor={isDarkMode ? '#777' : '#999'}
              value={deleteConfirmation}
              onChangeText={(text) => setDeleteConfirmation(text)}
              autoCapitalize="characters"
              editable={!isDeleting}
            />

            <View style={styles.deleteModalButtons}>
              <TouchableOpacity
                style={styles.deleteCancelButton}
                onPress={() => {
                  if (isDeleting) return;
                  setDeleteModalVisible(false);
                  setDeleteConfirmation('');
                }}
                disabled={isDeleting}
              >
                <Text style={styles.deleteCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.deleteConfirmButton,
                  (isDeleting || deleteConfirmation.trim().toUpperCase() !== 'DELETE') && styles.deleteConfirmButtonDisabled,
                ]}
                onPress={handleDeleteAccount}
                disabled={isDeleting || deleteConfirmation.trim().toUpperCase() !== 'DELETE'}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deleteConfirmButtonText}>Remove</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
