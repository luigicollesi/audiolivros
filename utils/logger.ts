type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type ScopeConfig = {
  enabled?: boolean;
  levels?: Partial<Record<LogLevel, boolean>>;
};

const DEFAULT_LEVELS: Record<LogLevel, boolean> = {
  debug: false,
  info: true,
  warn: true,
  error: true,
};

const scopeConfig: Record<string, ScopeConfig> = {
  AUTH: { levels: { debug: false } },
  BOOKS: {},
  FAVORITES: {},
  SUMMARIES: {},
  AUDIO: {},
};

const normalizeValue = (value: unknown): unknown => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  }
  return value;
};

const formatMessage = (scope: string, level: LogLevel, messages: unknown[]) => [
  `[${scope}][${level.toUpperCase()}]`,
  ...messages.map(normalizeValue),
];

const isLevelEnabled = (scope: string, level: LogLevel): boolean => {
  const cfg = scopeConfig[scope] ?? {};
  const enabled = cfg.enabled ?? true;
  if (!enabled) return false;
  const levelEnabled = cfg.levels?.[level];
  if (typeof levelEnabled === 'boolean') return levelEnabled;
  return DEFAULT_LEVELS[level];
};

const createLogger = (scope: string) => ({
  debug: (...args: unknown[]) => {
    if (!isLevelEnabled(scope, 'debug')) return;
    console.debug(...formatMessage(scope, 'debug', args));
  },
  info: (...args: unknown[]) => {
    if (!isLevelEnabled(scope, 'info')) return;
    console.info(...formatMessage(scope, 'info', args));
  },
  warn: (...args: unknown[]) => {
    if (!isLevelEnabled(scope, 'warn')) return;
    console.warn(...formatMessage(scope, 'warn', args));
  },
  error: (...args: unknown[]) => {
    if (!isLevelEnabled(scope, 'error')) return;
    console.error(...formatMessage(scope, 'error', args));
  },
});

export const configureLogger = (config: Record<string, ScopeConfig>) => {
  Object.entries(config).forEach(([scope, cfg]) => {
    if (!scopeConfig[scope]) {
      scopeConfig[scope] = {};
    }
    if (typeof cfg.enabled === 'boolean') {
      scopeConfig[scope].enabled = cfg.enabled;
    }
    if (cfg.levels) {
      scopeConfig[scope].levels = {
        ...(scopeConfig[scope].levels ?? {}),
        ...cfg.levels,
      };
    }
  });
};

export const authLogger = createLogger('AUTH');
export const booksLogger = createLogger('BOOKS');
export const favoritesLogger = createLogger('FAVORITES');
export const summariesLogger = createLogger('SUMMARIES');
export const audioLogger = createLogger('AUDIO');

export default createLogger;
