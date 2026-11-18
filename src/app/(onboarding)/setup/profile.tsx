import { useRouter } from 'expo-router';
import { useState } from 'react';
import { CURRENCIES } from '../../../features/accounts/meta';
import { useMe, useUpdateMe } from '../../../features/me/useMe';
import { authErrorMessage } from '../../../lib/auth/auth-service';
import { stepNumber, useSession } from '../../../state/session';
import { Banner, Button, FlowScreen, Input, Select } from '../../../ui';

const COUNTRIES = [
  { value: 'RW', label: 'Rwanda' },
  { value: 'BI', label: 'Burundi' },
  { value: 'CD', label: 'DR Congo' },
  { value: 'KE', label: 'Kenya' },
  { value: 'TZ', label: 'Tanzania' },
  { value: 'UG', label: 'Uganda' },
];
const WEEK_STARTS = [
  { value: '1', label: 'Monday' },
  { value: '0', label: 'Sunday' },
  { value: '6', label: 'Saturday' },
];

/** Screen 22 · About you (step 2 of 6): name, country, main currency (RWF preselected), week start. */
export default function Profile() {
  const me = useMe();
  const profile = useSession((s) => s.profile);
  // Wait for GET /me so the form starts from the server's values (keyed: mounts once with them).
  if (me.isPending) return null;
  const u = me.data;
  return (
    <ProfileForm
      key={u?.id ?? 'new'}
      initial={{
        name: u?.display_name ?? profile?.name ?? '',
        country: u?.country ?? 'RW',
        currency: u?.base_currency ?? 'RWF',
        weekStart: String(u?.week_starts_on ?? 1),
      }}
    />
  );
}

function ProfileForm({ initial }: { initial: { name: string; country: string; currency: string; weekStart: string } }) {
  const router = useRouter();
  const { setProfile, goToStep } = useSession();
  const update = useUpdateMe();
  const [name, setName] = useState(initial.name);
  const [country, setCountry] = useState(initial.country);
  const [currency, setCurrency] = useState(initial.currency);
  const [weekStart, setWeekStart] = useState(initial.weekStart);
  const [error, setError] = useState<string | undefined>();
  const [failure, setFailure] = useState<string | null>(null);

  const next = async () => {
    setFailure(null);
    if (!name.trim()) {
      setError('Tell us what to call you.');
      return;
    }
    try {
      const user = await update.mutateAsync({
        display_name: name.trim(),
        country,
        base_currency: currency,
        week_starts_on: Number(weekStart),
      });
      await setProfile({ name: user.display_name ?? name.trim(), email: user.email });
      await goToStep('accounts');
      router.push('/setup/accounts');
    } catch (e) {
      setFailure(authErrorMessage(e));
    }
  };

  return (
    <FlowScreen
      title="About you"
      stepper={{ step: stepNumber('profile'), total: 6, label: 'Profile' }}
      footer={<Button label="Continue" block loading={update.isPending} onPress={next} />}
    >
      {failure ? <Banner tone="danger" title="Couldn't save your profile" body={failure} /> : null}
      <Input
        label="What should we call you?"
        value={name}
        onChangeText={(v) => {
          setName(v);
          setError(undefined);
        }}
        placeholder="Keza"
        autoComplete="name"
        textContentType="name"
        error={error}
      />
      <Select label="Country" value={country} options={COUNTRIES} onChange={setCountry} />
      <Select
        label="Main currency"
        value={currency}
        options={CURRENCIES.map((c) => ({ ...c, label: `${c.label} · ${c.detail}` }))}
        onChange={setCurrency}
        help="Totals and reports use this currency. You can add others later."
      />
      <Select label="Week starts on" value={weekStart} options={WEEK_STARTS} onChange={setWeekStart} />
    </FlowScreen>
  );
}
