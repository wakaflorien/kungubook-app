import { addNetworkStateListener } from 'expo-network';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { POLL_MS, requestSync } from '../../config/data';

/**
 * Keeps the local database in sync while `active` (signed in and unlocked, or onboarding): when the app opens
 * or comes back to the foreground, when the connection returns, and every few seconds in the foreground (TRD §4).
 */
export function useSyncLoop(active: boolean) {
  useEffect(() => {
    if (!active) return;
    requestSync();
    let poll: ReturnType<typeof setInterval> | null = null;
    const startPolling = () => {
      poll ??= setInterval(() => requestSync(), POLL_MS);
    };
    const stopPolling = () => {
      if (poll) clearInterval(poll);
      poll = null;
    };
    if (AppState.currentState === 'active') startPolling();

    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        requestSync();
        startPolling();
      } else {
        stopPolling();
      }
    });
    let wasOnline = true;
    const net = addNetworkStateListener(({ isConnected, isInternetReachable }) => {
      const online = !!isConnected && isInternetReachable !== false;
      // Back online: push what was saved offline straight away.
      if (online && !wasOnline) requestSync();
      wasOnline = online;
    });
    return () => {
      stopPolling();
      app.remove();
      net.remove();
    };
  }, [active]);
}
