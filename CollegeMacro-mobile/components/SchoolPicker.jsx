import React, { useMemo, useState } from 'react';
import { FlatList, Modal, StatusBar, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useStyles } from '../theme';
import { schoolTones } from '../theme/school';
import { Button, EmptyState, IconButton, Row, Tap, TextField, Txt } from './kit';

// Full-screen searchable list of schools. Live schools are selectable;
// coming-soon schools are shown so students can join the waitlist.
// `selectedId` (optional) marks the school that's already chosen.
// `isDarkMode` is still accepted for older callers; colors come from the theme.
/**
 * @param {{ visible: boolean, schools: any[], onSelect: (school: any) => void, onClose: () => void,
 *   onRequestMissing: () => void, isDarkMode?: boolean, selectedId?: number | string | null }} props
 */
// eslint-disable-next-line no-unused-vars
export default function SchoolPicker({ visible, schools, onSelect, onClose, onRequestMissing, isDarkMode, selectedId = null }) {
  const [query, setQuery] = useState('');
  const { c, isDark, fonts } = useAppTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();

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

  const liveCount = (schools || []).filter((school) => school.status === 'live').length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={c.bg} />
        <View style={styles.topBar}>
          <IconButton name="close" label="Close" onPress={onClose} tone="filled" />
        </View>

        <View style={styles.heading}>
          <Txt variant="h1" accessibilityRole="header">
            Find your school
          </Txt>
          {liveCount ? (
            <Txt variant="body" tone="muted">
              MacroHall is live at {liveCount} {liveCount === 1 ? 'campus' : 'campuses'}, with more on the way.
            </Txt>
          ) : null}
        </View>

        <TextField
          icon="search"
          placeholder="Search by name or email domain"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          autoFocus
          returnKeyType="search"
          accessibilityLabel="Search schools"
          style={styles.search}
        />

        <FlatList
          data={filtered}
          keyExtractor={(school) => String(school.id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item: school }) => {
            const live = school.status === 'live';
            const selected = selectedId != null && school.id === selectedId;
            const place = [school.city, school.state].filter(Boolean).join(', ');
            const domain = school.email_domains?.length ? `@${school.email_domains[0]}` : '';
            const initial = (school.short_name || school.name || '?').trim().charAt(0).toUpperCase();
            // Each school's initial on its own color.
            const tones = schoolTones(school, c, isDark);
            return (
              <Tap
                onPress={() => {
                  setQuery('');
                  onSelect(school);
                }}
                scaleTo={0.985}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${school.name}${live ? '' : ', coming soon'}`}
                style={[styles.rowWrap, selected && styles.rowSelected]}
              >
                <Row
                  leading={
                    <View style={[styles.initialDisc, { backgroundColor: tones.school }]}>
                      <Txt variant="h2" color={tones.onSchool}>
                        {initial}
                      </Txt>
                    </View>
                  }
                  title={
                    <Txt variant="bodyStrong" numberOfLines={2}>
                      {school.name}
                    </Txt>
                  }
                  subtitle={
                    place || domain ? (
                      <Txt variant="caption" tone="muted" numberOfLines={2}>
                        {[place, domain].filter(Boolean).join('  ·  ')}
                      </Txt>
                    ) : null
                  }
                  trailing={
                    <View style={styles.trailing}>
                      {live ? (
                        <View style={[styles.tag, styles.tagLive]}>
                          <View style={styles.tagDot} />
                          <Txt variant="caption" tone="accent" style={{ fontFamily: fonts.bold }}>
                            Live
                          </Txt>
                        </View>
                      ) : (
                        <View style={[styles.tag, styles.tagSoon]}>
                          <Txt variant="caption" tone="muted" style={{ fontFamily: fonts.bold }}>
                            Coming soon
                          </Txt>
                        </View>
                      )}
                      {selected ? <Ionicons name="checkmark-circle" size={22} color={c.ink} /> : null}
                    </View>
                  }
                />
              </Tap>
            );
          }}
          ListEmptyComponent={
            <EmptyState
              icon="school-outline"
              title={query.trim() ? `No schools match "${query.trim()}"` : 'No schools yet'}
              body="Tell us where you go and we'll email you when MacroHall launches there."
              action="Request your school"
              onAction={onRequestMissing}
            />
          }
          ListFooterComponent={
            filtered.length ? (
              <Button
                title="Don't see your school? Ask us to add it"
                variant="ghost"
                size="sm"
                onPress={onRequestMissing}
                style={styles.missing}
              />
            ) : null
          }
        />
      </View>
    </Modal>
  );
}

const makeStyles = (c, { space, radius }) => ({
  container: { flex: 1, backgroundColor: c.bg, paddingHorizontal: space.lg },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', marginRight: -space.xs },
  heading: { gap: space.sm, marginTop: space.sm, marginBottom: space.xl },
  search: { marginBottom: space.md },
  list: { paddingTop: space.sm },
  separator: { height: space.xs },
  rowWrap: { borderRadius: radius.lg, paddingHorizontal: space.md },
  rowSelected: { backgroundColor: c.surface },
  initialDisc: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, paddingHorizontal: space.md, height: 26 },
  tagLive: { backgroundColor: c.accentSoft },
  tagSoon: { backgroundColor: c.sunken },
  tagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent },
  missing: { alignSelf: 'center', marginTop: space.lg },
});
