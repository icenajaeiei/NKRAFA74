import React, { useState } from 'react';
import { Users, X, Search, Check, RefreshCw, ExternalLink, FileSpreadsheet, Sparkles } from 'lucide-react';
import { Student, CLUBS_LIST } from '../types';
import { SPREADSHEET_URL } from '../services/sheetService';

interface StudentManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  students: Student[];
  onUpdateStudents: (updated: Student[]) => void;
  availableClubs: string[];
  lastSyncTime?: string;
  isSyncing: boolean;
  onManualSync: () => void;
  matchedSheetCount?: number;
}

export const StudentManagerModal: React.FC<StudentManagerModalProps> = ({
  isOpen,
  onClose,
  students,
  onUpdateStudents,
  availableClubs,
  lastSyncTime,
  isSyncing,
  onManualSync,
  matchedSheetCount = 0,
}) => {
  const [search, setSearch] = useState('');
  const [selectedClubFilter, setSelectedClubFilter] = useState<string>('all');
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);

  if (!isOpen) return null;

  const clubsToDisplay = availableClubs.length > 0 ? availableClubs : CLUBS_LIST;

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) || s.id.toString().includes(search);
    if (selectedClubFilter === 'all') return matchesSearch;
    if (selectedClubFilter === 'none') return matchesSearch && (!s.clubs || s.clubs.length === 0);
    return matchesSearch && s.clubs && s.clubs.includes(selectedClubFilter);
  });

  const toggleStudentClub = (studentId: number, club: string) => {
    const updated = students.map(s => {
      if (s.id !== studentId) return s;
      const currentClubs = s.clubs || [];
      const hasClub = currentClubs.includes(club);
      const newClubs = hasClub
        ? currentClubs.filter(c => c !== club)
        : [...currentClubs, club];
      return { ...s, clubs: newClubs };
    });
    onUpdateStudents(updated);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="bg-indigo-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-800 flex items-center justify-center text-indigo-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base">จัดการชมรมและรายชื่อ</h3>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                  Google Sheets Live
                </span>
              </div>
              <p className="text-xs text-indigo-200">
                ข้อมูลชมรมซิงก์จาก Google Docs Spreadsheet อัตโนมัติ (แก้ไขไฟล์ได้ตลอด)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-indigo-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Google Sheets Sync Status Bar */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-emerald-900">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>ซิงก์จาก Google Sheets:</strong> พบข้อมูลชมรม {matchedSheetCount}/{students.length} นาย
              {lastSyncTime && <span className="text-emerald-700 ml-1.5 font-normal">(อัปเดตล่าสุด: {lastSyncTime})</span>}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'กำลังซิงก์...' : 'ซิงก์ข้อมูลตอนนี้'}</span>
            </button>

            <a
              href={SPREADSHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
              title="เปิดดูหรือแก้ไข Google Spreadsheet"
            >
              <ExternalLink className="w-3 h-3" />
              <span>เปิดไฟล์ Google Sheets</span>
            </a>
          </div>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap gap-3 items-center justify-between">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ"
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Club filter pills */}
        <div className="px-4 py-2 bg-white border-b border-slate-100 flex items-center gap-1.5 overflow-x-auto text-xs">
          <span className="text-slate-400 text-[11px] shrink-0">กรองตาม:</span>
          <button
            onClick={() => setSelectedClubFilter('all')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition-colors ${
              selectedClubFilter === 'all'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ทั้งหมด ({students.length})
          </button>
          <button
            onClick={() => setSelectedClubFilter('none')}
            className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition-colors ${
              selectedClubFilter === 'none'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ยังไม่มีชมรม ({students.filter(s => !s.clubs || s.clubs.length === 0).length})
          </button>
          {clubsToDisplay.map(club => {
            const count = students.filter(s => s.clubs?.includes(club)).length;
            return (
              <button
                key={club}
                onClick={() => setSelectedClubFilter(club)}
                className={`px-2.5 py-1 rounded-lg shrink-0 font-medium transition-colors ${
                  selectedClubFilter === club
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {club} ({count})
              </button>
            );
          })}
        </div>

        {/* List of students */}
        <div className="p-4 overflow-y-auto flex-grow divide-y divide-slate-100 bg-slate-50/50">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-sm">ไม่เจอชื่อที่ตรงกับเงื่อนไข</div>
          ) : (
            filteredStudents.map(student => {
              const isEditing = editingStudentId === student.id;
              return (
                <div key={student.id} className="py-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs flex items-center justify-center border border-indigo-100">
                        {student.id}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-slate-800">{student.name}</p>
                        <p className="text-[10px] text-slate-500">
                          ชมรม:{' '}
                          <span className="font-medium text-indigo-600">
                            {student.clubs && student.clubs.length > 0 ? student.clubs.join(', ') : 'ยังไม่มีชมรม'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => setEditingStudentId(isEditing ? null : student.id)}
                      className="px-2.5 py-1 text-[11px] font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                    >
                      {isEditing ? 'เสร็จสิ้น' : 'แก้ไขชมรม'}
                    </button>
                  </div>

                  {/* Club picker badges */}
                  {isEditing && (
                    <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-sm mt-1 animate-in fade-in duration-100">
                      <p className="text-[11px] font-semibold text-slate-600 mb-2">คลิกเพื่อเลือก/ยกเลิกชมรม:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {clubsToDisplay.map(club => {
                          const isAssigned = student.clubs?.includes(club);
                          return (
                            <button
                              key={club}
                              type="button"
                              onClick={() => toggleStudentClub(student.id, club)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                                isAssigned
                                  ? 'bg-indigo-600 text-white shadow-sm'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {isAssigned && <Check className="w-3 h-3" />}
                              <span>{club}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-slate-200 flex justify-between items-center">
          <p className="text-xs text-slate-400">
            * หากแก้ไขข้อมูลใน Google Sheets ข้อมูลจะอัปเดตให้อัตโนมัติ
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};

