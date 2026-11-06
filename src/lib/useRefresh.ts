// Pull-to-refresh helper: refetches the queries the current screen is observing
// (type: 'active'), so any screen can wire a RefreshControl without tracking its
// individual query keys.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useRefresh(): { refreshing: boolean; onRefresh: () => void } {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      setRefreshing(false);
    }
  };

  return { refreshing, onRefresh };
}
