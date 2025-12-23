import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../shared/config/firebase";
import type { ClientRecord, CreateClientInput } from "./types";

const clientsCol = collection(db, "clients");

const asDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "string" || typeof value === "number") return new Date(value);
  return undefined;
};

const mapClient = (snap: any): ClientRecord => {
  const data = snap.data();
  return {
    id: snap.id,
    razonSocial: data.razonSocial ?? "",
    nombreEmpresa: data.nombreEmpresa ?? "",
    correoContacto: data.correoContacto ?? "",
    createdAt: asDate(data.createdAt),
    updatedAt: asDate(data.updatedAt),
  };
};

export const subscribeClients = (
  onUpdate: (clients: ClientRecord[]) => void,
  onError?: (err: unknown) => void,
) => {
  const q = query(clientsCol, orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onUpdate(snap.docs.map(mapClient)),
    (err) => {
      console.error("Error en clientes", err);
      onError?.(err);
    },
  );
};

export const createClient = async (input: CreateClientInput) => {
  const now = serverTimestamp();
  await addDoc(clientsCol, {
    razonSocial: input.razonSocial.trim(),
    nombreEmpresa: input.nombreEmpresa.trim(),
    correoContacto: input.correoContacto?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
  });
};

export const updateClient = async (id: string, input: Partial<CreateClientInput>) => {
  const ref = doc(clientsCol, id);
  const patch: any = { updatedAt: serverTimestamp() };
  if (input.razonSocial !== undefined) patch.razonSocial = input.razonSocial.trim();
  if (input.nombreEmpresa !== undefined) patch.nombreEmpresa = input.nombreEmpresa.trim();
  if (input.correoContacto !== undefined) patch.correoContacto = input.correoContacto.trim();
  await updateDoc(ref, patch);
};

export const deleteClient = async (id: string) => {
  const ref = doc(clientsCol, id);
  await deleteDoc(ref);
};
