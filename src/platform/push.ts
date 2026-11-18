import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { unwrap, type KunguBookClient } from '../api';
import { newId } from '../lib/id';
import type { KeyValueStore } from '../lib/storage';

const DEVICE_ID_KEY = 'device.id';

/** Asks for permission to send notifications (screen 25). True when allowed. */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * The Expo push token, or undefined where there is none: simulators, Expo Go on Android (SDK 53+),
 * a missing EAS project ID, or permission not granted. The API simply sends no push to such a device.
 */
async function pushToken(): Promise<string | undefined> {
  try {
    if (!Device.isDevice) return undefined;
    if (!(await Notifications.getPermissionsAsync()).granted) return undefined;
    const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
    if (!projectId) return undefined;
    return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch {
    return undefined;
  }
}

/**
 * POST /me/devices: registers this phone (a stable client-generated ID) and its push token, if any.
 * Safe to call on every unlock; the API upserts by ID.
 */
export async function registerDevice(api: KunguBookClient, store: KeyValueStore) {
  let id = await store.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = newId();
    await store.setItem(DEVICE_ID_KEY, id);
  }
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  return unwrap(
    api.POST('/me/devices', {
      body: {
        id,
        platform,
        push_token: await pushToken(),
        app_version: Constants.expoConfig?.version,
        name: Device.deviceName ?? Device.modelName ?? undefined,
      },
    }),
  );
}
