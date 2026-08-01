import type { SecurityReportSeed } from '../types';

// Los registros reales contienen datos personales y no deben versionarse.
// La bitácora se alimenta desde Firestore o mediante una importación privada
// ejecutada por un Super Admin.
export const whatsappReportsSeed: SecurityReportSeed[] = [];
