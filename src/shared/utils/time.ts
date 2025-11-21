type TimestampLike = Date | string | number | null | undefined;

const toDate = (value: TimestampLike): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return null;
};

export const minutesBetween = (from: TimestampLike, to: TimestampLike = new Date()) => {
  const start = toDate(from);
  const end = toDate(to);
  if (!start || !end) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 1000 / 60));
};

export const formatMinutes = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins} min`;
};

export const formatDurationSince = (from: TimestampLike) => {
  const mins = minutesBetween(from);
  return formatMinutes(mins);
};

export const isDelayed = (from: TimestampLike, thresholdMinutes = 30) => {
  return minutesBetween(from) >= thresholdMinutes;
};
