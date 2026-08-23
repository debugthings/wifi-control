import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  createAccessPoint,
  createNetwork,
  deleteAccessPoint,
  deleteNetwork,
  discoverIfaces,
  getAccessPoints,
  getNetworks,
  testAccessPoint,
} from '../services/api';
import { usePin } from '../contexts/PinContext';

export function AdminPage() {
  const queryClient = useQueryClient();
  const { refreshSession } = usePin();
  const [apForm, setApForm] = useState({
    id: '',
    name: '',
    host: '',
    ubusUsername: 'wifi-control',
    ubusPassword: '',
  });
  const [networkForm, setNetworkForm] = useState({
    id: '',
    accessPointId: '',
    label: '',
    uciSection: '',
    ssid: '',
  });
  const [discovered, setDiscovered] = useState<
    { section: string; ssid?: string }[]
  >([]);
  const [message, setMessage] = useState('');

  const { data: accessPoints = [] } = useQuery({
    queryKey: ['access-points'],
    queryFn: getAccessPoints,
  });
  const { data: networksData } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
  });

  const addAp = useMutation({
    mutationFn: () => createAccessPoint(apForm),
    onSuccess: () => {
      refreshSession();
      queryClient.invalidateQueries({ queryKey: ['access-points'] });
      setApForm({
        id: '',
        name: '',
        host: '',
        ubusUsername: 'wifi-control',
        ubusPassword: '',
      });
      setMessage('Access point added');
    },
    onError: (err) =>
      setMessage(err instanceof Error ? err.message : 'Failed to add AP'),
  });

  const addNetwork = useMutation({
    mutationFn: () =>
      createNetwork({
        ...networkForm,
        ssid: networkForm.ssid || undefined,
      }),
    onSuccess: () => {
      refreshSession();
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      setNetworkForm({
        id: '',
        accessPointId: networkForm.accessPointId,
        label: '',
        uciSection: '',
        ssid: '',
      });
      setMessage('Network added');
    },
    onError: (err) =>
      setMessage(err instanceof Error ? err.message : 'Failed to add network'),
  });

  const testAp = useMutation({
    mutationFn: (id: string) => testAccessPoint(id),
    onSuccess: () => setMessage('Connection successful'),
    onError: (err) =>
      setMessage(err instanceof Error ? err.message : 'Connection failed'),
  });

  const discover = useMutation({
    mutationFn: (id: string) => discoverIfaces(id),
    onSuccess: (data) => {
      setDiscovered(data.ifaces);
      setMessage(`Found ${data.ifaces.length} wifi-iface sections`);
    },
    onError: (err) =>
      setMessage(err instanceof Error ? err.message : 'Discovery failed'),
  });

  const removeAp = useMutation({
    mutationFn: (id: string) => deleteAccessPoint(id),
    onSuccess: () => {
      refreshSession();
      queryClient.invalidateQueries({ queryKey: ['access-points'] });
      queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
  });

  const removeNetwork = useMutation({
    mutationFn: (id: string) => deleteNetwork(id),
    onSuccess: () => {
      refreshSession();
      queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
  });

  return (
    <div className="space-y-8">
      {message && (
        <p className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-sky-300 ring-1 ring-slate-700">
          {message}
        </p>
      )}

      <section className="rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <h2 className="mb-4 text-lg font-semibold">Add access point</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['id', 'name', 'host', 'ubusUsername', 'ubusPassword'] as const).map(
            (field) => (
              <input
                key={field}
                placeholder={field}
                value={apForm[field]}
                onChange={(e) =>
                  setApForm((f) => ({ ...f, [field]: e.target.value }))
                }
                className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            )
          )}
        </div>
        <button
          onClick={() => addAp.mutate()}
          disabled={addAp.isPending}
          className="mt-4 rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950"
        >
          Add AP
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
                  onClick={() => {
                    setNetworkForm((f) => ({ ...f, accessPointId: ap.id }));
                    discover.mutate(ap.id);
                  }}
                  className="text-sm text-sky-400"
                >
                  Discover SSIDs
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
      </section>

      <section className="rounded-2xl bg-slate-900 p-5 ring-1 ring-slate-800">
        <h2 className="mb-4 text-lg font-semibold">Add WiFi network</h2>
        {discovered.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {discovered.map((iface) => (
              <button
                key={iface.section}
                onClick={() =>
                  setNetworkForm((f) => ({
                    ...f,
                    uciSection: iface.section,
                    ssid: iface.ssid || '',
                    label: iface.ssid || iface.section,
                    id: `${f.accessPointId}-${iface.section}`,
                  }))
                }
                className="rounded-lg bg-slate-800 px-3 py-1 text-sm"
              >
                {iface.ssid || iface.section} ({iface.section})
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <select
            value={networkForm.accessPointId}
            onChange={(e) =>
              setNetworkForm((f) => ({ ...f, accessPointId: e.target.value }))
            }
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
          >
            <option value="">Select AP</option>
            {accessPoints.map((ap) => (
              <option key={ap.id} value={ap.id}>
                {ap.name}
              </option>
            ))}
          </select>
          {(['id', 'label', 'uciSection', 'ssid'] as const).map((field) => (
            <input
              key={field}
              placeholder={field}
              value={networkForm[field]}
              onChange={(e) =>
                setNetworkForm((f) => ({ ...f, [field]: e.target.value }))
              }
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
            />
          ))}
        </div>
        <button
          onClick={() => addNetwork.mutate()}
          disabled={addNetwork.isPending}
          className="mt-4 rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950"
        >
          Add network
        </button>

        <ul className="mt-6 space-y-2">
          {(networksData?.networks ?? []).map((network) => (
            <li
              key={network.id}
              className="flex items-center justify-between rounded-lg bg-slate-950 px-3 py-2 text-sm"
            >
              <span>
                {network.label} ({network.uciSection}) — {network.accessPoint.name}
              </span>
              <button
                onClick={() => removeNetwork.mutate(network.id)}
                className="text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
