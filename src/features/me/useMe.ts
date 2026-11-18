import { useMutation, useQuery } from '@tanstack/react-query';
import { unwrap, type components } from '../../api';
import { api, queryClient } from '../../config/api';

type UserInput = components['schemas']['UserInput'];
type SettingsInput = components['schemas']['SettingsInput'];

/** GET /me: the signed-in user (name, base currency, …). */
export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: () => unwrap(api.GET('/me')) });
}

export function useUpdateMe() {
  return useMutation({
    mutationFn: (body: UserInput) => unwrap(api.PATCH('/me', { body })),
    onSuccess: (user) => queryClient.setQueryData(['me'], user),
  });
}

/** GET /me/settings: reminders, quiet hours, appearance, hide amounts. */
export function useSettings() {
  return useQuery({ queryKey: ['settings'], queryFn: () => unwrap(api.GET('/me/settings')) });
}

export function useUpdateSettings() {
  return useMutation({
    mutationFn: (body: SettingsInput) => unwrap(api.PATCH('/me/settings', { body })),
    onSuccess: (settings) => queryClient.setQueryData(['settings'], settings),
  });
}
