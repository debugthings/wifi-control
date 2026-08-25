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

export interface SyncSummary {
  added: number;
  updated: number;
  skipped: number;
  ifaces: DiscoveredIface[];
}

export interface CreateAccessPointResponse extends AccessPoint {
  sync?: SyncSummary;
  syncError?: string;
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

export interface DiscoverResult {
  ifaces: DiscoveredIface[];
  added: number;
  updated: number;
  skipped: number;
}

export type GroupAggregateStatus =
  | 'allOn'
  | 'allOff'
  | 'mixed'
  | 'unreachable';

export interface GroupMemberStatus {
  id: string;
  label: string;
  ssid?: string | null;
  uciSection: string;
  accessPoint: { id: string; name: string };
  disabled: boolean | null;
  reachable: boolean;
  error?: string;
}

export interface NetworkGroupStatus {
  id: string;
  name: string;
  status: GroupAggregateStatus;
  members: GroupMemberStatus[];
  memberResults?: {
    networkId: string;
    ok: boolean;
    error?: string;
  }[];
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
