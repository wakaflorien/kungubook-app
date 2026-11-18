import { CreatePin } from '../../features/security/CreatePin';
import { useSession } from '../../state/session';

/** Screen 26 after Forgot PIN: choose a new PIN, then straight into Home. */
export default function NewPin() {
  const finishWithPin = useSession((s) => s.finishWithPin);
  return <CreatePin title="New PIN" finishLabel="Save PIN" onFinish={finishWithPin} />;
}
