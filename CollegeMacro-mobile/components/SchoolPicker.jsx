import React, { useMemo, useState } from 'react';
import { FlatList, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Full-screen searchable list of schools. Live schools are selectable;
// coming-soon schools are shown so students can join the waitlist.
export default function SchoolPicker({ visible, schools, onSelect, onClose, onRequestMissing, isDarkMode }) {
  const [query, setQuery] = useState('');
  const styles = useMemo(() => makeStyles(isDarkMode), [isDarkMode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (schools || []).filter(
      (school) =>
        !q ||
        school.name.toLowerCase().includes(q) ||
        (school.short_name || '').toLowerCase().includes(q) ||
        (school.email_domains || []).some((domain) => domain.includes(q))
    );
    // Live schools first, then alphabetical.
    return matches.sort((a, b) => {
      if ((a.status === 'live') !== (b.status === 'live')) return a.status === 'live' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [schools, query]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
            <MaterialIcons name="close" size={26} color={isDarkMode ? '#E0E0E0' : '#32745f'} />
          </TouchableOpacity>
          <Text style={styles.title}>Pick your school</Text>
          <View style={{ width: 26 }} />
        </View>

        <TextInput
          style={styles.search}
          placeholder="Search by name or email domain"
          placeholderTextColor="#888"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
        />

        <FlatList
          data={filtered}
          keyExtractor={(school) => String(school.id)}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item: school }) => {
            const live = school.status === 'live';
            return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  setQuery('');
                  onSelect(school);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${school.name}${live ? '' : ', coming soon'}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.schoolName}>{school.name}</Text>
                  <Text style={styles.schoolMeta}>
                    {[school.city, school.state].filter(Boolean).join(', ')}
                    {school.email_domains?.length ? `  ·  @${school.email_domains[0]}` : ''}
                  </Text>
                </View>
                {live ? (
                  <MaterialIcons name="chevron-right" size={22} color="#888" />
                ) : (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>Coming soon</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          ListFooterComponent={
            <TouchableOpacity style={styles.missing} onPress={onRequestMissing} accessibilityRole="button">
              <Text style={styles.missingText}>Don't see your school? Ask us to add it</Text>
            </TouchableOpacity>
          }
        />
      </View>
    </Modal>
  );
}

const makeStyles = (isDarkMode) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDarkMode ? '#121212' : '#fff',
      paddingTop: 60,
      paddingHorizontal: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      color: '#32745f',
    },
    search: {
      height: 50,
      borderWidth: 1.5,
      borderColor: isDarkMode ? '#333' : 'rgba(50, 116, 95, 0.2)',
      borderRadius: 12,
      paddingHorizontal: 15,
      fontSize: 16,
      marginBottom: 12,
      backgroundColor: isDarkMode ? '#242424' : '#fff',
      color: isDarkMode ? '#E0E0E0' : '#32745f',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: isDarkMode ? '#333' : '#ddd',
    },
    schoolName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDarkMode ? '#E0E0E0' : '#222',
    },
    schoolMeta: {
      fontSize: 13,
      marginTop: 2,
      color: isDarkMode ? '#999' : '#666',
    },
    badge: {
      backgroundColor: isDarkMode ? '#333' : '#EEF4F1',
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: isDarkMode ? '#BBB' : '#32745f',
    },
    missing: {
      paddingVertical: 24,
      alignItems: 'center',
    },
    missingText: {
      fontSize: 15,
      fontWeight: '600',
      color: isDarkMode ? '#E0E0E0' : '#2E7D32',
    },
  });
