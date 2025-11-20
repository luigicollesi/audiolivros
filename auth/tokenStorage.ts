// auth/tokenStorage.ts
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { authLogger } from '@/utils/logger';

type FileSystemWithLegacy = typeof FileSystem & {
  documentDirectory?: string | null;
  cacheDirectory?: string | null;
};

const FS = FileSystem as FileSystemWithLegacy;
const STORAGE_ROOT = FS.documentDirectory ?? FS.cacheDirectory ?? null;
const STORAGE_FILENAME = 'auth-flow-token.json';
const STORAGE_URI = STORAGE_ROOT ? `${STORAGE_ROOT}${STORAGE_FILENAME}` : null;
const WEB_STORAGE_KEY = 'audiolivros.auth.flow.token';

const normalizeToken = (token?: string | null) => {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getWebStorage = () => {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export async function readStoredAuthToken(): Promise<string | null> {
  const webStorage = getWebStorage();
  if (webStorage) {
    const raw = webStorage.getItem(WEB_STORAGE_KEY);
    return normalizeToken(raw);
  }

  if (!STORAGE_URI) {
    authLogger.warn('Persistência de token indisponível: diretório não encontrado.');
    return null;
  }

  try {
    const info = await FileSystem.getInfoAsync(STORAGE_URI);
    if (!info.exists) return null;

    const raw = await FileSystem.readAsStringAsync(STORAGE_URI);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return normalizeToken(parsed?.token) ?? null;
  } catch (err) {
    authLogger.warn('Falha ao ler token persistido.', err);
    return null;
  }
}

export async function persistStoredAuthToken(token: string): Promise<void> {
  const normalized = normalizeToken(token);
  if (!normalized) return;

  const webStorage = getWebStorage();
  if (webStorage) {
    try {
      webStorage.setItem(WEB_STORAGE_KEY, normalized);
    } catch (err) {
      authLogger.warn('Falha ao persistir token (web).', err);
    }
    return;
  }

  if (!STORAGE_URI) return;

  try {
    await FileSystem.writeAsStringAsync(
      STORAGE_URI,
      JSON.stringify({
        token: normalized,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch (err) {
    authLogger.warn('Falha ao persistir token de autenticação.', err);
  }
}

export async function clearStoredAuthToken(): Promise<void> {
  const webStorage = getWebStorage();
  if (webStorage) {
    try {
      webStorage.removeItem(WEB_STORAGE_KEY);
    } catch (err) {
      authLogger.warn('Falha ao limpar token persistido (web).', err);
    }
    return;
  }

  if (!STORAGE_URI) return;

  try {
    const info = await FileSystem.getInfoAsync(STORAGE_URI);
    if (!info.exists) return;
    await FileSystem.deleteAsync(STORAGE_URI, { idempotent: true });
  } catch (err) {
    authLogger.warn('Falha ao limpar token persistido.', err);
  }
}
