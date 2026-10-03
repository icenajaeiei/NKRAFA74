import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ConflictItem } from '../types';

interface ConflictModalProps {
  isOpen: boolean;
  conflicts: ConflictItem[];
  onResolve: (resolutions: Record<number, string>) => void;
  onCancel: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  conflicts,
  onResolve,
  onCancel,
}) => {
  const [selectedResolutions, setSelectedResolutions] = useState<Record<number, string>>({});

  useEffect(() => {
    // Default select first reason for each
    const defaults: Record<number, string> = {};
    conflicts.forEach(c => {
      defaults[c.student.id] = c.reasons[0];
    });
    setSelectedResolutions(defaults);
  }, [conflicts]);

  if (!isOpen || conflicts.length === 0) return null;

  const handleSelect = (studentId: number, reason: string) => {
    setSelectedResolutions(prev => ({
      ...prev,
      [studentId]: reason
    }));
  };

  const handleConfirm = () => {
    onResolve(selectedResolutions);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-rose-600 text-white p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-amber-200" />
          </div>
          <div>
            <h3 className="font-bold text-base">พบรายชื่อซ้ำซ้อน โปรดเลือกสาเหตุเดียว</h3>
            <p className="text-xs text-rose-100">มีนักเรียน {conflicts.length} นาย ที่มีเหตุจำหน่ายมากกว่า 1 รายการ</p>
          </div>
        </div>

        <div className="p-4 overflow-y-auto flex-grow text-sm space-y-3 bg-slate-50">
          {conflicts.map((conflict, index) => {
            const currentChoice = selectedResolutions[conflict.student.id];
            return (
              <div key={conflict.student.id} className="bg-white p-3.5 rounded-xl border border-rose-100 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-slate-800 text-xs sm:text-sm">
                    • {conflict.student.name}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500">เลือกสาเหตุที่จะจำหน่ายเพียง 1 รายการ:</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {conflict.reasons.map((reason) => {
                    const isSelected = currentChoice === reason;
                    return (
                      <label
                        key={reason}
                        className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-all ${
                          isSelected
                            ? 'bg-rose-50 border-rose-400 text-rose-800 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`conflict_${conflict.student.id}`}
                          value={reason}
                          checked={isSelected}
                          onChange={() => handleSelect(conflict.student.id, reason)}
                          className="w-3.5 h-3.5 text-rose-600 focus:ring-rose-500"
                        />
                        <span className="truncate">{reason}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleConfirm}
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>ยืนยันการเลือก</span>
          </button>
        </div>
      </div>
    </div>
  );
};
