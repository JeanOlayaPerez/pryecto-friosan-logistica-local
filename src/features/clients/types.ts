export type ClientRecord = {
  id: string;
  razonSocial: string;
  nombreEmpresa: string;
  correoContacto?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateClientInput = Omit<ClientRecord, "id" | "createdAt" | "updatedAt">;
