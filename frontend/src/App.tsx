import { useEffect, useState } from 'react';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PinModal } from './components/PinModal';
import { usePin } from './contexts/PinContext';
import { AdminPage } from './pages/AdminPage';
import { Dashboard } from './pages/Dashboard';
import { getAuthSettings, setPin, verifyPin } from './services/api';

function AppShell() {
  const { isAuthed, setPin: savePin, clearSession } = usePin();
  const [showPinModal, setShowPinModal] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ['auth-settings'],
    queryFn: getAuthSettings,
  });

  useEffect(() => {
    if (settings && !settings.hasPinConfigured) {
      setNeedsSetup(true);
      setShowPinModal(true);
    }
  }, [settings]);

  const handlePinSubmit = async (pin: string) => {
    if (needsSetup) {
      await setPin(pin);
      setNeedsSetup(false);
      savePin(pin);
      setShowPinModal(false);
      return;
    }
    const result = await verifyPin(pin);
    if (!result.valid) throw new Error('Invalid PIN');
    savePin(pin);
    setShowPinModal(false);
  };

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WiFi Control</h1>
          <p className="text-sm text-slate-400">OpenWRT SSID management</p>
        </div>
        <div className="flex gap-2">
          {!isAuthed ? (
            <button
              onClick={() => setShowPinModal(true)}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm"
            >
              Enter PIN
            </button>
          ) : (
            <button
              onClick={clearSession}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm"
            >
              Lock
            </button>
          )}
          <Link
            to="/admin"
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
          >
            Admin
          </Link>
          <Link
            to="/"
            className="rounded-lg bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
          >
            Dashboard
          </Link>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>

      <PinModal
        open={showPinModal}
        title={needsSetup ? 'Set your PIN' : 'Enter PIN'}
        isSetup={needsSetup}
        onSubmit={handlePinSubmit}
        onCancel={needsSetup ? undefined : () => setShowPinModal(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
