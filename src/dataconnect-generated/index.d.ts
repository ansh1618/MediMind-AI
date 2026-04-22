import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, DataConnectSettings } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;
export const dataConnectSettings: DataConnectSettings;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface Condition_Key {
  id: UUIDString;
  __typename?: 'Condition_Key';
}

export interface GetMyHealthMetricsData {
  healthMetrics: ({
    id: UUIDString;
    metricType: string;
    value: number;
    unit: string;
    recordedAt: TimestampString;
    notes?: string | null;
  } & HealthMetric_Key)[];
}

export interface HealthMetric_Key {
  id: UUIDString;
  __typename?: 'HealthMetric_Key';
}

export interface HealthTopic_Key {
  id: UUIDString;
  __typename?: 'HealthTopic_Key';
}

export interface SymptomCheck_Key {
  id: UUIDString;
  __typename?: 'SymptomCheck_Key';
}

export interface User_Key {
  id: UUIDString;
  __typename?: 'User_Key';
}

interface GetMyHealthMetricsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<GetMyHealthMetricsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<GetMyHealthMetricsData, undefined>;
  operationName: string;
}
export const getMyHealthMetricsRef: GetMyHealthMetricsRef;

export function getMyHealthMetrics(options?: ExecuteQueryOptions): QueryPromise<GetMyHealthMetricsData, undefined>;
export function getMyHealthMetrics(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<GetMyHealthMetricsData, undefined>;

