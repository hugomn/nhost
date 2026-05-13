import { useCallback, useEffect, useMemo, useState } from 'react';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  type MetricsTimeRange,
  resolveTimeRange,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/timeRange';
import type { FunctionMetricsResponse } from '@/features/orgs/projects/serverless-functions/types';
import { transformFunctionMetrics } from '@/features/orgs/projects/serverless-functions/utils/transformFunctionMetrics';
import { useGetFunctionsMetricsDashboardQuery } from '@/utils/__generated__/graphql';

interface UseFunctionMetricsOptions {
  route: string;
  range: MetricsTimeRange;
}

interface UseFunctionMetricsResult {
  data: FunctionMetricsResponse | undefined;
  loading: boolean;
  error: Error | undefined;
  refetch: () => void;
}

export default function useFunctionMetrics({
  route,
  range,
}: UseFunctionMetricsOptions): UseFunctionMetricsResult {
  const { project, loading: loadingProject } = useProject();
  const [refetchKey, setRefetchKey] = useState(0);

  // refetchKey forces a fresh "now" when the user clicks refresh; range/now changes
  // propagate to from/to and Apollo re-fetches automatically on variable change.
  const { from, to } = useMemo(
    () => resolveTimeRange(range),
    // biome-ignore lint/correctness/useExhaustiveDependencies: refetchKey is a re-run trigger.
    [range, refetchKey],
  );

  // bragi treats `route` as a PromQL regex (`route=~"..."`). Function paths like
  // `/api/users.ts` contain regex metacharacters, so escape them for literal match.
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const {
    data: queryData,
    loading: loadingQuery,
    error,
  } = useGetFunctionsMetricsDashboardQuery({
    variables: {
      appID: project?.id ?? '',
      route: escapedRoute,
      from: from.toISOString(),
      to: to.toISOString(),
    },
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    skip: !project?.id,
  });

  // TODO(dbm): remove once metric chart shape is verified end-to-end.
  useEffect(() => {
    if (queryData) {
      // eslint-disable-next-line no-console
      console.log('[useFunctionMetrics] queryData', queryData);
    }
  }, [queryData]);

  const data = useMemo(
    () => (queryData ? transformFunctionMetrics(queryData, to) : undefined),
    [queryData, to],
  );

  const refetch = useCallback(() => {
    setRefetchKey((k) => k + 1);
  }, []);

  return {
    data,
    loading: loadingProject || loadingQuery,
    error,
    refetch,
  };
}
