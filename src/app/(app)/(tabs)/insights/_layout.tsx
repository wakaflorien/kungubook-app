import { Stack } from 'expo-router';
import { useNativeHeaderOptions } from '../../../../ui/nativeHeader';

/** Tab stack: native large title that collapses into the glass bar on scroll. */
export default function TabStack() {
  return <Stack screenOptions={useNativeHeaderOptions({ large: true })} />;
}
