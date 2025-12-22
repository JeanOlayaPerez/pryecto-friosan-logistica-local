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
    name: data.name ?? "",
    estado: data.estado ?? "",
    proceso: data.proceso ?? "",
    patente: data.patente ?? "",
    contacto: data.contacto ?? "",
    correo: data.correo ?? "",
    notas: data.notas ?? "",
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
    name: input.name.trim(),
    estado: input.estado.trim(),
    proceso: input.proceso.trim(),
    patente: input.patente?.trim() ?? "",
    contacto: input.contacto?.trim() ?? "",
    correo: input.correo?.trim() ?? "",
    notas: input.notas?.trim() ?? "",
    createdAt: now,
    updatedAt: now,
  });
};

export const updateClient = async (id: string, input: Partial<CreateClientInput>) => {
  const ref = doc(clientsCol, id);
  const patch: any = { updatedAt: serverTimestamp() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.estado !== undefined) patch.estado = input.estado.trim();
  if (input.proceso !== undefined) patch.proceso = input.proceso.trim();
  if (input.patente !== undefined) patch.patente = input.patente.trim();
  if (input.contacto !== undefined) patch.contacto = input.contacto.trim();
  if (input.correo !== undefined) patch.correo = input.correo.trim();
  if (input.notas !== undefined) patch.notas = input.notas.trim();
  await updateDoc(ref, patch);
};

export const deleteClient = async (id: string) => {
  const ref = doc(clientsCol, id);
  await deleteDoc(ref);
};
