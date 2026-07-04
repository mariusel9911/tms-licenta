import { useQuery } from '@tanstack/react-query';
import { getOrderActivity } from '@/api/activity.api';

export function useOrderActivity(orderId: number) {
  return useQuery({
    queryKey: ['activity', orderId],
    queryFn: () => getOrderActivity(orderId),
    enabled: orderId > 0,
  });
}
