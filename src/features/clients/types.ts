export type ClientRecord = {
  id: string;
  name: string;
  estado: string;
  proceso: string;
  patente?: string;
  contacto?: string;
  correo?: string;
  notas?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateClientInput = Omit<ClientRecord, "id" | "createdAt" | "updatedAt">;
