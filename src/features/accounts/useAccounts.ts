import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { unwrap, type Account, type components } from '../../api';
import { api, cache, queryClient } from '../../config/api';

type AccountInput = components['schemas']['AccountInput'];
export type AccountList = { data: Account[]; total: components['schemas']['Money'] };

const KEY = ['accounts'] as const;
const CACHE_KEY = 'accounts';

/**
 * `GET /accounts`: the API's balances and total (the app never sums them itself).
 * The last answer is kept in the encrypted cache, so Home shows figures straight after unlock.
 */
export function useAccounts() {
  useEffect(() => {
    if (queryClient.getQueryData(KEY)) return;
    void cache.get<AccountList>(CACHE_KEY).then((cached) => {
      if (cached && !queryClient.getQueryData(KEY)) queryClient.setQueryData(KEY, cached, { updatedAt: 0 });
    });
  }, []);

  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const list = await unwrap(api.GET('/accounts'));
      void cache.set(CACHE_KEY, list);
      return list;
    },
  });
}

export function useAccount(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => unwrap(api.GET('/accounts/{id}', { params: { path: { id } } })),
    placeholderData: () => queryClient.getQueryData<AccountList>(KEY)?.data.find((a) => a.id === id),
  });
}

const refresh = () => queryClient.invalidateQueries({ queryKey: KEY });

export function useCreateAccount() {
  return useMutation({
    mutationFn: (body: AccountInput & Required<Pick<AccountInput, 'id' | 'type' | 'name' | 'currency'>>) =>
      unwrap(api.POST('/accounts', { body })),
    onSuccess: refresh,
  });
}

export function useUpdateAccount(id: string) {
  return useMutation({
    mutationFn: ({ version, ...body }: AccountInput & { version?: number }) =>
      unwrap(
        api.PATCH('/accounts/{id}', {
          params: { path: { id }, header: version ? { 'If-Match': version } : undefined },
          body,
        }),
      ),
    onSuccess: refresh,
  });
}
