import { useNetworkState } from 'expo-network';
import { View } from 'react-native';
import { requestSync, syncEngine, useSyncStatus } from '../../config/data';
import { useTheme } from '../../theme';
import { Banner, Button } from '../../ui';

/**
 * State rules (App Flow): offline → "Offline. Changes will sync"; a sync error → a banner with Retry;
 * changes the server refused → how many, with Retry. Nothing shows while everything is fine.
 */
export function SyncBanner() {
  const t = useTheme();
  const net = useNetworkState();
  const { phase, unsynced, rejected } = useSyncStatus();
  const offline = net.isConnected === false || net.isInternetReachable === false || phase === 'offline';

  if (rejected > 0) {
    return (
      <View style={{ gap: t.space.s2 }}>
        <Banner
          tone="danger"
          title={`${rejected} ${rejected === 1 ? 'change' : 'changes'} couldn't sync`}
          body="They're saved on this phone. Check the details and try again."
        />
        <Button
          label="Try again"
          variant="secondary"
          size="sm"
          onPress={() => void syncEngine.retryRejected().then(() => requestSync())}
        />
      </View>
    );
  }
  if (offline) {
    return (
      <Banner
        tone="info"
        title="Offline. Changes will sync"
        body={unsynced ? `${unsynced} ${unsynced === 1 ? 'change is' : 'changes are'} saved on this phone.` : undefined}
      />
    );
  }
  if (phase === 'error') {
    return (
      <View style={{ gap: t.space.s2 }}>
        <Banner tone="warn" title="Couldn't sync" body="Your changes are safe on this phone." />
        <Button label="Retry" variant="secondary" size="sm" onPress={() => requestSync()} />
      </View>
    );
  }
  return null;
}
