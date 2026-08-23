import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  getSchedule,
  saveSchedule,
} from '../services/api';
import type { NetworkStatus } from '../types';
import { WEEKDAYS } from '../types';
import { usePin } from '../contexts/PinContext';

interface ScheduleModalProps {
  network: NetworkStatus;
  onClose: () => void;
}

export function ScheduleModal({ network, onClose }: ScheduleModalProps) {
  const queryClient = useQueryClient();
  const { refreshSession } = usePin();
  const { data, isLoading } = useQuery({
    queryKey: ['schedule', network.id],
    queryFn: () => getSchedule(network.id),
  });

  const [enabled, setEnabled] = useState(false);
  const [offTime, setOffTime] = useState('22:00');
  const [onTime, setOnTime] = useState('07:00');
  const [days, setDays] = useState<string[]>(WEEKDAYS.map((d) => d.id));
  const [error, setError] = useState('');

  useEffect(() => {
    if (data?.schedule) {
      setEnabled(data.schedule.enabled);
      setOffTime(data.schedule.offTime);
      setOnTime(data.schedule.onTime);
      setDays(data.schedule.days);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      saveSchedule(network.id, { enabled, offTime, onTime, days }),
    onSuccess: () => {
      refreshSession();
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      queryClient.invalidateQueries({ queryKey: ['schedule', network.id] });
      onClose();
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'Failed to save schedule');
    },
  });

  const toggleDay = (day: string) => {
    setDays((current) =>
      current.includes(day)
        ? current.filter((d) => d !== day)
        : [...current, day]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-slate-900 p-6 ring-1 ring-slate-700">
        <h2 className="mb-1 text-xl font-semibold">Schedule — {network.label}</h2>
        <p className="mb-4 text-sm text-slate-400">{network.accessPoint.name}</p>

        {isLoading ? (
          <p className="text-slate-400">Loading...</p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-5 w-5"
              />
              <span>Enable automatic on/off schedule</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                Turn off at
                <input
                  type="time"
                  value={offTime}
                  onChange={(e) => setOffTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                Turn on at
                <input
                  type="time"
                  value={onTime}
                  onChange={(e) => setOnTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                />
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm text-slate-400">Active days</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`rounded-lg px-3 py-1 text-sm ${
                      days.includes(day.id)
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 rounded-lg border border-slate-700 px-4 py-2"
              >
                Cancel
              </button>
              <button
                disabled={save.isPending || days.length === 0}
                onClick={() => save.mutate()}
                className="flex-1 rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-50"
              >
                {save.isPending ? 'Saving...' : 'Save schedule'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
