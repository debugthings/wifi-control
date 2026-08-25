import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  createAccessPoint,
  createGroup,
  deleteAccessPoint,
  deleteGroup,
  deleteNetwork,
  discoverIfaces,
  getAccessPoints,
  getGroups,
  getNetworks,
  testAccessPoint,
  updateGroup,
} from '../services/api';
import type { DiscoveredIface, NetworkStatus } from '../types';
import { usePin } from '../contexts/PinContext';

export function AdminPage() {
  const queryClient = useQueryClient();
  const { refreshSession } = usePin();
  const [apForm, setApForm] = useState({
    name: '',
    host: '',
    ubusUsername: 'wifi-control',
    ubusPassword: '',
  });
  const [groupName, setGroupName] = useState('');
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [lastDiscovered, setLastDiscovered] = useState<DiscoveredIface[]>([]);
  const [message, setMessage] = useState('');

  const { data: accessPoints = [] } = useQuery({
    queryKey: ['access-points'],
    queryFn: getAccessPoints,
  });
  const { data: networksData } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });
  const { data: groupsData } = useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  });

  const networks = networksData?.networks ?? [];
  const groups = groupsData?.groups ?? [];

  const uniqueSsids = useMemo(() => {
    const set = new Set<string>();
    for (const n of networks) {
      if (n.ssid) set.add(n.ssid);
    }
    return [...set].sort();
  }, [networks]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['access-points'] });
    queryClient.invalidateQueries({ queryKey: ['networks'] });
    queryClient.invalidateQueries({ queryKey: ['groups'] });
  };

  const addAp = useMutation({
    mutationFn: () => createAccessPoint(apForm),
    onSuccess: (result) => {
      refreshSession();
      invalidateAll();
      setApForm({
        name: '',
        host: '',
        ubusUsername: 'wifi-control',
        ubusPassword: '',
      });
      if (result.sync) {
        setLastDiscovered(result.sync.ifaces);
        setMessage(
          `AP added. Discovered ${result.sync.ifaces.length} iface(s); added ${result.sync.added}, updated ${result.sync.updated}` +
            (result.sync.skipped ? `, skipped ${result.sync.skipped}` : '')
        );
      } else if (result.syncError) {
        setMessage(`AP saved, but discovery failed: ${result.syncError}`);
      } else {
        setMessage('Access point added');
      }
    },
    onError: (err) =>
      setMessage(err instanceof Error ? err.message : 'Failed to add AP'),
  });

  const testAp = useMutation({
    mutationFn: (id: string) => testAccessPoint(id),
    onSuccess: () => setMessage('Connection successful'),
    onError: (err) =>
      setMessage(err instanceof Error ? err.message : 'Connection failed'),
  });

  const discover = useMutation({
    mutationFn: (id: string) => discoverIfaces(id, true),
    onSuccess: (data) => {
      refreshSession();
      invalidateAll();
      setLastDiscovered(data.ifaces);
      setMessage(
        `Synced SSIDs: added ${data.added}, updated ${data.updated}` +
          (data.skipped ? `, skipped ${data.skipped}` : '')
      );
    },
    onError: (err) =>
      setMessage(err instanceof Error ? err.message : 'Discovery failed'),
  });

  const removeAp = useMutation({
    mutationFn: (id: string) => deleteAccessPoint(id),
    onSuccess: () => {
      refreshSession();
      invalidateAll();
    },
  });

  const removeNetwork = useMutation({
    mutationFn: (id: string) => deleteNetwork(id),
    onSuccess: () => {
      refreshSession();
      invalidateAll();
    },
  });

  const saveGroup = useMutation({
    mutationFn: async () => {
      if (editingGroupId) {
        return updateGroup(editingGroupId, {
          name: groupName,
          networkIds: selectedNetworkIds,
        });
      }
      return createGroup({ name: groupName, networkIds: selectedNetworkIds });
    },
    onSuccess: () => {
      refreshSession();
      invalidateAll();
      setGroupName('');
      setSelectedNetworkIds([]);
      setEditingGroupId(null);
      setMessage(editingGroupId ? 'Group updated' : 'Group created');
    },
    onError: (err) =>
      setMessage(err instanceof Error ? err.message : 'Failed to save group'),
  });

  const removeGroup = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: () => {
      refreshSession();
      invalidateAll();
    },
  });

  const toggleNetworkSelection = (id: string) => {
    setSelectedNetworkIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectBySsid = (ssid: string) => {
    const ids = networks.filter((n) => n.ssid === ssid).map((n) => n.id);
    setSelectedNetworkIds((prev) => [...new Set([...prev, ...ids])]);
  };

  const startEditGroup = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setSelectedNetworkIds(group.members.map((m) => m.id));
  };

  return (
    <div className="space-y-8">
      {message && (
        <p className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-sky-300 ring-1 ring-slate-700">
          {message}
        </p>
      )}

      <section className="rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <h2 className="mb-2 text-lg font-semibold">Add access point</h2>
        <p className="mb-4 text-sm text-slate-400">
          Run the OpenWrt bootstrap on the AP, then paste the host and{' '}
          <code className="text-slate-300">wifi-control</code> password here.
          SSIDs are discovered automatically.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['name', 'Name (e.g. Basement AP)'],
              ['host', 'LAN IP / host'],
              ['ubusUsername', 'Username'],
              ['ubusPassword', 'Password'],
            ] as const
          ).map(([field, placeholder]) => (
            <input
              key={field}
              type={field === 'ubusPassword' ? 'password' : 'text'}
              placeholder={placeholder}
              value={apForm[field]}
              onChange={(e) =>
                setApForm((f) => ({ ...f, [field]: e.target.value }))
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          ))}
        </div>
        <button
          onClick={() => addAp.mutate()}
          disabled={addAp.isPending}
          className="mt-4 rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950"
        >
          {addAp.isPending ? 'Adding…' : 'Add AP & discover SSIDs'}
        </button>

        <ul className="mt-6 space-y-3">
          {accessPoints.map((ap) => (
            <li
              key={ap.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950 px-3 py-2"
            >
              <span>
                {ap.name} — {ap.host}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => testAp.mutate(ap.id)}
                  className="text-sm text-sky-400"
                >
                  Test
                </button>
                <button
                  onClick={() => discover.mutate(ap.id)}
                  className="text-sm text-sky-400"
                >
                  Rediscover
                </button>
                <button
                  onClick={() => removeAp.mutate(ap.id)}
                  className="text-sm text-red-400"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>

        {lastDiscovered.length > 0 && (
          <div className="mt-4 rounded-lg bg-slate-950 p-3 text-sm text-slate-300">
            <p className="mb-2 font-medium text-slate-200">Last discovery</p>
            <ul className="space-y-1">
              {lastDiscovered.map((iface) => (
                <li key={iface.section}>
                  {iface.ssid || '(no ssid)'}{' '}
                  <span className="text-slate-500">
                    ({iface.section}
                    {iface.mode ? `, ${iface.mode}` : ''})
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <h2 className="mb-2 text-lg font-semibold">Discovered networks</h2>
        <p className="mb-4 text-sm text-slate-400">
          Auto-created from each AP. Delete only if you need to remove one.
        </p>
        <ul className="space-y-2">
          {networks.map((network: NetworkStatus) => (
            <li
              key={network.id}
              className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm"
            >
              <span>
                {network.label}
                {network.ssid && network.ssid !== network.label
                  ? ` (${network.ssid})`
                  : ''}{' '}
                — {network.accessPoint.name}
              </span>
              <button
                onClick={() => removeNetwork.mutate(network.id)}
                className="text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
          {networks.length === 0 && (
            <li className="text-sm text-slate-500">No networks yet.</li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <h2 className="mb-2 text-lg font-semibold">
          {editingGroupId ? 'Edit group' : 'Named groups'}
        </h2>
        <p className="mb-4 text-sm text-slate-400">
          Bundle SSIDs across APs for one-tap control (e.g. NETGEAR13 +
          NETGEAR13-5G on every AP).
        </p>

        <input
          placeholder="Group name (e.g. Kids WiFi)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
        />

        {uniqueSsids.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="text-xs text-slate-500 self-center">
              Select all matching:
            </span>
            {uniqueSsids.map((ssid) => (
              <button
                key={ssid}
                type="button"
                onClick={() => selectBySsid(ssid)}
                className="rounded-lg bg-slate-800 px-2 py-1 text-xs text-sky-300"
              >
                {ssid}
              </button>
            ))}
          </div>
        )}

        <div className="mb-4 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-800 p-2">
          {networks.map((network) => (
            <label
              key={network.id}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-950"
            >
              <input
                type="checkbox"
                checked={selectedNetworkIds.includes(network.id)}
                onChange={() => toggleNetworkSelection(network.id)}
              />
              <span className="text-sm">
                {network.label} @ {network.accessPoint.name}
              </span>
            </label>
          ))}
          {networks.length === 0 && (
            <p className="p-2 text-sm text-slate-500">
              Add an AP first so networks appear here.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => saveGroup.mutate()}
            disabled={
              saveGroup.isPending ||
              !groupName.trim() ||
              selectedNetworkIds.length === 0
            }
            className="rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-40"
          >
            {editingGroupId ? 'Update group' : 'Create group'}
          </button>
          {editingGroupId && (
            <button
              onClick={() => {
                setEditingGroupId(null);
                setGroupName('');
                setSelectedNetworkIds([]);
              }}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm"
            >
              Cancel
            </button>
          )}
        </div>

        <ul className="mt-6 space-y-2">
          {groups.map((group) => (
            <li
              key={group.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-950 px-3 py-2 text-sm"
            >
              <span>
                {group.name}{' '}
                <span className="text-slate-500">
                  ({group.members.length} networks)
                </span>
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => startEditGroup(group.id)}
                  className="text-sky-400"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeGroup.mutate(group.id)}
                  className="text-red-400"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
