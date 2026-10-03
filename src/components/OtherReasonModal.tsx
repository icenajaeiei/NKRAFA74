import React, { useState, useEffect } from 'react';
import { PenSquare, Sparkles, Check } from 'lucide-react';
import { Student } from '../types';

interface OtherReasonModalProps {
  isOpen: boolean;
  studentIds: number[];
  students: Student[];
  onSubmit: (reasons: Record<number, string>) => void;
  onCancel: () => void;
}

const COMMON_REASONS = ['เข้าเวร', 'กักตัว','ปากเปล่า'];

export const OtherReasonModal: React.FC<OtherReasonModalProps> = ({
  isOpen,
  studentIds,
  students,
  onSubmit,
  onCancel,
}) => {
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, boolean>>({});
  const [customAllReason, setCustomAllReason] = useState<string>('');

  useEffect(() => {
    const init: Record<number, string> = {};
    studentIds.forEach(id => {
      init[id] = '';
    });
    setReasons(init);
    setErrors({});
    setCustomAllReason('');
  }, [studentIds, isOpen]);

  if (!isOpen || studentIds.length === 0) return null;

  const handleInputChange = (id: number, val: string) => {
    setReasons(prev => ({ ...prev, [id]: val }));
    if (val.trim()) {
      setErrors(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleApplyPreset = (id: number, preset: string) => {
    handleInputChange(id, preset);
  };

  const handleApplyToAll = (preset: string) => {
    const updated: Record<number, string> = {};
    studentIds.forEach(id => {
      updated[id] = preset;
    });
    setReasons(updated);
    setErrors({});
  };

  const handleSubmit = () => {
    const newErrors: Record<number, boolean> = {};
    let hasError = false;

    studentIds.forEach(id => {
      const val = reasons[id]?.trim();
      if (!val) {
        newErrors[id] = true;
        hasError = true;
      }
    });

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    onSubmit(reasons);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-amber-500 text-white p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <PenSquare className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-base">สาเหตุจำหน่าย (เขียนเอง)</h3>
            <p className="text-xs text-amber-100">มี {studentIds.length} นายที่ต้องกรอก</p>
          </div>
        </div>

        {/* Tip */}
        <div className="p-3 bg-amber-50 text-amber-900 text-xs border-b border-amber-200 flex items-center justify-between">
          <span>จำหน่ายเหมือนกัน พิมพ์ให้เหมือนกัน</span>
        </div>

        {/* Quick fill buttons */}
        <div className="px-4 py-2.5 bg-slate-100/70 border-b border-slate-200">
          <p className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            ใส่ให้ทุกคน:
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {COMMON_REASONS.map(r => (
              <button
                key={r}
                type="button"
                onClick={() => handleApplyToAll(r)}
                className="text-[11px] px-2.5 py-1 bg-white hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-slate-200 rounded-lg transition-colors font-medium shadow-xs"
              >
                {r}
              </button>
            ))}

            <div className="inline-flex items-center gap-1">
              <input
                type="text"
                value={customAllReason}
                onChange={(e) => setCustomAllReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && customAllReason.trim()) {
                    e.preventDefault();
                    handleApplyToAll(customAllReason.trim());
                  }
                }}
                placeholder="พิมพ์ใส่ทุกคน..."
                className="text-[11px] px-2.5 py-1 bg-white border border-slate-300 focus:border-amber-500 rounded-lg outline-none w-28 text-slate-700 placeholder:text-slate-400 shadow-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (customAllReason.trim()) {
                    handleApplyToAll(customAllReason.trim());
                  }
                }}
                disabled={!customAllReason.trim()}
                className="text-[11px] px-2.5 py-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white rounded-lg transition-colors font-medium cursor-pointer disabled:cursor-not-allowed shadow-xs"
              >
                ใส่
              </button>
            </div>
          </div>
        </div>

        {/* Input list */}
        <div className="p-4 overflow-y-auto flex-grow text-sm space-y-3 bg-slate-50">
          {studentIds.map(id => {
            const student = students.find(s => s.id === id);
            const isError = errors[id];
            return (
              <div
                key={id}
                className={`bg-white p-3.5 rounded-xl border transition-all shadow-sm ${
                  isError ? 'border-rose-400 bg-rose-50/40' : 'border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-bold text-slate-800 text-xs sm:text-sm">
                    {student ? student.name : ''}
                  </label>
                </div>

                <input
                  type="text"
                  value={reasons[id] || ''}
                  onChange={(e) => handleInputChange(id, e.target.value)}
                  placeholder="พิมพ์"
                  className={`w-full border rounded-lg px-3 py-2 text-xs sm:text-sm outline-none transition-colors ${
                    isError
                      ? 'border-rose-500 bg-rose-50 text-rose-900 focus:ring-1 focus:ring-rose-500'
                      : 'border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500'
                  }`}
                />

                {/* Individual presets */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {COMMON_REASONS.slice(0, 4).map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleApplyPreset(id, preset)}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    >
                      +{preset}
                    </button>
                  ))}
                </div>

                {isError && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">ใส่สาเหตุไอนี่ด้วย</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-sm font-medium transition-colors"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold shadow-md transition-colors flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>สรุปยอด</span>
          </button>
        </div>
      </div>
    </div>
  );
};
