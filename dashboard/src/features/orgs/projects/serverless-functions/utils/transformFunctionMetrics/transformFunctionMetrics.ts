import type {
  ErrorsTableRow,
  FunctionMetricsResponse,
  RequestsTableRow,
} from '@/features/orgs/projects/serverless-functions/types';
import type { GetFunctionsMetricsDashboardQuery } from '@/utils/__generated__/graphql';

export default function transformFunctionMetrics(
  data: GetFunctionsMetricsDashboardQuery,
  to: Date,
): FunctionMetricsResponse {
  const toIso = to.toISOString();

  const totalRequests: RequestsTableRow[] = data.invocations
    .map((s) => ({
      timestamp: toIso,
      method: s.labels.method,
      value: s.datapoints.reduce((acc: number, v: number) => acc + v, 0),
    }))
    .sort((a, b) => b.value - a.value);

  const totalErrors: ErrorsTableRow[] = data.totalErrors
    .map((v) => ({
      timestamp: toIso,
      method: v.labels.method,
      status: v.labels.status,
      value: v.value,
    }))
    .sort((a, b) => b.value - a.value);

  return {
    summary: {
      // bragi returns an empty array (not [{value: 0}]) when there is no traffic
      // in the selected window — Prometheus returns no data, not a zero sample.
      totalInvocations: data.totalInvocations[0]?.value ?? 0,
      totalBytesSent: data.totalBytesSent[0]?.value ?? 0,
      totalDurationSeconds: data.totalDuration[0]?.value ?? 0,
    },
    general: {
      invocationsByMethod: data.invocations,
      responseStatus: data.responseStatus,
      averageResponseSize: data.averageResponseSize,
      totalRequests,
    },
    responseTimes: {
      // histogram_quantile(1.0, ...): upper bound of the highest non-empty
      // bucket; may render as +Inf when samples land in Prometheus's le=+Inf.
      max: data.durationMax,
      p95: data.durationP95,
      p75: data.durationP75,
      avg: data.averageResponseTime,
    },
    errors: {
      errorRate: data.errorRate,
      totalErrors,
    },
  };
}
