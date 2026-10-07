// Optional automatic check-in: the OS watches geofences around the student's
// dining halls and gyms and wakes the app when they enter or leave one, so
// the gym visit (and "At Bursley") updates without opening the app.
//
// Region monitoring, not continuous GPS: cheap on battery, but it needs
// "Always" location permission. Only places the student shares are watched:
// halls when dining-hall location is on, gyms when gym location is on.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './config';
import { fetchMySchool } from './schools';

export const GEOFENCE_TASK = 'macrohall-geofence';
const PREF_KEY = 'autoCheckInEnabled';
const IOS_REGION_LIMIT = 20;
const MIN_RADIUS_M = 100; // iOS rarely fires for smaller regions

// Must run at module load (imported from the root layout) so the task exists
// when the OS launches the app in the background.
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error || !data?.region?.identifier) return;
  const [type, rawId] = data.region.identifier.split(':');
  const id = Number(rawId);
  if (!id || (type !== 'gym' && type !== 'hall')) return;

  if (data.eventType === Location.GeofencingEventType.Enter) {
    await supabase.rpc(type === 'gym' ? 'check_in_gym' : 'check_in_hall', type === 'gym' ? { p_gym_id: id } : { p_hall_id: id });
  } else if (data.eventType === Location.GeofencingEventType.Exit) {
    await supabase.rpc('leave_place', { p_type: type, p_id: id });
  }
});

export async function isAutoCheckInEnabled() {
  try {
    return (await AsyncStorage.getItem(PREF_KEY)) === 'true';
  } catch {
    return false;
  }
}

async function regionsFor({ dining, gym }) {
  const school = await fetchMySchool();
  if (!school) return [];

  const regions = [];
  if (gym) {
    const { data } = await supabase
      .from('gym_facilities')
      .select('id, latitude, longitude, geofence_radius_m')
      .eq('school_id', school.id)
      .eq('is_active', true)
      .not('latitude', 'is', null);
    for (const g of data || []) {
      regions.push({ identifier: `gym:${g.id}`, latitude: g.latitude, longitude: g.longitude, radius: Math.max(g.geofence_radius_m, MIN_RADIUS_M) });
    }
  }
  if (dining) {
    const { data } = await supabase
      .from('dining_halls')
      .select('id, latitude, longitude, geofence_radius_m')
      .eq('school_id', school.id)
      .eq('is_active', true)
      .not('latitude', 'is', null);
    for (const h of data || []) {
      regions.push({ identifier: `hall:${h.id}`, latitude: h.latitude, longitude: h.longitude, radius: Math.max(h.geofence_radius_m, MIN_RADIUS_M) });
    }
  }
  return regions.slice(0, IOS_REGION_LIMIT);
}

export async function disableAutoCheckIn() {
  await AsyncStorage.setItem(PREF_KEY, 'false').catch(() => {});
  if (await TaskManager.isTaskRegisteredAsync(GEOFENCE_TASK)) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
}

// Asks for "Always" location, then watches the shared places. Returns
// { ok: true, regions } or { ok: false, reason }.
export async function enableAutoCheckIn({ dining, gym }) {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== 'granted') return { ok: false, reason: 'Location permission was not granted.' };

  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== 'granted') {
    return { ok: false, reason: 'Automatic check-in needs location set to "Always" (Allow all the time) in Settings.' };
  }

  const regions = await regionsFor({ dining, gym });
  if (regions.length === 0) {
    await disableAutoCheckIn();
    return { ok: false, reason: "Your school's dining halls and gyms don't have map locations yet." };
  }

  await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
  await AsyncStorage.setItem(PREF_KEY, 'true');
  return { ok: true, regions: regions.length };
}

// Re-registers regions after the sharing toggles change.
export async function refreshAutoCheckIn({ dining, gym }) {
  if (!(await isAutoCheckInEnabled())) return;
  if (!dining && !gym) {
    await disableAutoCheckIn();
    return;
  }
  const regions = await regionsFor({ dining, gym });
  if (regions.length > 0) await Location.startGeofencingAsync(GEOFENCE_TASK, regions);
}
