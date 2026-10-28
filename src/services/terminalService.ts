import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { TerminalRecord } from '../types';

const COLLECTION_NAME = 'terminals';

export async function getStoredTerminals(): Promise<TerminalRecord[]> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const list: TerminalRecord[] = [];
    snapshot.forEach((d) => {
      const data = d.data();
      list.push({
        id: d.id,
        serialNumber: String(data.serialNumber || '').trim(),
        storeId: String(data.storeId || '').trim(),
        updatedAt: data.updatedAt || undefined,
        notes: data.notes || undefined,
      });
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, COLLECTION_NAME);
  }
}

export async function saveSingleTerminal(
  terminal: Omit<TerminalRecord, 'id'> & { id?: string }
): Promise<TerminalRecord> {
  const cleanSerial = terminal.serialNumber.trim();
  const cleanStore = terminal.storeId.trim();
  const id = terminal.id || `term_${cleanSerial.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`;

  const docData = {
    serialNumber: cleanSerial,
    storeId: cleanStore,
    updatedAt: new Date().toISOString(),
    notes: terminal.notes || '',
  };

  try {
    await setDoc(doc(db, COLLECTION_NAME, id), docData);
    return {
      id,
      ...docData,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function updateTerminal(
  id: string,
  updates: { serialNumber: string; storeId: string; notes?: string }
): Promise<TerminalRecord> {
  const cleanSerial = updates.serialNumber.trim();
  const cleanStore = updates.storeId.trim();
  const docData = {
    serialNumber: cleanSerial,
    storeId: cleanStore,
    updatedAt: new Date().toISOString(),
    notes: updates.notes || '',
  };

  try {
    await setDoc(doc(db, COLLECTION_NAME, id), docData, { merge: true });
    return {
      id,
      ...docData,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function deleteTerminalById(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${id}`);
  }
}

export async function deleteMultipleTerminals(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.delete(doc(db, COLLECTION_NAME, id));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
  }
}

export async function deleteAllTerminals(): Promise<number> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION_NAME));
    const ids = snapshot.docs.map((d) => d.id);
    if (ids.length === 0) return 0;
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.delete(doc(db, COLLECTION_NAME, id));
      }
      await batch.commit();
    }
    return ids.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
  }
}

export async function batchSaveTerminals(
  terminals: Array<{ serialNumber: string; storeId: string; notes?: string }>
): Promise<TerminalRecord[]> {
  if (terminals.length === 0) return [];

  try {
    const batch = writeBatch(db);
    const savedRecords: TerminalRecord[] = [];

    // Firestore batch limit is 500 operations
    const chunks = [];
    for (let i = 0; i < terminals.length; i += 400) {
      chunks.push(terminals.slice(i, i + 400));
    }

    for (const chunk of chunks) {
      const chunkBatch = writeBatch(db);
      for (const item of chunk) {
        const cleanSerial = String(item.serialNumber).trim();
        const cleanStore = String(item.storeId).trim();
        if (!cleanSerial || !cleanStore) continue;

        const safeId = `t_${cleanSerial.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        const docRef = doc(db, COLLECTION_NAME, safeId);
        const data = {
          serialNumber: cleanSerial,
          storeId: cleanStore,
          updatedAt: new Date().toISOString(),
          notes: item.notes || 'Importado desde catálogo Excel',
        };
        chunkBatch.set(docRef, data);
        savedRecords.push({ id: safeId, ...data });
      }
      await chunkBatch.commit();
    }

    return savedRecords;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
  }
}

export const SAMPLE_TERMINALS = [
  { serialNumber: 'SN-POS-8001', storeId: 'STR-010' },
  { serialNumber: 'SN-POS-8002', storeId: 'STR-010' },
  { serialNumber: 'SN-POS-8003', storeId: 'STR-020' },
  { serialNumber: 'SN-POS-8004', storeId: 'STR-020' },
  { serialNumber: 'SN-POS-8005', storeId: 'STR-030' },
  { serialNumber: 'SN-POS-8006', storeId: 'STR-040' },
  { serialNumber: 'SN-POS-8007', storeId: 'STR-050' },
  { serialNumber: 'SN-POS-8008', storeId: 'STR-050' },
];
