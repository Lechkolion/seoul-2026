import type { EncBlob, Home } from './types';

const KEY_STORE = 'sf26.key';

const b64ToBytes = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const bytesToB64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));

async function deriveKey(passcode: string, blob: EncBlob): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64ToBytes(blob.salt), iterations: blob.iter || 200000 },
    base,
    { name: 'AES-GCM', length: 256 },
    true,
    ['decrypt'],
  );
}

async function decryptWith(key: CryptoKey, blob: EncBlob): Promise<Home> {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBytes(blob.iv) }, key, b64ToBytes(blob.ct));
  const home = JSON.parse(new TextDecoder().decode(plain)) as Home;
  if (typeof home.lat !== 'number' || typeof home.lng !== 'number' || !home.addressKo) throw new Error('bad payload');
  return home;
}

/** Throws on a wrong passcode (GCM auth-tag mismatch). Remembers the derived key on success. */
export async function unlockWithPasscode(passcode: string, blob: EncBlob): Promise<Home> {
  const key = await deriveKey(passcode.trim(), blob);
  const home = await decryptWith(key, blob);
  try {
    const raw = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(KEY_STORE, JSON.stringify({ salt: blob.salt, k: bytesToB64(raw) }));
  } catch {
    /* storage unavailable: unlocked for this session only */
  }
  return home;
}

/** Try the key remembered on this device. Returns null when absent or stale. */
export async function unlockWithStoredKey(blob: EncBlob): Promise<Home | null> {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    if (!raw) return null;
    const { salt, k } = JSON.parse(raw) as { salt: string; k: string };
    if (salt !== blob.salt) return null;
    const key = await crypto.subtle.importKey('raw', b64ToBytes(k), { name: 'AES-GCM' }, false, ['decrypt']);
    return await decryptWith(key, blob);
  } catch {
    return null;
  }
}

export function forgetKey() {
  try {
    localStorage.removeItem(KEY_STORE);
  } catch {
    /* ignore */
  }
}

export async function loadHomeBlob(): Promise<EncBlob | null> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}data/home.enc.json`, { cache: 'no-cache' });
    if (r.ok && (r.headers.get('content-type') ?? '').includes('json')) {
      const j = (await r.json()) as EncBlob;
      if (j && j.ct && j.salt && j.iv) return j;
    }
  } catch {
    /* fall through */
  }
  if (import.meta.env.DEV) {
    const m = await import('../dev/home-dev.enc.json');
    return m.default as EncBlob;
  }
  return null;
}
