import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { getGroups, getNetworks, toggleGroup, toggleNetwork } from '../services/api';
import type { NetworkGroupStatus, NetworkStatus } from '../types';
import { ScheduleModal } from '../components/ScheduleModal';
import { usePin } from '../contexts/PinContext';

function NetworkCard({
  network,
  onSchedule,
}: {
  network: NetworkStatus;
  onSchedule: () => void;
}) {
  const queryClient = useQueryClient();
  const { isAuthed, refreshSession } = usePin();
  const isOn = network.disabled === false;
  const offline = !network.reachable;

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => toggleNetwork(network.id, enabled),
    onSuccess: () => {
      refreshSession();
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });

  return (
    <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{network.label}</h3>
          <p className="text-sm text-slate-400">
            {network.ssid || network.uciSection} · {network.accessPoint.name}
          </p>
        </div>
        <span
          className={`mt-1 h-2.5 w-2.5 rounded-full ${
            offline ? 'bg-red-500' : 'bg-emerald-500'
          }`}
          title={offline ? network.error || 'Unreachable' : 'Online'}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={!isAuthed || offline || toggle.isPending}
          onClick={() => toggle.mutate(!isOn)}
          className={`flex-1 rounded-xl px-4 py-4 text-lg font-semibold transition ${
            isOn
              ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
          } disabled:cursor-not-allowed disabled:opacity-40`}
        >
          {toggle.isPending ? 'Updating...' : isOn ? 'ON — Tap to turn off' : 'OFF — Tap to turn on'}
        </button>
      </div>

      {network.schedule?.enabled && (
        <p className="mt-2 text-xs text-sky-400">
          Scheduled {network.schedule.onTime}–{network.schedule.offTime}
        </p>
      )}

      {isAuthed && (
        <button
          onClick={onSchedule}
          className="mt-3 w-full rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Edit schedule
        </button>
      )}

      {!isAuthed && (
        <p className="mt-2 text-xs text-slate-500">Enter PIN to control WiFi</p>
      )}
    </div>
  );
}

function GroupCard({ group }: { group: NetworkGroupStatus }) {
  const queryClient = useQueryClient();
  const { isAuthed, refreshSession } = usePin();
  const isOn = group.status === 'allOn';
  const isOff = group.status === 'allOff';
  const offline = group.status === 'unreachable';
  const mixed = group.status === 'mixed';

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => toggleGroup(group.id, enabled),
    onSuccess: () => {
      refreshSession();
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
  });

  const nextEnabled = mixed || isOff ? true : false;

  return (
    <div className="rounded-2xl bg-slate-900 p-4 ring-1 ring-slate-800">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold">{group.name}</h3>
          <p className="text-sm text-slate-400">
            {group.members.length} networks
            {mixed ? ' · mixed state' : ''}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {group.members
              .map((m) => `${m.label}@${m.accessPoint.name}`)
              .join(', ')}
          </p>
        </div>
        <span
          className={`mt-1 h-2.5 w-2.5 rounded-full ${
            offline
              ? 'bg-red-500'
              : mixed
                ? 'bg-amber-400'
                : isOn
                  ? 'bg-emerald-500'
                  : 'bg-slate-500'
          }`}
        />
      </div>

      <button
        disabled={!isAuthed || offline || toggle.isPending}
        onClick={() => toggle.mutate(mixed ? false : nextEnabled)}
        className={`w-full rounded-xl px-4 py-4 text-lg font-semibold transition ${
          isOn
            ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
            : mixed
              ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
              : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
        } disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {toggle.isPending
          ? 'Updating...'
          : offline
            ? 'Unreachable'
            : mixed
              ? 'MIXED — Tap to turn all off'
              : isOn
                ? 'ON — Tap to turn all off'
                : 'OFF — Tap to turn all on'}
      </button>

      {!isAuthed && (
        <p className="mt-2 text-xs text-slate-500">Enter PIN to control WiFi</p>
      )}
    </div>
  );
}

export function Dashboard() {
  const [scheduleNetwork, setScheduleNetwork] = useState<NetworkStatus | null>(
    null
  );
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
    refetchInterval: 30000,
  });
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
    refetchInterval: 30000,
  });

  const grouped = (data?.networks ?? []).reduce<Record<string, NetworkStatus[]>>(
    (acc, network) => {
      const key = network.accessPoint.id;
      acc[key] = acc[key] || [];
      acc[key].push(network);
      return acc;
    },
    {}
  );

  if (isLoading) {
    return <p className="text-slate-400">Loading networks...</p>;
  }

  if (error) {
    return (
      <p className="text-red-400">
        Failed to load networks.{' '}
        <button onClick={() => refetch()} className="underline">
          Retry
        </button>
      </p>
    );
  }

  const networks = data?.networks ?? [];
  const groups = groupsData?.groups ?? [];

  if (networks.length === 0 && groups.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
        No WiFi networks configured yet. Open Admin, add an AP with bootstrap
        credentials, and SSIDs will appear automatically.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8">
        {groups.length > 0 && (
          <section>
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
              Groups
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
            Individual SSIDs
          </h2>
          <div className="space-y-6">
            {Object.entries(grouped).map(([apId, apNetworks]) => (
              <div key={apId}>
                <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {apNetworks[0]?.accessPoint.name}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  {apNetworks.map((network) => (
                    <NetworkCard
                      key={network.id}
                      network={network}
                      onSchedule={() => setScheduleNetwork(network)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {scheduleNetwork && (
        <ScheduleModal
          network={scheduleNetwork}
          onClose={() => setScheduleNetwork(null)}
        />
      )}
    </>
  );
}
