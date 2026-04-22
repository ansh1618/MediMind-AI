import { GetMyHealthMetricsData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useGetMyHealthMetrics(options?: useDataConnectQueryOptions<GetMyHealthMetricsData>): UseDataConnectQueryResult<GetMyHealthMetricsData, undefined>;
export function useGetMyHealthMetrics(dc: DataConnect, options?: useDataConnectQueryOptions<GetMyHealthMetricsData>): UseDataConnectQueryResult<GetMyHealthMetricsData, undefined>;
