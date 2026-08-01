export type SecurityReportCategory =
  | 'truck_entry'
  | 'truck_exit'
  | 'security_round'
  | 'shift_change'
  | 'personnel'
  | 'facility'
  | 'transport';

export type SecurityReportOperation = 'carga' | 'descarga';
export type SecurityReportReview = 'verified' | 'review';
export type SecurityReportTimePrecision = 'minute' | 'date';

export type SecurityReportSeed = {
  id: string;
  occurredAt: string;
  timePrecision?: SecurityReportTimePrecision;
  category: SecurityReportCategory;
  title: string;
  details: string;
  reporter: string;
  personName?: string;
  identifier?: string;
  company?: string;
  client?: string;
  plate?: string;
  operation?: SecurityReportOperation;
  dock?: string;
  hasEvidence?: boolean;
  review: SecurityReportReview;
  sourceText: string;
  source: 'WhatsApp';
  sourceChat: 'GGSS-ReporteSeguridadFriosan';
};

export type SecurityReport = Omit<SecurityReportSeed, 'occurredAt'> & {
  occurredAt: Date;
  importedAt?: Date | null;
  persisted: boolean;
};
