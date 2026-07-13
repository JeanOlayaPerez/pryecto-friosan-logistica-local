import type { QualityProductType } from '../types';

export const PRODUCT_TYPE_LABELS: Record<QualityProductType, string> = {
  congelado: 'Congelado',
  refrigerado: 'Refrigerado',
  ambiente: 'Ambiente',
};

export const TEMPERATURE_RANGES: Record<
  QualityProductType,
  { min?: number; max?: number; description: string }
> = {
  congelado: { max: -15, description: 'Ideal <= -18 C, alerta sobre -15 C' },
  refrigerado: { min: 0, max: 4, description: '0 C a 4 C' },
  ambiente: { description: 'Sin rango exigido' },
};

export type TemperatureStatus = 'ok' | 'fuera_rango';

export const evaluateTemperature = (
  productType: QualityProductType | undefined,
  temperatureC: number | undefined,
): TemperatureStatus | null => {
  if (temperatureC === undefined || Number.isNaN(temperatureC)) return null;
  if (!productType) return null;
  const range = TEMPERATURE_RANGES[productType];
  if (range.min !== undefined && temperatureC < range.min) return 'fuera_rango';
  if (range.max !== undefined && temperatureC > range.max) return 'fuera_rango';
  return 'ok';
};
