/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ClipboardCheck,
  Calculator,
  RotateCcw,
  Search,
  Users,
  History,
  Settings2,
  CheckCircle,
  Database,
  Calendar,
  Clock,
  Sparkles,
  ShieldCheck,
  ArrowRight,
  FileSpreadsheet,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { INITIAL_STUDENTS } from './data/students';
import { Student, DischargeRecord, ConflictItem, CLUBS_LIST } from './types';
import {
  autoSaveDischargeRecord,
  subscribeToRecords,
  getCachedRecords
} from './services/recordService';
import {
  fetchGoogleSheetCSV,
  parseSheetCSV,
  applySheetToStudents,
  saveSheetCache,
  getSheetCache,
  SPREADSHEET_URL
} from './services/sheetService';
import { testConnection } from './firebase';
import { ConflictModal } from './components/ConflictModal';
import { OtherReasonModal } from './components/OtherReasonModal';
import { SummaryModal } from './components/SummaryModal';
import { HistoryView } from './components/HistoryView';
import { StudentManagerModal } from './components/StudentManagerModal';
import cadetLogo from './assets/images/air_cadet_logo_1791024624891.jpg';

const STUDENTS_STORAGE_KEY = 'v1_students_roster_cache';

// 10 students who are always discharged with 'เรียนภาษา' on summary
const isLanguageStudent = (student: Student) => {
  const n = student.name;
  return (
    [18, 12, 46, 33, 8, 11, 35, 25, 28, 24].includes(student.id) ||
    n.startsWith('ฑศพล') ||
    n.startsWith('พลพจ') ||
    n.startsWith('พัทธกิตติ์') ||
    n.startsWith('ปกรณ์') ||
    n.startsWith('ปวเรศ') ||
    n.startsWith('ภูดิท') ||
    (n.includes('ชิษณุพงศ์') && n.includes('คุณประเสริฐ')) ||
    n.startsWith('พาย ') ||
    n === 'พาย' ||
    n.startsWith('อธิษฐ์') ||
    n.startsWith('อธิศฐ์') ||
    n.startsWith('เตชิน')
  );
};

export default function App() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<'check' | 'history'>('check');

  // Students roster (starts from 142 students, customizable via local storage)
  const [students, setStudents] = useState<Student[]>(() => {
    try {
      const saved = localStorage.getItem(STUDENTS_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return INITIAL_STUDENTS;
  });

  // Google Sheets integration state
  const [availableClubs, setAvailableClubs] = useState<string[]>(CLUBS_LIST);
  const [isSyncingSheet, setIsSyncingSheet] = useState<boolean>(false);
  const [lastSheetSyncTime, setLastSheetSyncTime] = useState<string>('');
  const [matchedSheetCount, setMatchedSheetCount] = useState<number>(0);
  const [sheetSyncError, setSheetSyncError] = useState<string | null>(null);

  // Roll call selection states
  const [selectedClubs, setSelectedClubs] = useState<string[]>([]);
  // Map of studentId -> 'แผนก' | 'เวร' | 'เขียนเอง'
  const [individualSelections, setIndividualSelections] = useState<Record<number, string>>({});
  const [individualSearch, setIndividualSearch] = useState<string>('');

  // Workflow states
  const [conflicts, setConflicts] = useState<ConflictItem[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState<boolean>(false);

  const [pendingOtherStudentIds, setPendingOtherStudentIds] = useState<number[]>([]);
  const [isOtherReasonModalOpen, setIsOtherReasonModalOpen] = useState<boolean>(false);

  // Resolved final discharge map: studentId -> reason
  const [draftDischarges, setDraftDischarges] = useState<Record<number, string>>({});

  // Summary & Auto-Save state
  const [currentSummaryRecord, setCurrentSummaryRecord] = useState<DischargeRecord | null>(null);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | undefined>();

  // Database Records & Sync state
  const [records, setRecords] = useState<DischargeRecord[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState<boolean>(true);
  const [isDbConnected, setIsDbConnected] = useState<boolean>(true);

  // Student Manager Modal
  const [isStudentManagerOpen, setIsStudentManagerOpen] = useState<boolean>(false);

  /**
   * Synchronize clubs and student assignments directly from Google Sheets
   */
  const syncGoogleSheet = useCallback(async (isManual = false) => {
    setIsSyncingSheet(true);
    setSheetSyncError(null);

    try {
      const csvText = await fetchGoogleSheetCSV();
      if (!csvText || csvText.trim().length === 0) {
        throw new Error('Google Sheet data is empty');
      }

      const rows = parseSheetCSV(csvText);
      const { updatedStudents, matchedCount, clubsFound } = applySheetToStudents(INITIAL_STUDENTS, rows);

      setStudents(updatedStudents);
      setMatchedSheetCount(matchedCount);

      // Save to localStorage
      try {
        localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updatedStudents));
        saveSheetCache(csvText);
      } catch (err) {
        console.error(err);
      }

      // Merge dynamic clubs found in Google Sheet with standard clubs
      const mergedClubs = Array.from(new Set([...clubsFound, ...CLUBS_LIST])).filter(Boolean);
      setAvailableClubs(mergedClubs);

      const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';
      setLastSheetSyncTime(timeStr);
    } catch (err) {
      console.warn('Google Sheet sync notice:', err);
      setSheetSyncError(err instanceof Error ? err.message : 'ไม่สามารถดึงข้อมูลจาก Google Sheets ได้');
    } finally {
      setIsSyncingSheet(false);
    }
  }, []);

  // Test connection & Subscribe to database on mount, and init Google Sheets
  useEffect(() => {
    testConnection().then(connected => {
      setIsDbConnected(connected);
    });

    // 1. Initial cached records
    setRecords(getCachedRecords());

    // 2. Initial cached Google Sheet data if available
    const cache = getSheetCache();
    if (cache.csv) {
      try {
        const rows = parseSheetCSV(cache.csv);
        const { updatedStudents, matchedCount, clubsFound } = applySheetToStudents(INITIAL_STUDENTS, rows);
        setStudents(updatedStudents);
        setMatchedSheetCount(matchedCount);
        const mergedClubs = Array.from(new Set([...clubsFound, ...CLUBS_LIST])).filter(Boolean);
        setAvailableClubs(mergedClubs);
        if (cache.lastSync) {
          const d = new Date(cache.lastSync);
          setLastSheetSyncTime(d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.');
        }
      } catch {
        // ignore
      }
    }

    // 3. Fetch fresh Google Sheet data immediately
    syncGoogleSheet();

    // 4. Background auto-sync every 45 seconds to keep up-to-date with Google Sheet edits
    const sheetSyncInterval = setInterval(() => {
      syncGoogleSheet();
    }, 45000);

    // 5. Auto-sync on window focus / tab visibility change
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncGoogleSheet();
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // 6. Subscribe to real-time updates from Firestore
    const unsubscribe = subscribeToRecords((updatedRecords) => {
      setRecords(updatedRecords);
      setIsLoadingRecords(false);
    });

    return () => {
      clearInterval(sheetSyncInterval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      unsubscribe();
    };
  }, [syncGoogleSheet]);

  // Save student roster changes to local storage
  const handleUpdateStudents = (updated: Student[]) => {
    setStudents(updated);
    try {
      localStorage.setItem(STUDENTS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  // Club checkbox toggle
  const toggleClub = (club: string) => {
    setSelectedClubs(prev =>
      prev.includes(club) ? prev.filter(c => c !== club) : [...prev, club]
    );
  };

  // Individual radio-like checkbox select
  const handleIndividualCheck = (studentId: number, reason: string) => {
    setIndividualSelections(prev => {
      if (prev[studentId] === reason) {
        // Uncheck if clicked again
        const copy = { ...prev };
        delete copy[studentId];
        return copy;
      }
      return {
        ...prev,
        [studentId]: reason
      };
    });
  };

  // Clear single student's selection
  const clearSingleStudent = (studentId: number) => {
    setIndividualSelections(prev => {
      const copy = { ...prev };
      delete copy[studentId];
      return copy;
    });
  };

  // Clear all selections
  const handleClearAllSelections = () => {
    setSelectedClubs([]);
    setIndividualSelections({});
  };

  // Filtered student list for individual section
  const filteredStudents = useMemo(() => {
    const q = individualSearch.trim().toLowerCase();
    const sorted = [...students].sort((a, b) => a.id - b.id);
    if (!q) return sorted;
    return sorted.filter(
      s => s.name.toLowerCase().includes(q) || s.id.toString().includes(q)
    );
  }, [students, individualSearch]);

  // Count currently selected students (approximate before resolving conflicts)
  const tentativeDischargeCount = useMemo(() => {
    const selectedIds = new Set<number>();
    selectedClubs.forEach(club => {
      students
        .filter(s => s.clubs?.includes(club))
        .forEach(s => selectedIds.add(s.id));
    });
    Object.keys(individualSelections).forEach(id => {
      selectedIds.add(Number(id));
    });
    return selectedIds.size;
  }, [selectedClubs, individualSelections, students]);

  // Step 1: Start the summary calculation process
  const processSummary = () => {
    const checkedIndIds = Object.keys(individualSelections).map(Number);
    const draftMap = new Map<number, Set<string>>();

    // 1. Process Clubs
    selectedClubs.forEach(club => {
      const studentsInClub = students.filter(s => s.clubs?.includes(club));
      studentsInClub.forEach(s => {
        if (!draftMap.has(s.id)) draftMap.set(s.id, new Set());
        draftMap.get(s.id)!.add(club);
      });
    });

    // 2. Process Individuals
    checkedIndIds.forEach(id => {
      const reason = individualSelections[id];
      if (reason) {
        if (!draftMap.has(id)) draftMap.set(id, new Set());
        draftMap.get(id)!.add(reason);
      }
    });

    // 3. Always discharge the 10 language students with 'เรียนภาษา'
    students.filter(isLanguageStudent).forEach(s => {
      if (!draftMap.has(s.id)) {
        draftMap.set(s.id, new Set(['เรียนภาษา']));
      } else {
        draftMap.get(s.id)!.add('เรียนภาษา');
      }
    });

    if (draftMap.size === 0) {
      alert('ไม่มีรายชื่อที่ถูกจำหน่าย');
      return;
    }

    // 3. Detect conflicts
    const autoResolve: Record<number, string> = {};
    const conflictList: ConflictItem[] = [];

    draftMap.forEach((reasonsSet, studentId) => {
      const reasonsArr = Array.from(reasonsSet);
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      if (reasonsArr.length === 1) {
        autoResolve[studentId] = reasonsArr[0];
      } else if (reasonsArr.length > 1) {
        conflictList.push({ student, reasons: reasonsArr });
      }
    });

    if (conflictList.length > 0) {
      setDraftDischarges(autoResolve);
      setConflicts(conflictList);
      setIsConflictModalOpen(true);
    } else {
      setDraftDischarges(autoResolve);
      checkIfOtherReasonNeeded(autoResolve);
    }
  };

  // Step 2: Resolve conflicts
  const handleResolveConflicts = (resolutions: Record<number, string>) => {
    const merged = { ...draftDischarges, ...resolutions };
    setDraftDischarges(merged);
    setIsConflictModalOpen(false);
    checkIfOtherReasonNeeded(merged);
  };

  // Step 3: Check if custom reason modal is needed for "เขียนเอง"
  const checkIfOtherReasonNeeded = (currentDischarges: Record<number, string>) => {
    const needsReasonIds = Object.keys(currentDischarges)
      .map(Number)
      .filter(id => currentDischarges[id] === 'เขียนเอง');

    if (needsReasonIds.length > 0) {
      setPendingOtherStudentIds(needsReasonIds);
      setIsOtherReasonModalOpen(true);
    } else {
      finalizeAndAutoSave(currentDischarges);
    }
  };

  // Step 4: Submit custom other reasons
  const handleSubmitOtherReasons = (reasons: Record<number, string>) => {
    const merged = { ...draftDischarges, ...reasons };
    setDraftDischarges(merged);
    setIsOtherReasonModalOpen(false);
    finalizeAndAutoSave(merged);
  };

  // Step 5: Finalize record, generate summary, and AUTOMATICALLY SAVE TO DATABASE
  const finalizeAndAutoSave = async (finalMap: Record<number, string>) => {
    const now = new Date();
    const thaiDate = now.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const thaiTime = now.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    }) + ' น.';
    const dateIso = now.toISOString().split('T')[0];

    const dischargedList: { id: number; name: string; reason: string }[] = [];
    const breakdown: Record<string, number> = {};

    for (const [idStr, reason] of Object.entries(finalMap)) {
      const studentId = Number(idStr);
      const student = students.find(s => s.id === studentId);
      if (student) {
        dischargedList.push({
          id: student.id,
          name: student.name,
          reason,
        });
        breakdown[reason] = (breakdown[reason] || 0) + 1;
      }
    }

    const dischargedCount = dischargedList.length;
    const totalStudents = students.length;
    const presentCount = totalStudents - dischargedCount;
    const nextSessionNumber = records.length + 1;
    const periodName = `ครั้งที่ ${nextSessionNumber}`;

    // Unique ID for the record: YYYYMMDD-HHMMSS-random
    const id = `REC-${Date.now().toString().slice(-8)}`;

    const newRecord: DischargeRecord = {
      id,
      date: thaiDate,
      dateIso,
      time: thaiTime,
      period: periodName,
      totalStudents,
      dischargedCount,
      presentCount,
      reasonsBreakdown: breakdown,
      dischargedStudents: dischargedList,
      createdAt: now.toISOString(),
    };

    setCurrentSummaryRecord(newRecord);
    setIsSummaryModalOpen(true);
    setSaveStatus('saving');

    // Confetti celebration
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch {
      // ignore
    }

    // AUTOMATICALLY SAVE TO DATABASE
    const result = await autoSaveDischargeRecord(newRecord);
    if (result.success) {
      setSaveStatus('saved');
    } else {
      setSaveStatus('error');
      setSaveError(result.error);
    }
  };

  // Remove single student from the completed summary and update database
  const handleRemoveStudentFromSummary = async (studentId: number) => {
    if (!currentSummaryRecord) return;

    const updatedDischarged = currentSummaryRecord.dischargedStudents.filter(
      s => s.id !== studentId
    );

    const breakdown: Record<string, number> = {};
    updatedDischarged.forEach(s => {
      breakdown[s.reason] = (breakdown[s.reason] || 0) + 1;
    });

    const updatedRecord: DischargeRecord = {
      ...currentSummaryRecord,
      dischargedCount: updatedDischarged.length,
      presentCount: currentSummaryRecord.totalStudents - updatedDischarged.length,
      dischargedStudents: updatedDischarged,
      reasonsBreakdown: breakdown,
    };

    setCurrentSummaryRecord(updatedRecord);
    // Auto update in database
    await autoSaveDischargeRecord(updatedRecord);
  };

  // Start fresh session
  const handleStartNewSession = () => {
    setSelectedClubs([]);
    setIndividualSelections({});
    setIsSummaryModalOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-800 antialiased font-['Prompt',sans-serif]">
      {/* Top Header */}
      <header className="bg-indigo-900 text-white shadow-lg sticky top-0 z-30 border-b border-indigo-950">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Branding & Count */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-indigo-400/40 shadow-md shrink-0 bg-indigo-950 flex items-center justify-center">
                <img
                  src={cadetLogo}
                  alt="Air Cadet 74 Logo"
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight">ระบบจำหน่าย V1</h1>
                </div>
                <p className="text-xs text-indigo-200">
                  ยอดเดิม:{' '}
                  <span className="font-bold text-amber-300 text-sm">{students.length}</span> นาย
                </p>
              </div>
            </div>
          </div>

          {/* Tabs bar */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-indigo-800/60 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveTab('check')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-semibold transition-all ${
                activeTab === 'check'
                  ? 'bg-white text-indigo-950 shadow-sm'
                  : 'text-indigo-200 hover:text-white hover:bg-indigo-800/50'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>เช็คยอด</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-semibold transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-indigo-950 shadow-sm'
                  : 'text-indigo-200 hover:text-white hover:bg-indigo-800/50'
              }`}
            >
              <History className="w-4 h-4" />
              <span>ประวัติ</span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                activeTab === 'history' ? 'bg-indigo-100 text-indigo-800' : 'bg-indigo-800 text-amber-300'
              }`}>
                {records.length}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-5 flex-grow w-full">
        {activeTab === 'check' ? (
          <div className="space-y-4">
            {/* Grid 2 Columns: Clubs & Individuals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
              {/* Section 1: Clubs */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      <Users className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-800 text-sm">จำหน่ายชมรม</h2>
                      <p className="text-[11px] text-slate-500"></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tentativeDischargeCount > 0 && (
                      <button
                        onClick={handleClearAllSelections}
                        className="text-[11px] text-slate-500 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 px-2 py-1 rounded-lg transition-colors flex items-center gap-1"
                        title="ล้างการเลือกทั้งหมด"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>ล้างที่เลือก</span>
                      </button>
                    )}
                    <button
                      onClick={() => syncGoogleSheet(true)}
                      disabled={isSyncingSheet}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all shadow-sm disabled:opacity-60"
                      title={lastSheetSyncTime ? `อัพเดทล่าสุด: ${lastSheetSyncTime} (${matchedSheetCount} นาย)` : 'อัพเดทข้อมูล'}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                      <span>{isSyncingSheet ? 'กำลังอัพเดท...' : 'อัพเดทข้อมูล'}</span>
                    </button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-2 gap-3" id="club-list-container">
                  {availableClubs.map((club) => {
                    const count = students.filter(s => s.clubs?.includes(club)).length;
                    const isChecked = selectedClubs.includes(club);

                    return (
                      <label
                        key={club}
                        className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-blue-50/80 border-blue-400 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/70'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1.5">
                          <span className={`font-bold text-sm ${isChecked ? 'text-blue-900' : 'text-slate-700'}`}>
                            {club}
                          </span>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleClub(club)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                          />
                        </div>
                        <span className={`text-xs ${count > 0 ? 'text-slate-500 font-medium' : 'text-slate-400'}`}>
                          {count} นาย
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              {/* Section 2: Individuals */}
              <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col max-h-[75vh]">
                <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold">
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-800 text-sm">จำหน่ายรายคน</h2>
                      <p className="text-[11px] text-slate-500"></p>
                    </div>
                  </div>

                  {/* Search box */}
                  <div className="relative w-full sm:w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={individualSearch}
                      onChange={(e) => setIndividualSearch(e.target.value)}
                      placeholder="ค้นหาชื่อ"
                      className="w-full text-xs pl-8 pr-2.5 py-1.5 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-white"
                    />
                  </div>
                </div>

                {/* Individual list scrollable */}
                <div className="p-3 overflow-y-auto flex-grow divide-y divide-slate-100">
                  {filteredStudents.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      ไม่พบชื่อนักเรียนที่ค้นหา
                    </div>
                  ) : (
                    filteredStudents.map((student) => {
                      const currentSelected = individualSelections[student.id];
                      const clubsStr = student.clubs && student.clubs.length > 0
                        ? student.clubs.join(', ')
                        : 'ไม่มีชมรม';

                      return (
                        <div
                          key={student.id}
                          className="py-2.5 px-2 hover:bg-slate-50 rounded-xl transition-colors space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium text-xs sm:text-sm text-slate-800">
                                  {student.name}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  ชมรม: <span className="text-slate-600">{clubsStr}</span>
                                </p>
                              </div>
                            </div>

                            {currentSelected && (
                              <button
                                onClick={() => clearSingleStudent(student.id)}
                                className="text-[10px] text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                <span>ล้าง</span>
                              </button>
                            )}
                          </div>

                          {/* Options Radios */}
                          <div className="flex gap-2 bg-slate-50 border border-slate-200 rounded-xl p-1.5 w-full justify-around shadow-inner">
                            <label className="flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-white transition-colors">
                              <input
                                type="checkbox"
                                checked={currentSelected === 'แผนก'}
                                onChange={() => handleIndividualCheck(student.id, 'แผนก')}
                                className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className={`text-xs ${currentSelected === 'แผนก' ? 'font-bold text-emerald-700' : 'text-slate-600'}`}>
                                แผนก
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-white transition-colors">
                              <input
                                type="checkbox"
                                checked={currentSelected === 'เวร'}
                                onChange={() => handleIndividualCheck(student.id, 'เวร')}
                                className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className={`text-xs ${currentSelected === 'เวร' ? 'font-bold text-emerald-700' : 'text-slate-600'}`}>
                                เวร
                              </span>
                            </label>

                            <label className="flex items-center gap-1.5 cursor-pointer py-1 px-2 rounded-lg hover:bg-white transition-colors">
                              <input
                                type="checkbox"
                                checked={currentSelected === 'เขียนเอง'}
                                onChange={() => handleIndividualCheck(student.id, 'เขียนเอง')}
                                className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                              />
                              <span className={`text-xs ${currentSelected === 'เขียนเอง' ? 'font-bold text-emerald-700' : 'text-slate-600'}`}>
                                เขียนเอง
                              </span>
                            </label>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>

            {/* Bottom Action: สรุปยอด */}
            <div className="pt-2 pb-2 flex justify-center">
              <button
                onClick={processSummary}
                className="w-full sm:w-auto min-w-[280px] bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold py-3.5 px-8 rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2.5 text-base cursor-pointer"
              >
                <Calculator className="w-5 h-5 text-slate-950" />
                <span>สรุปยอด</span>
                {tentativeDischargeCount > 0 && (
                  <span className="bg-slate-900 text-white text-xs px-2.5 py-0.5 rounded-full font-bold ml-1">
                    จำหน่าย {tentativeDischargeCount} นาย
                  </span>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Tab 2: History & Database Logs */
          <HistoryView
            records={records}
            onRefresh={() => {
              setIsLoadingRecords(true);
              // brief reload state
              setTimeout(() => setIsLoadingRecords(false), 500);
            }}
            isLoading={isLoadingRecords}
          />
        )}
      </main>

      {/* Floating Bottom Bar on Mobile */}
      {activeTab === 'check' && (
        <div className="sm:hidden sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 flex items-center justify-center shadow-2xl z-20">
          <button
            onClick={processSummary}
            className="w-full bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Calculator className="w-4 h-4 text-slate-950" />
            <span>สรุปยอด</span>
          </button>
        </div>
      )}

      {/* Conflict Modal */}
      <ConflictModal
        isOpen={isConflictModalOpen}
        conflicts={conflicts}
        onResolve={handleResolveConflicts}
        onCancel={() => setIsConflictModalOpen(false)}
      />

      {/* Other Reason Modal */}
      <OtherReasonModal
        isOpen={isOtherReasonModalOpen}
        studentIds={pendingOtherStudentIds}
        students={students}
        onSubmit={handleSubmitOtherReasons}
        onCancel={() => setIsOtherReasonModalOpen(false)}
      />

      {/* Final Summary & Auto-Save Modal */}
      <SummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        record={currentSummaryRecord}
        saveStatus={saveStatus}
        saveError={saveError}
        onRemoveStudent={handleRemoveStudentFromSummary}
        onGoToHistory={() => {
          setIsSummaryModalOpen(false);
          setActiveTab('history');
        }}
        onStartNewSession={handleStartNewSession}
      />

      {/* Student Manager Modal */}
      <StudentManagerModal
        isOpen={isStudentManagerOpen}
        onClose={() => setIsStudentManagerOpen(false)}
        students={students}
        onUpdateStudents={handleUpdateStudents}
        availableClubs={availableClubs}
        lastSyncTime={lastSheetSyncTime}
        isSyncing={isSyncingSheet}
        onManualSync={() => syncGoogleSheet(true)}
        matchedSheetCount={matchedSheetCount}
      />
    </div>
  );
}
