import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { setAdminPin as setApiPin } from '../services/api';

const SESSION_KEY = 'wifiControlPin';
const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

interface PinContextValue {
  isAuthed: boolean;
  pin: string | null;
  setPin: (pin: string | null) => void;
  clearSession: () => void;
  refreshSession: () => void;
}

const PinContext = createContext<PinContextValue | undefined>(undefined);

function loadSession(): { pin: string; expiresAt: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as { pin: string; expiresAt: number };
    if (Date.now() > session.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function PinProvider({ children }: { children: ReactNode }) {
  const [pin, setPinState] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const clearSession = useCallback(() => {
    setPinState(null);
    setApiPin(null);
    setIsAuthed(false);
    sessionStorage.removeItem(SESSION_KEY);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, []);

  const startTimeout = useCallback(
    (value: string) => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => clearSession(), SESSION_TIMEOUT_MS);
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ pin: value, expiresAt: Date.now() + SESSION_TIMEOUT_MS })
      );
    },
    [clearSession]
  );

  const setPin = useCallback(
    (value: string | null) => {
      setPinState(value);
      setApiPin(value);
      setIsAuthed(!!value);
      if (value) startTimeout(value);
      else clearSession();
    },
    [clearSession, startTimeout]
  );

  const refreshSession = useCallback(() => {
    if (pin) startTimeout(pin);
  }, [pin, startTimeout]);

  useEffect(() => {
    const session = loadSession();
    if (session) {
      setPinState(session.pin);
      setApiPin(session.pin);
      setIsAuthed(true);
      startTimeout(session.pin);
    }
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [startTimeout]);

  return (
    <PinContext.Provider value={{ isAuthed, pin, setPin, clearSession, refreshSession }}>
      {children}
    </PinContext.Provider>
  );
}

export function usePin() {
  const ctx = useContext(PinContext);
  if (!ctx) throw new Error('usePin must be used within PinProvider');
  return ctx;
}
