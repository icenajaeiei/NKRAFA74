import React from 'react';
import {
  FileText,
  Clock,
  X,
  RotateCcw
} from 'lucide-react';
import { DischargeRecord, DischargedStudentItem } from '../types';

interface SummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DischargeRecord | null;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  saveError?: string;
  onRemoveStudent: (studentId: number) => void;
  onGoToHistory?: () => void;
  onStartNewSession: () => void;
}

export const SummaryModal: React.FC<SummaryModalProps> = ({
  isOpen,
  onClose,
  record,
  onRemoveStudent,
  onStartNewSession,
}) => {
  if (!isOpen || !record) return null;

  // Group discharged students by reason
  const groupedStudents: Record<string, DischargedStudentItem[]> = {};
  record.dischargedStudents.forEach(item => {
    if (!groupedStudents[item.reason]) {
      groupedStudents[item.reason] = [];
    }
    groupedStudents[item.reason].push(item);
  });

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-emerald-600 text-white p-4 sm:p-5 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg">สรุปยอดจำหน่าย</h3>
              <p className="text-xs text-emerald-100">
                {record.period} • วันที่ {record.date} ({record.time})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-grow bg-slate-50 space-y-4">
          {/* Stats Box */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex justify-between items-center text-slate-600 text-sm">
              <span className="font-medium">ยอดเดิม</span>
              <span className="text-lg font-bold text-slate-800">
                {record.totalStudents} <span className="text-xs font-normal text-slate-500">นาย</span>
              </span>
            </div>

            <div className="flex justify-between items-start text-rose-600 font-bold border-t border-slate-100 pt-3">
              <span className="text-sm">จำหน่าย</span>
              <div className="text-right">
                <span className="text-2xl">{record.dischargedCount}</span>{' '}
                <span className="text-xs font-normal text-rose-500">นาย</span>
                {record.reasonsBreakdown && Object.keys(record.reasonsBreakdown).length > 0 && (
                  <div className="text-xs font-normal text-rose-500 mt-1.5 space-y-0.5">
                    {Object.entries(record.reasonsBreakdown).map(([reason, count]) => (
                      <div key={reason}>
                        - {reason} {count} นาย
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center text-emerald-600 font-bold border-t border-slate-100 pt-3">
              <span className="text-sm">คงแถว</span>
              <span className="text-2xl">
                {record.presentCount} <span className="text-xs font-normal text-emerald-700">นาย</span>
              </span>
            </div>
          </div>

          {/* Names List Grouped by Reason */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-slate-700 text-xs sm:text-sm">
                จำหน่าย ({record.dischargedCount} นาย):
              </h4>
              <span className="text-[11px] text-slate-400"></span>
            </div>

            {record.dischargedCount === 0 ? (
              <div className="text-center text-slate-400 py-6 bg-white rounded-xl border border-slate-200 text-xs">
                ไม่มีคนจำหน่าย
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groupedStudents).map(([reason, studentsArr]) => (
                  <div key={reason} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="bg-slate-100 px-3.5 py-2 font-bold text-slate-700 text-xs border-b border-slate-200 flex justify-between items-center">
                      <div>
                        <span className="text-slate-400 mr-1.5">▸</span>
                        {reason}
                      </div>
                      <div className="bg-white px-2 py-0.5 rounded text-indigo-700 border border-slate-200 text-[11px]">
                        {studentsArr.length} นาย
                      </div>
                    </div>
                    <div className="p-2 divide-y divide-slate-100">
                      {studentsArr.map(st => (
                        <div
                          key={st.id}
                          className="flex justify-between items-center text-xs py-1.5 px-2 hover:bg-slate-50 transition-colors rounded"
                        >
                          <span className="text-slate-700 font-medium">
                            • {st.name}
                          </span>
                          <button
                            onClick={() => onRemoveStudent(st.id)}
                            className="w-6 h-6 rounded-md bg-rose-50 hover:bg-rose-600 text-rose-500 hover:text-white flex items-center justify-center transition-colors"
                            title="ยกเลิกการจำหน่าย"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white border-t border-slate-200 flex gap-2">
          <button
            onClick={onStartNewSession}
            className="flex-1 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" />
            <span>เริ่มเช็คยอดรอบใหม่</span>
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-sm transition-colors"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
};
