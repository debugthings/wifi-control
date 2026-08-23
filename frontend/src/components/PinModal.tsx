import { useState } from 'react';

interface PinModalProps {
  open: boolean;
  title: string;
  isSetup?: boolean;
  onSubmit: (pin: string) => Promise<void>;
  onCancel?: () => void;
}

export function PinModal({
  open,
  title,
  isSetup = false,
  onSubmit,
  onCancel,
}: PinModalProps) {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (isSetup && pin !== confirm) {
      setError('PINs do not match');
      return;
    }
    setLoading(true);
    try {
      await onSubmit(pin);
      setPin('');
      setConfirm('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid PIN');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl bg-slate-900 p-6 shadow-xl ring-1 ring-slate-700"
      >
        <h2 className="mb-4 text-xl font-semibold">{title}</h2>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder={isSetup ? 'New PIN (4+ digits)' : 'Enter PIN'}
          className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-lg tracking-widest"
          minLength={4}
          required
        />
        {isSetup && (
          <input
            type="password"
            inputMode="numeric"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ''))}
            placeholder="Confirm PIN"
            className="mb-3 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-lg tracking-widest"
            minLength={4}
            required
          />
        )}
        {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950 disabled:opacity-50"
          >
            {loading ? '...' : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
