import { Alert } from 'react-native';
import { CreatePin } from '../../../features/security/CreatePin';
import { stepNumber, useSession } from '../../../state/session';

/** Screen 26 · Lock KunguBook (step 6 of 6). After a sign-in on a new phone, the only step. */
export default function SetupPin() {
  const { mode, finishWithPin, signOut } = useSession();
  const returning = mode === 'returning';

  return (
    <CreatePin
      title="Lock KunguBook"
      stepper={returning ? undefined : { step: stepNumber('pin'), total: 6, label: 'Security' }}
      onClose={
        returning
          ? () =>
              Alert.alert('Cancel sign-in?', 'You need a PIN to use KunguBook on this phone.', [
                { text: 'Keep going', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
              ])
          : undefined
      }
      onFinish={finishWithPin}
    />
  );
}
