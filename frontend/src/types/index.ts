export interface AuthSettings {
  hasPinConfigured: boolean;
}

export interface AccessPoint {
  id: string;
  name: string;
  host: string;
  ubusUrl: string;
  ubusUsername: string;
  useHttps: boolean;
  enabled: boolean;
}

export interface NetworkSchedule {
  enabled: boolean;
  offTime: string;
  onTime: string;
  days: string[];
}

export interface NetworkStatus {
  id: string;
  label: string;
  uciSection: string;
  ssid?: string | null;
  enabled: boolean;
  accessPoint: {
    id: string;
    name: string;
    host: string;
    enabled: boolean;
  };
  disabled: boolean | null;
  reachable: boolean;
  error?: string;
  schedule: NetworkSchedule | null;
}

export interface DiscoveredIface {
  section: string;
  ssid?: string;
  device?: string;
  disabled: boolean;
  mode?: string;
}

export const WEEKDAYS = [
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
] as const;
