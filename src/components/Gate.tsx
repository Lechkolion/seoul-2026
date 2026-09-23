import { useEffect, useRef, useState, type FormEvent } from 'react';
import { m, useAnimationControls } from 'framer-motion';
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from 'lucide-react';
import type { EncBlob, Home } from '../lib/types';
import { loadHomeBlob, unlockWithPasscode, unlockWithStoredKey } from '../lib/crypto';

interface Props {
  onUnlock: (home: Home) => void;
}

/**
 * Family passcode gate. The passcode is verified by decrypting the home blob
 * (AES-256-GCM, PBKDF2-SHA256 key); nothing secret lives in the source.
 */
export function Gate({ onUnlock }: Props) {
  const [blob, setBlob] = useState<EncBlob | null>(null);
  const [phase, setPhase] = useState<'checking' | 'locked' | 'working' | 'missing'>('checking');
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const controls = useAnimationControls();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = await loadHomeBlob();
      if (!alive) return;
      if (!b) {
        setPhase('missing');
        return;
      }
      setBlob(b);
      const home = await unlockWithStoredKey(b);
      if (!alive) return;
      if (home) onUnlock(home);
      else setPhase('locked');
    })();
    return () => {
      alive = false;
    };
  }, [onUnlock]);

  useEffect(() => {
    if (phase === 'locked') input.current?.focus();
  }, [phase]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!blob || !code.trim() || phase === 'working') return;
    setPhase('working');
    setError('');
    try {
      const home = await unlockWithPasscode(code, blob);
      onUnlock(home);
    } catch {
      setPhase('locked');
      setError('That passcode didn’t work. Check with the family chat and try again.');
      setCode('');
      controls.start({ x: [0, -12, 10, -7, 5, -2, 0], transition: { duration: 0.5 } });
      requestAnimationFrame(() => input.current?.focus());
    }
  };

  return (
    <div className="gate" data-phase={phase}>
      <div className="gate__sky" aria-hidden="true">
        <span className="gate__moon" />
        <span className="gate__ring gate__ring--1" />
        <span className="gate__ring gate__ring--2" />
        <span className="gate__ring gate__ring--3" />
        <span className="gate__grid" />
      </div>
      <m.main className="gate__card" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.2, 0.7, 0.2, 1] }}>
        <p className="gate__eyebrow">
          <span className="gate__dot" /> Private family guide
        </p>
        <h1 className="gate__title">
          Seoul
          <span className="gate__year">2026</span>
        </h1>
        <p className="gate__dates">23 – 30 September · Chuseok week</p>

        {phase === 'missing' ? (
          <p className="gate__msg" role="alert">
            The guide can’t reach its data right now. Connect to the internet once and reload — after that it works offline.
          </p>
        ) : (
          <m.form className="gate__form" onSubmit={submit} animate={controls} aria-busy={phase !== 'locked'}>
            <label htmlFor="passcode" className="gate__label">
              <LockKeyhole size={16} aria-hidden="true" /> Family passcode
            </label>
            <div className={`gate__field ${error ? 'has-error' : ''}`}>
              <input
                ref={input}
                id="passcode"
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError('');
                }}
                disabled={phase === 'checking'}
                aria-invalid={!!error}
                aria-describedby="gate-help"
                placeholder="Enter passcode"
              />
              <button type="button" className="gate__eye" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide passcode' : 'Show passcode'}>
                {show ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
              </button>
              <button type="submit" className="gate__go" disabled={!code.trim() || phase !== 'locked'} aria-label="Unlock">
                {phase === 'working' || phase === 'checking' ? <LoaderCircle className="spin" size={22} aria-hidden="true" /> : <ArrowRight size={22} aria-hidden="true" />}
              </button>
            </div>
            <p id="gate-help" className={`gate__help ${error ? 'is-error' : ''}`} role={error ? 'alert' : undefined}>
              {error || 'Enter it once — this device will remember it.'}
            </p>
          </m.form>
        )}
      </m.main>
      <p className="gate__foot">For family use only · not indexed</p>
    </div>
  );
}
