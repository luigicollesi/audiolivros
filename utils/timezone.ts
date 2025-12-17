import * as Localization from 'expo-localization';

type TimezoneInfo = { timezone: string; offsetMinutes: number };

function guessTimezoneFromSystem(): string {
  // iOS: TimeZone.current.identifier -> exposed by expo-localization calendars
  const calendarZone = Localization.getCalendars?.()[0]?.timeZone;
  if (calendarZone) return calendarZone;
  // Android: ZoneId.systemDefault().id -> expo-localization timeZone mirrors this
  if (Localization.timezone) return Localization.timezone;
  // Web: Intl
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Returns the device timezone and offset, prioritizing the native system zone
 * (equivalent to ZoneId.systemDefault()/TimeZone.current) and falling back
 * to Intl. Offset is minutes relative to UTC (JS convention).
 */
export function getTimezoneInfo(): TimezoneInfo {
  let timezone = 'UTC';
  try {
    timezone = guessTimezoneFromSystem() || 'UTC';
  } catch {
    timezone = 'UTC';
  }
  // JS getTimezoneOffset is negative for UTC+, positive for UTC-
  const offsetMinutes = -new Date().getTimezoneOffset();
  return { timezone, offsetMinutes };
}

export function getDeviceTimezone(): string {
  return getTimezoneInfo().timezone;
}
