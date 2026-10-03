export interface Student {
  id: number;
  name: string;
  clubs: string[];
  department?: string;
  note?: string;
}

export interface DischargedStudentItem {
  id: number;
  name: string;
  reason: string;
  club?: string;
}

export interface DischargeRecord {
  id: string;
  date: string;         // e.g. "03 ต.ค. 2569"
  dateIso: string;      // e.g. "2026-10-03"
  time: string;         // e.g. "17:21 น."
  period: string;       // e.g. "รวมพลเช้า", "รวมพลบ่าย", "รวมพลค่ำ"
  totalStudents: number; // 142
  dischargedCount: number;
  presentCount: number;
  reasonsBreakdown: Record<string, number>;
  dischargedStudents: DischargedStudentItem[];
  notes?: string;
  recordedBy?: string;
  createdAt: string;    // ISO string
}

export interface ConflictItem {
  student: Student;
  reasons: string[];
}

export const CLUBS_LIST: string[] = [''];

export const PERIODS_LIST: string[] = [
  'รวมพลเช้า (07:30)',
  'รวมพลกลางวัน (12:00)',
  'รวมพลบ่าย (16:00)',
  'รวมพลค่ำ (20:30)',
  'แถวพิเศษ / ตรวจยอด'
];
