import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { DischargeRecord, DischargedStudentItem } from '../types';

const COLLECTION_NAME = 'discharge_records';
const LOCAL_STORAGE_KEY = 'v1_discharge_records_cache';

export function getCachedRecords(): DischargeRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading localStorage cache:', e);
    return [];
  }
}

export function saveToLocalCache(records: DischargeRecord[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error writing to localStorage cache:', e);
  }
}

/**
 * Automatically saves the discharge record to Firestore database
 * and updates local cache.
 */
export async function autoSaveDischargeRecord(record: DischargeRecord): Promise<{ success: boolean; id: string; error?: string }> {
  try {
    // 1. Immediately backup in local cache
    const current = getCachedRecords();
    const updated = [record, ...current.filter(r => r.id !== record.id)];
    saveToLocalCache(updated);

    // 2. Persist to Firestore
    const docRef = doc(db, COLLECTION_NAME, record.id);
    await setDoc(docRef, record);
    return { success: true, id: record.id };
  } catch (error) {
    console.error('Failed to save record to Firestore, preserved in local cache:', error);
    try {
      handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${record.id}`);
    } catch {
      // Continue so UI can still notify the user
    }
    return {
      success: false,
      id: record.id,
      error: error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล'
    };
  }
}

/**
 * Deletes a record from Firestore and local cache
 */
export async function deleteRecordFromDb(recordId: string): Promise<boolean> {
  try {
    // Update local cache
    const current = getCachedRecords();
    const updated = current.filter(r => r.id !== recordId);
    saveToLocalCache(updated);

    // Delete from Firestore
    const docRef = doc(db, COLLECTION_NAME, recordId);
    await deleteDoc(docRef);
    return true;
  } catch (error) {
    console.error('Failed to delete from Firestore:', error);
    try {
      handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${recordId}`);
    } catch {
      // ignore
    }
    return false;
  }
}

/**
 * Subscribes to live updates from Firestore
 */
export function subscribeToRecords(onUpdate: (records: DischargeRecord[]) => void): () => void {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const records: DischargeRecord[] = [];
        snapshot.forEach((doc) => {
          records.push(doc.data() as DischargeRecord);
        });
        saveToLocalCache(records);
        onUpdate(records);
      },
      (error) => {
        console.warn('Snapshot listener encountered an error, falling back to local cache:', error);
        try {
          handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
        } catch {
          // ignore
        }
        // Fallback to cache on error
        onUpdate(getCachedRecords());
      }
    );

    return unsubscribe;
  } catch (err) {
    console.warn('Could not establish real-time listener, using local cache:', err);
    onUpdate(getCachedRecords());
    return () => {};
  }
}

/**
 * Fetch records once (fallback or manual refresh)
 */
export async function fetchAllRecordsOnce(): Promise<DischargeRecord[]> {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const records: DischargeRecord[] = [];
    snapshot.forEach((doc) => {
      records.push(doc.data() as DischargeRecord);
    });
    saveToLocalCache(records);
    return records;
  } catch (error) {
    console.warn('Failed to fetch from Firestore, returning cached records:', error);
    return getCachedRecords();
  }
}

/**
 * Helper to generate human-readable Thai summary text (for LINE / messaging)
 */
export function generateLineSummaryText(record: DischargeRecord): string {
  const lines: string[] = [];
  lines.push(`📋 รายงานยอดจำหน่าย ${record.period || 'ประจำวัน'}`);
  lines.push(`📅 วันที่: ${record.date} เวลา ${record.time}`);
  lines.push(`────────────────────`);
  lines.push(`🔹 ยอดเดิม: ${record.totalStudents} นาย`);
  lines.push(`🔻 ยอดจำหน่าย: ${record.dischargedCount} นาย`);

  if (record.reasonsBreakdown && Object.keys(record.reasonsBreakdown).length > 0) {
    Object.entries(record.reasonsBreakdown).forEach(([reason, count]) => {
      lines.push(`   • ${reason}: ${count} นาย`);
    });
  }

  lines.push(`✅ คงแถว: ${record.presentCount} นาย`);

  if (record.dischargedStudents && record.dischargedStudents.length > 0) {
    lines.push(`────────────────────`);
    lines.push(`📌 รายชื่อจำหน่าย (${record.dischargedCount} นาย):`);

    // Group by reason
    const grouped: Record<string, DischargedStudentItem[]> = {};
    record.dischargedStudents.forEach(item => {
      if (!grouped[item.reason]) grouped[item.reason] = [];
      grouped[item.reason].push(item);
    });

    Object.entries(grouped).forEach(([reason, students]) => {
      lines.push(`\n[${reason}] (${students.length} นาย):`);
      students.forEach((s, idx) => {
        lines.push(` ${idx + 1}. ${s.name}`);
      });
    });
  }

  if (record.notes) {
    lines.push(`────────────────────`);
    lines.push(`📝 หมายเหตุ: ${record.notes}`);
  }

  lines.push(`────────────────────`);
  lines.push(`ระบบจำหน่าย V1 • บันทึกอัตโนมัติ`);

  return lines.join('\n');
}
