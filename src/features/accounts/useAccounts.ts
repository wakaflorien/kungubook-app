import { useQuery } from '@tanstack/react-query';
import { unwrap } from '../../api';
import { api } from '../../config/api';

/** `GET /accounts`: the API's balances and total (the app never sums them itself). */
export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: () => unwrap(api.GET('/accounts')),
  });
}
