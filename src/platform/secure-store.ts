import * as SecureStore from 'expo-secure-store';
import type { KeyValueStore } from '../lib/storage';

/**
 * Keychain (iOS) / Keystore-encrypted storage (Android) for tokens, the PIN hash, the database key
 * and small flags. Values are readable only after the phone has been unlocked once, and never leave this device.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureStore: KeyValueStore = {
  getItem: (key) => SecureStore.getItemAsync(key, OPTIONS),
  setItem: (key, value) => SecureStore.setItemAsync(key, value, OPTIONS),
  deleteItem: (key) => SecureStore.deleteItemAsync(key, OPTIONS),
};
