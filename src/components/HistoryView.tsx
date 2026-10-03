import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  Search,
  Trash2,
  Users,
  Filter,
  RefreshCw,
  Eye,
  AlertCircle
} from 'lucide-react';
import { DischargeRecord } from '../types';
import { deleteRecordFromDb } from '../services/recordService';

interface HistoryViewProps {
  records: DischargeRecord[];
  onRefresh: () => void;
  isLoading: boolean;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ records, onRefresh, isLoading }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<'all' | 'today' | 'yesterday' | 'week'>('all');
  const [activeRecord, setActiveRecord] = useState<DischargeRecord | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered records
  const filteredRecords = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];

    return records.filter(r => {
      // Date filter
      if (selectedDateFilter === 'today' && r.dateIso !== todayStr) return false;
      if (selectedDateFilter === 'yesterday' && r.dateIso !== yesterday) return false;
      if (selectedDateFilter === 'week' && r.dateIso < oneWeekAgo) return false;

      // Text query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesDate = r.date.toLowerCase().includes(q) || r.time.toLowerCase().includes(q);
        const matchesPeriod = r.period.toLowerCase().includes(q);
        const matchesNotes = r.notes ? r.notes.toLowerCase().includes(q) : false;
        const matchesStudent = r.dischargedStudents.some(s => s.name.toLowerCase().includes(q) || s.reason.toLowerCase().includes(q));
        return matchesDate || matchesPeriod || matchesNotes || matchesStudent;
      }

      return true;
    });
  }, [records, selectedDateFilter, searchQuery]);

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    await deleteRecordFromDb(id);
    setIsDeleting(false);
    setDeleteConfirmId(null);
    if (activeRecord?.id === id) {
      setActiveRecord(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter and Action Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาตามวันที่ ช่วงเวลา ชื่อนักเรียน สาเหตุ..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
          />
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start md:self-auto overflow-x-auto">
          <button
            onClick={() => setSelectedDateFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedDateFilter === 'all'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ทั้งหมด
          </button>
          <button
            onClick={() => setSelectedDateFilter('today')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedDateFilter === 'today'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            วันนี้
          </button>
          <button
            onClick={() => setSelectedDateFilter('yesterday')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedDateFilter === 'yesterday'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            เมื่อวาน
          </button>
          <button
            onClick={() => setSelectedDateFilter('week')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              selectedDateFilter === 'week'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            7 วันล่าสุด
          </button>
        </div>

        {/* Refresh Action */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            title="รีเฟรชข้อมูล"
            className="p-2.5 text-slate-600 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Records List */}
      {filteredRecords.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Clock className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-700 mb-1">ยังไม่มีประวัติเช็คยอด</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto"></p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredRecords.map((record) => {
            const hasDischarge = record.dischargedCount > 0;
            return (
              <div
                key={record.id}
                className="bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all p-5 flex flex-col justify-between group"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 mb-1.5">
                        {record.period || 'ตรวจยอด'}
                      </span>
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {record.date}
                      </h4>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-400" />
                        เวลา {record.time}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">คงแถว</span>
                      <span className="text-lg font-bold text-emerald-600">{record.presentCount} <span className="text-xs font-normal">นาย</span></span>
                    </div>
                  </div>

                  {/* Summary Bar */}
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 mb-3 text-xs space-y-1.5">
                    <div className="flex justify-between text-slate-600">
                      <span>ยอดเดิม:</span>
                      <span className="font-semibold text-slate-800">{record.totalStudents} นาย</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>จำหน่าย:</span>
                      <span className="font-bold">{record.dischargedCount} นาย</span>
                    </div>
                    {record.reasonsBreakdown && Object.keys(record.reasonsBreakdown).length > 0 && (
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1">
                        {Object.entries(record.reasonsBreakdown).map(([reason, count]) => (
                          <span
                            key={reason}
                            className="bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px] text-slate-600 font-medium"
                          >
                            {reason}: <span className="text-indigo-600 font-bold">{count}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Discharged Names Preview (Up to 3) */}
                  {hasDischarge && (
                    <div className="mb-4">
                      <p className="text-[11px] font-medium text-slate-500 mb-1">รายชื่อจำหน่าย:</p>
                      <div className="space-y-1">
                        {record.dischargedStudents.slice(0, 3).map((s, idx) => (
                          <div key={idx} className="flex justify-between text-xs text-slate-700 bg-white py-0.5">
                            <span className="truncate max-w-[170px]">• {s.name}</span>
                            <span className="text-slate-400 text-[11px] ml-2 shrink-0">({s.reason})</span>
                          </div>
                        ))}
                        {record.dischargedStudents.length > 3 && (
                          <p className="text-[11px] text-indigo-600 font-medium">
                            + อีก {record.dischargedStudents.length - 3} นาย...
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setActiveRecord(record)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-xl transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>ดูรายละเอียด</span>
                  </button>

                  <button
                    onClick={() => setDeleteConfirmId(record.id)}
                    title="ลบประวัตินี้"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Full Record Details */}
      {activeRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-indigo-900 text-white p-5 flex items-start justify-between">
              <div>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-800 text-amber-300 border border-indigo-700 mb-1.5">
                  {activeRecord.period}
                </span>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-300" />
                  วันที่ {activeRecord.date}
                </h3>
                <p className="text-xs text-indigo-200 flex items-center gap-1.5 mt-0.5">
                  <Clock className="w-3.5 h-3.5" /> เวลา {activeRecord.time}
                </p>
              </div>
              <button
                onClick={() => setActiveRecord(null)}
                className="text-white/70 hover:text-white p-1 rounded-lg hover:bg-indigo-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-grow space-y-5 bg-slate-50">
              {/* Quick Numbers */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 text-center shadow-sm">
                  <span className="text-xs text-slate-500 block">ยอดเดิม</span>
                  <span className="text-xl font-bold text-slate-800">{activeRecord.totalStudents}</span>
                  <span className="text-[10px] text-slate-400 block">นาย</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-rose-200 text-center shadow-sm">
                  <span className="text-xs text-rose-500 block">จำหน่าย</span>
                  <span className="text-xl font-bold text-rose-600">{activeRecord.dischargedCount}</span>
                  <span className="text-[10px] text-rose-400 block">นาย</span>
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-emerald-200 text-center shadow-sm">
                  <span className="text-xs text-emerald-500 block">คงแถว</span>
                  <span className="text-xl font-bold text-emerald-600">{activeRecord.presentCount}</span>
                  <span className="text-[10px] text-emerald-400 block">นาย</span>
                </div>
              </div>

              {/* Grouped Breakdown by Reason */}
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-3 flex items-center justify-between">
                  <span>ผู้ถูกจำหน่ายทั้งหมด ({activeRecord.dischargedCount} นาย)</span>
                  <span className="text-xs font-normal text-slate-500">
                    {Object.keys(activeRecord.reasonsBreakdown || {}).length} สาเหตุ
                  </span>
                </h4>

                {activeRecord.dischargedCount === 0 ? (
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs p-4 rounded-xl text-center">
                    ไม่มีการจำหน่าย ยอดครบ 100%
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Render grouped by reason */}
                    {Object.entries(
                      activeRecord.dischargedStudents.reduce((acc, st) => {
                        if (!acc[st.reason]) acc[st.reason] = [];
                        acc[st.reason].push(st);
                        return acc;
                      }, {} as Record<string, typeof activeRecord.dischargedStudents>)
                    ).map(([reason, students]) => (
                      <div key={reason} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="bg-slate-100/80 px-4 py-2 text-xs font-bold text-slate-700 border-b border-slate-200 flex justify-between items-center">
                          <span>{reason}</span>
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold">
                            {students.length} นาย
                          </span>
                        </div>
                        <div className="p-3 divide-y divide-slate-100">
                          {students.map((st) => (
                            <div key={st.id} className="py-1.5 flex items-center justify-between text-xs">
                              <span className="font-medium text-slate-700">• {st.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {activeRecord.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900">
                  <span className="font-bold block mb-1">หมายเหตุ:</span>
                  {activeRecord.notes}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-white border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setActiveRecord(null)}
                className="w-full sm:w-auto py-2.5 px-6 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-medium text-sm transition-colors"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full rounded-2xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-base">จะลบจริงอ้ะ??</h4>
              <p className="text-xs text-slate-500 mt-1">
                ลบแล้วหายเลยนะ
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-700 transition-colors"
              >
                {isDeleting ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
