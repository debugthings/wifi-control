import axios from 'axios';
import type {
  AccessPoint,
  AuthSettings,
  DiscoveredIface,
  NetworkSchedule,
  NetworkStatus,
} from '../types';

const api = axios.create({ baseURL: '/api' });

let adminPin: string | null = null;

export function setAdminPin(pin: string | null) {
  adminPin = pin;
}

api.interceptors.request.use((config) => {
  if (adminPin) {
    config.headers['x-admin-pin'] = adminPin;
  }
  return config;
});

export const getAuthSettings = () =>
  api.get<AuthSettings>('/auth/settings').then((r) => r.data);

export const verifyPin = (pin: string) =>
  api.post<{ valid: boolean }>('/auth/verify-pin', { pin }).then((r) => r.data);

export const setPin = (newPin: string, currentPin?: string) =>
  api
    .post<{ success: boolean }>('/auth/set-pin', { newPin, currentPin })
    .then((r) => r.data);

export const getNetworks = () =>
  api.get<{ networks: NetworkStatus[] }>('/networks').then((r) => r.data);

export const toggleNetwork = (id: string, enabled: boolean) =>
  api
    .post<{ id: string; disabled: boolean; enabled: boolean }>(
      `/networks/${id}/toggle`,
      { enabled }
    )
    .then((r) => r.data);

export const getSchedule = (networkId: string) =>
  api
    .get<{ schedule: NetworkSchedule; cronSynced: boolean }>(
      `/schedules/${networkId}`
    )
    .then((r) => r.data);

export const saveSchedule = (networkId: string, schedule: NetworkSchedule) =>
  api
    .put<{ schedule: NetworkSchedule; cronSynced: boolean }>(
      `/schedules/${networkId}`,
      schedule
    )
    .then((r) => r.data);

export const getAccessPoints = () =>
  api.get<AccessPoint[]>('/access-points').then((r) => r.data);

export const createAccessPoint = (data: {
  id: string;
  name: string;
  host: string;
  ubusUsername: string;
  ubusPassword: string;
  ubusUrl?: string;
  useHttps?: boolean;
}) => api.post<AccessPoint>('/access-points', data).then((r) => r.data);

export const deleteAccessPoint = (id: string) =>
  api.delete<{ success: boolean }>(`/access-points/${id}`).then((r) => r.data);

export const testAccessPoint = (id: string) =>
  api.post<{ ok: boolean }>(`/access-points/${id}/test`).then((r) => r.data);

export const discoverIfaces = (id: string) =>
  api
    .post<{ ifaces: DiscoveredIface[] }>(`/access-points/${id}/discover`)
    .then((r) => r.data);

export const createNetwork = (data: {
  id: string;
  accessPointId: string;
  label: string;
  uciSection: string;
  ssid?: string;
}) => api.post('/networks', data).then((r) => r.data);

export const deleteNetwork = (id: string) =>
  api.delete<{ success: boolean }>(`/networks/${id}`).then((r) => r.data);
