import { Timestamp, arrayUnion, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../../shared/config/firebase';
import type { UserRole } from '../../auth/AuthProvider';
import type { QualityAttachment, QualityCondition, QualityDecision, QualityOperation, QualityStage } from '../types';

type Actor = { userId: string; role: UserRole | null };

export type QualityRecordInput = {
  id: string;
  operation: QualityOperation;
  stage: QualityStage;
  condition: QualityCondition;
  clientDecision?: QualityDecision;
  cargoDescription?: string;
  quantity?: string;
  notes?: string;
  attachments?: QualityAttachment[];
};

const normalizeFileName = (name: string) =>
  name.trim().replace(/[^a-zA-Z0-9._-]/g, '_') || 'archivo';

export const uploadQualityAttachments = async (
  truckId: string,
  recordId: string,
  files: File[],
): Promise<QualityAttachment[]> => {
  if (!files.length) return [];
  const uploadedAt = new Date();
  const uploads = files.map(async (file, idx) => {
    const safeName = normalizeFileName(file.name || `archivo-${idx}`);
    const storageRef = ref(
      storage,
      `quality/${truckId}/${recordId}/${Date.now()}-${idx}-${safeName}`,
    );
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    return {
      name: file.name || safeName,
      url,
      type: file.type || 'application/octet-stream',
      size: file.size || 0,
      uploadedAt,
    };
  });
  return Promise.all(uploads);
};

export const addQualityRecord = async (
  truckId: string,
  input: QualityRecordInput,
  actor?: Actor,
) => {
  const refDoc = doc(db, 'trucks', truckId);
  const now = serverTimestamp();
  const createdAt = Timestamp.now();
  const attachments = (input.attachments ?? []).map((file) => ({
    ...file,
    uploadedAt: Timestamp.fromDate(file.uploadedAt ?? new Date()),
  }));

  await updateDoc(refDoc, {
    updatedAt: now,
    qualityRecords: arrayUnion({
      id: input.id,
      createdAt,
      createdByUserId: actor?.userId ?? 'system',
      createdByRole: actor?.role ?? 'system',
      operation: input.operation,
      stage: input.stage,
      condition: input.condition,
      clientDecision: input.clientDecision ?? 'pendiente',
      cargoDescription: input.cargoDescription ?? '',
      quantity: input.quantity ?? '',
      notes: input.notes ?? '',
      attachments,
    }),
  });
};
