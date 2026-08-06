import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Archive, Plus, Edit, Search, Upload, ArrowUpDown, FileCheck, Download, XCircle, Trophy, Users, Filter, FileSpreadsheet, ArrowRightLeft, User, Phone, GraduationCap, FileText, Lock, Star, Bell, Cake, Copy, BookOpen, CheckCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import * as XLSX from 'xlsx';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { validatePassword } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";
import BirthdayNotificationModal from '@/components/dashboard/shared/BirthdayNotificationModal';
import { motion } from 'framer-motion';
import {
  changeSantriCategory,
  createSantri,
  fetchClassList,
  fetchSantriList,
  fetchSantriPage,
  mapSantriForLegacyUi,
  moveSantriClass,
  pickChangedSantriProfileFields,
  pickSantriProfileFields,
  updateSantri,
} from '@/lib/dataMasterAdapters';
import { getStorageErrorMessage, resolveAvatarUrl, uploadAvatar } from '@/lib/storageAdapters';
import { getBirthdaysThisMonth } from '@/lib/birthdayUtils';
import { archiveSantriAccounts, getFunctionErrorMessage } from '@/lib/santriArchiveAdapters';
import { copyTextToClipboard } from '@/lib/clipboardUtils';
import SantriArchiveDialog from '@/components/dashboard/admin/SantriArchiveDialog';
import DataPagination from '@/components/dashboard/shared/DataPagination';
import { getTingkatLevels } from '@/lib/tahfizhLevels';
import { enableTahfizh } from '@/lib/featureFlags';

const PAGE_SIZE = 10;


const getSelectedClassId = (input) => input?.current_class_id || input?.id_kelas || null;

const BULK_IMPORT_COLUMNS = [
  'Nama Lengkap',
  'Nama Panggilan',
  'NISN',
  'Tempat Lahir',
  'Tgl Lahir',
  'Jenis Kelamin',
  'Alamat',
  'NIS',
  'Angkatan',
  'Nama Ibu',
  'Nama Ayah',
  'No HP Ortu',
  'No KK',
  'No NIK',
  'RFID',
];

const BulkUploadModal = ({ isOpen, onClose, onUpload, category = 'Anak' }) => {
  const [file, setFile] = useState(null);
  const [textData, setTextData] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('excel');
  const fileInputRef = useRef(null);

  const parsedTextRows = useMemo(() => {
    const normalized = textData.trim();
    if (!normalized) return [];
    return normalized
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => line.split('\t'));
  }, [textData]);

  const detectedColumnCount = parsedTextRows.length > 0
    ? Math.max(...parsedTextRows.map((row) => row.length))
    : 0;
  const hasConsistentColumns = parsedTextRows.length > 0
    && parsedTextRows.every((row) => row.length === BULK_IMPORT_COLUMNS.length);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) setFile(selectedFile);
  };

  const downloadTemplate = () => {
    const templateHeaders = BULK_IMPORT_COLUMNS.map((column) => {
      if (column === 'Tgl Lahir' || column === 'Tgl Masuk') return `${column} (MM-DD-YYYY)`;
      if (column === 'Jenis Kelamin') return 'Jenis Kelamin (Laki-laki/Perempuan)';
      return column;
    });
    const ws = XLSX.utils.aoa_to_sheet([templateHeaders]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template Murid");
    XLSX.writeFile(wb, "Template_Import_Santri_V2.xlsx");
  };

  const processExcel = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          resolve(json);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleProcess = async () => {
    setIsLoading(true);
    let rawData = [];

    try {
      if (activeTab === 'excel' && file) {
        rawData = await processExcel(file);
      } else if (activeTab === 'text' && textData) {
        if (textData.includes('|') && !textData.includes('\t')) {
            throw new Error("Format data salah. Mohon gunakan format tab-separated (copy dari Excel). Karakter '|' tidak lagi didukung.");
        }
        rawData = textData.trim().split('\n').map(line => line.split('\t').map(v => v.trim()));
      }

      if (!rawData || rawData.length === 0) throw new Error("Data kosong.");

      onUpload(rawData, activeTab === 'excel');
      onClose();
      setFile(null);
      setTextData('');
    } catch (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data Murid Massal</DialogTitle>
          <DialogDescription>Pilih metode import data murid (Wajib sesuai template terbaru).</DialogDescription>
        </DialogHeader>

        <div className="admin-glass-tab-list inline-flex self-start rounded-full p-1 gap-1 mb-2">
            {[
              { id: 'excel', label: 'File Excel / CSV', icon: FileSpreadsheet },
              { id: 'text', label: 'Copy-Paste dari Excel', icon: Copy },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`admin-glass-tab-button relative rounded-full px-5 py-2.5 text-sm font-semibold ${activeTab === tab.id ? 'text-primary dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
              >
                {activeTab === tab.id && (
                  <motion.span
                    layoutId="bulk-import-active-pill"
                    className="admin-glass-tab-indicator"
                    transition={{ type: 'spring', stiffness: 430, damping: 34, mass: 0.72 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </span>
              </button>
            ))}
        </div>

        {activeTab === 'excel' ? (
            <div className="space-y-5 py-3">
                <button
                  type="button"
                  className="admin-bulk-import-surface group w-full rounded-3xl p-8 text-center transition-transform hover:-translate-y-0.5"
                  onClick={() => fileInputRef.current?.click()}
                >
                    <span className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 shadow-inner dark:bg-emerald-400/10 dark:text-emerald-300">
                      <FileSpreadsheet className="h-8 w-8 transition-transform group-hover:scale-110" />
                    </span>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{file ? file.name : 'Pilih file Excel atau CSV'}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Format yang didukung: .xlsx, .xls, dan .csv</p>
                    <input type="file" accept=".xlsx, .xls, .csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                </button>
                <div className="admin-bulk-import-surface flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Gunakan template 16 kolom terbaru</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">Tanggal memakai MM-DD-YYYY dan gender memakai Laki-laki atau Perempuan.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0 rounded-xl bg-white/60 backdrop-blur-xl dark:bg-white/5">
                        <Download className="mr-2 h-4 w-4"/> Download Template
                    </Button>
                </div>
            </div>
        ) : (
            <div className="space-y-4 py-3">
                <div className="admin-bulk-import-surface rounded-3xl p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-base font-bold text-slate-900 dark:text-white">Tempel sel langsung dari Excel atau Google Sheets</p>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Blok data tanpa mengubah pemisah kolom, lalu tekan Ctrl+C dan tempelkan di area bawah.</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <span className="rounded-full bg-blue-500/10 px-3 py-1.5 text-xs font-bold text-blue-700 dark:text-blue-300">{parsedTextRows.length} baris</span>
                        <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${hasConsistentColumns ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : textData ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300' : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'}`}>
                          {detectedColumnCount || 0}/16 kolom
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {BULK_IMPORT_COLUMNS.map((column, index) => (
                        <div key={column} className="rounded-xl bg-white/55 px-3 py-2 text-xs shadow-sm ring-1 ring-slate-200/50 backdrop-blur-lg dark:bg-white/5 dark:ring-white/10">
                          <span className="mr-1.5 font-black text-blue-600 dark:text-blue-300">{index + 1}.</span>
                          <span className="font-medium text-slate-600 dark:text-slate-300">{column}</span>
                        </div>
                      ))}
                    </div>
                </div>

                <div className="relative">
                  <Textarea
                      aria-label="Data murid hasil copy dari Excel"
                      placeholder={'Contoh:\nSantri Dummy\tDummy\tJilid 1A\tKota Dummy\t07-15-2018\tLaki-laki\t...'}
                      className="admin-bulk-import-textarea min-h-[280px] rounded-2xl p-4 font-mono text-xs leading-6 whitespace-pre"
                      value={textData}
                      onChange={(event) => setTextData(event.target.value)}
                  />
                  <div className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-white/75 px-2.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm backdrop-blur-xl dark:bg-slate-900/70 dark:text-slate-400">
                    Pemisah kolom: TAB
                  </div>
                </div>

                {textData && !hasConsistentColumns && (
                  <div className="rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-500/20 dark:text-amber-300">
                    Beberapa baris belum memiliki tepat 16 kolom. Pastikan seluruh rentang dicopy langsung dari Excel tanpa menghapus kolom kosong.
                  </div>
                )}
                {hasConsistentColumns && (
                  <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-800 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                    <CheckCircle className="h-4 w-4" /> Struktur data terdeteksi dengan benar dan siap diproses.
                  </div>
                )}
            </div>
        )}

        <DialogFooter>
          <Button onClick={handleProcess} disabled={isLoading || (activeTab === 'excel' && !file) || (activeTab === 'text' && !textData)}>
            {isLoading ? 'Memproses...' : 'Proses Data'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const UploadReportModal = ({ isOpen, onClose, report, onConfirm }) => {
  if (!report) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Laporan Validasi Data</DialogTitle>
          <DialogDescription>Tinjau data sebelum disimpan ke database.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                <p className="text-sm text-green-600 font-medium">Data Valid</p>
                <p className="text-2xl font-bold text-green-700">{report.validCount}</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-sm text-red-600 font-medium">Data Error</p>
                <p className="text-2xl font-bold text-red-700">{report.errorCount}</p>
            </div>
        </div>

        {report.errors.length > 0 && (
            <div className="space-y-2 mb-4">
                <h4 className="font-semibold text-sm flex items-center gap-2 text-red-600"><XCircle className="w-4 h-4"/> Detail Error:</h4>
                <div className="bg-red-50/50 p-3 rounded-lg border border-red-100 text-xs max-h-48 overflow-y-auto">
                    <ul className="space-y-1.5 text-red-700 font-medium">
                        {report.errors.map((err, idx) => (
                            <li key={idx}><strong>Baris {err.row}:</strong> [{err.name}] {err.reason}</li>
                        ))}
                    </ul>
                </div>
            </div>
        )}

        {report.validData.length > 0 && (
             <div className="space-y-2">
                <h4 className="font-semibold text-sm">Preview Data Valid (5 Teratas):</h4>
                <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 border-b">
                            <tr>
                                <th className="p-2">Nama Lengkap</th>
                                <th className="p-2">NISN</th>
                                <th className="p-2">Jenis Kelamin</th>
                                <th className="p-2">Angkatan</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.validData.slice(0, 5).map((d, i) => (
                                <tr key={i} className="border-b last:border-0">
                                    <td className="p-2">{d.nama_lengkap}</td>
                                    <td className="p-2">{d.nisn}</td>
                                    <td className="p-2">{d.jenis_kelamin}</td>
                                    <td className="p-2">{d.angkatan}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={onClose}>Batal</Button>
            <Button onClick={onConfirm} disabled={report.validCount === 0} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4 mr-2"/> Simpan {report.validCount} Data Valid
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const SantriManagement = () => {
  const { user } = useAuth();
  const [santriList, setSantriList] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Helper for Date Parsing (MM-DD-YYYY or Excel Number)
  const parseDateInput = (val) => {
    if (!val) return null;
    if (typeof val === 'number') {
        const date = new Date((val - (25567 + 2)) * 86400 * 1000);
        return date.toISOString().split('T')[0];
    }
    if (typeof val === 'string') {
        const parts = val.trim().split(/[-/]/);
        if (parts.length === 3) {
            // Assume format is MM-DD-YYYY or MM/DD/YYYY
            const m = parts[0].padStart(2, '0');
            const d = parts[1].padStart(2, '0');
            let y = parts[2];
            if (y.length === 2) y = '20' + y;
            return `${y}-${m}-${d}`;
        }
        // Fallback for standard parsable string
        const d = new Date(val);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    }
    return null;
  };

  // Helper for Gender Parsing
  const parseGenderInput = (val) => {
      if (!val) return null;
      const s = String(val).toLowerCase().trim();
      if (s === 'laki-laki' || s === 'l' || s === 'laki') return 'Laki-laki';
      if (s === 'perempuan' || s === 'p' || s === 'pr') return 'Perempuan';
      return null;
  };

  const handleDataProcessing = (rawData, isExcel) => {
    const firstRow = rawData[0];
    const isHeader = firstRow && (
        String(firstRow[0]).toLowerCase().includes('nama') ||
        String(firstRow[0]).toLowerCase().includes('full name')
    );

    const dataRows = isHeader ? rawData.slice(1) : rawData;
    const validData = [];
    const errors = [];

    dataRows.forEach((row, idx) => {
        if (!row || row.length === 0 || row.every(c => !c)) return;

        const santri = { kategori: 'Anak', status: 'Aktif', points: 0 };
        const rowName = row[0] || 'Baris Tidak Bernama';

        try {
            // 1. Nama Lengkap
            if (!row[0]) throw new Error("Nama Lengkap wajib diisi");
            santri.nama_lengkap = row[0];

            // 2. Nama Panggilan
            santri.nama_panggilan = row[1] || santri.nama_lengkap.split(' ')[0];

            // 3. NISN
            santri.nisn = row[2] ? String(row[2]).trim() : null;

            // 4. Tempat Lahir
            santri.tempat_lahir = row[3];

            // 5. Tgl Lahir (MM-DD-YYYY)
            if (row[4]) {
                const parsedDate = parseDateInput(row[4]);
                if (!parsedDate) throw new Error(`Format Tgl Lahir tidak valid: "${row[4]}". Gunakan format MM-DD-YYYY`);
                santri.tanggal_lahir = parsedDate;
            }

            // 6. Jenis Kelamin (Laki-laki/Perempuan)
            if (row[5]) {
                const parsedGender = parseGenderInput(row[5]);
                if (!parsedGender) throw new Error(`Jenis Kelamin tidak valid: "${row[5]}". Gunakan "Laki-laki" atau "Perempuan"`);
                santri.jenis_kelamin = parsedGender;
            } else {
                santri.jenis_kelamin = 'Laki-laki'; // default if empty but not missing completely
            }

            // 7. Alamat
            santri.alamat = row[6];

            // 8. NIS
            santri.nis = row[7] ? String(row[7]).trim() : null;

            // 9. Angkatan (2024/2025)
            santri.angkatan = row[8] ? String(row[8]).trim() : null;

            // 10. Nama Ibu
            santri.nama_ibu = row[9];

            // 11. Nama Ayah
            santri.nama_ayah = row[10];

            // 12. No HP Ortu
            santri.no_hp_ortu = row[11];

            // 13. No KK
            santri.no_kk = row[12];

            // 14. No NIK
            santri.no_nik = row[13];

            // 16. RFID
            santri.rfid_tag = row[15];

            // Setup Default Password based on Priority
            if (!santri.password) {
                 santri.password = santri.nisn || santri.nis || santri.nama_panggilan || '1234';
            }

            validData.push(santri);
        } catch (e) {
            errors.push({ row: isHeader ? idx + 2 : idx + 1, name: rowName, reason: e.message });
        }
    });

    setUploadReport({ validData, errors, validCount: validData.length, errorCount: errors.length });
    setIsReportOpen(true);
  };

  const [classesList, setClassesList] = useState([]);


  const [filters, setFilters] = useState({ search: '', rfid: 'all' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [uploadReport, setUploadReport] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [editingSantri, setEditingSantri] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'nama_lengkap', direction: 'ascending' });
  const [selectedSantri, setSelectedSantri] = useState(new Set());
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = React.useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', description: '', onConfirm: () => {} });
  const [previewImage, setPreviewImage] = useState(null);
  const [isBirthdayModalOpen, setIsBirthdayModalOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [birthdayCount, setBirthdayCount] = useState(0);
  const [birthdayStudents, setBirthdayStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalSantri, setTotalSantri] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [formData, setFormData] = useState({
    nama_lengkap: '', nama_panggilan: '', nisn: '', nis: '', angkatan: '', jenis_kelamin: 'Laki-laki', tempat_lahir: '', tanggal_lahir: '',
    nama_ayah: '', nama_ibu: '', pekerjaan_ayah: '', pekerjaan_ibu: '', alamat_ortu: '',
    no_hp_ortu: '', alamat: '', status: 'Aktif', foto_url: '', password: '', rfid_tag: '',
    no_kk: '', no_nik: '', berkas_foto: false, berkas_akta: false, berkas_kk: false, berkas_form: false, default_spp_amount: '', id_kelas: null, points: 0, kategori: 'Anak'
  });

  useEffect(() => {
      setBirthdayCount(getBirthdaysThisMonth(birthdayStudents).length);
  }, [birthdayStudents]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(filters.search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [filters.search]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedSantri(new Set());
  }, [filters.rfid, debouncedSearch, sortConfig]);

  const loadData = useCallback(async () => {
    setIsLoadingData(true);
    setFetchError(null);
    try {
      const santriFilters = {
        activeOnly: true,
        notDeleted: true,
        search: debouncedSearch.replace(/[%_,().]/g, ' ').trim() || undefined,
        rfid: filters.rfid !== 'all' ? filters.rfid : undefined,
        sort: sortConfig.key,
        sortDir: sortConfig.direction === 'ascending' ? 'asc' : 'desc',
        page: currentPage - 1,
        limit: PAGE_SIZE,
      };

      const [santriRes, classes, birthdayPool] = await Promise.all([
        fetchSantriPage(santriFilters),
        fetchClassList(),
        fetchSantriList({ activeOnly: true, notDeleted: true, limit: 200 }),
      ]);

      const mappedSantri = await Promise.all((santriRes.data || []).map(async (item) => {
          const foto_url = await resolveAvatarUrl({
              ownerType: 'santri',
              ownerId: item.id,
              avatarPath: item.avatar_path,
              fallbackUrl: item.foto_url,
          });
          return mapSantriForLegacyUi({ ...item, foto_url });
      }));
      setSantriList(mappedSantri);
      setTotalSantri(santriRes.total || 0);

      const totalPages = Math.max(1, Math.ceil((santriRes.total || 0) / PAGE_SIZE));
      if (currentPage > totalPages) setCurrentPage(totalPages);

      const birthdaysThisMonth = getBirthdaysThisMonth(birthdayPool || []);
      const resolvedBirthdays = await Promise.all(birthdaysThisMonth.map(async (item) => ({
        ...item,
        foto_url: await resolveAvatarUrl({
          ownerType: 'santri',
          ownerId: item.id,
          avatarPath: item.avatar_path,
          fallbackUrl: item.foto_url,
        }),
      })));
      setBirthdayStudents(resolvedBirthdays);

      setClassesList(classes || []);



    } catch (err) {
      console.error('Unexpected error during loadData:', err);
      setFetchError(err.message);
      toast({ title: "Error Sistem", description: "Terjadi kesalahan tidak terduga saat mengambil data.", variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [currentPage, debouncedSearch, filters.rfid, sortConfig]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const classGuruMap = useMemo(() => {
    return classesList.reduce((acc, cls) => {
      acc[cls.id] = cls.guru?.nama || 'Belum ada guru';
      return acc;
    }, {});
  }, [classesList]);

  const confirmBulkUpload = async () => {
      if (!uploadReport?.validData) return;
      toast({
          title: "Import massal ditunda",
          description: "Pembuatan akun murid massal perlu operasi backend atomik agar Auth, profil, alias login, dan membership tetap konsisten.",
          variant: "destructive"
      });
  };

  const handleDownloadData = async () => {
    try {
      const data = await fetchSantriList({
        activeOnly: true,
        notDeleted: true,
        search: filters.search.replace(/[%_,().]/g, ' ').trim() || undefined,
        rfid: filters.rfid !== 'all' ? filters.rfid : undefined,
        order: 'nama',
        limit: 200,
      });

      const dataToExport = (data || []).map(s => ({
          'Nama Lengkap': s.nama_lengkap, 'Nama Panggilan': s.nama_panggilan, 'NISN': s.nisn, 'NIS': s.nis, 'Tempat Lahir': s.tempat_lahir,
          'Tanggal Lahir': s.tanggal_lahir, 'Jenis Kelamin': s.jenis_kelamin, 'Alamat': s.alamat, 'Angkatan': s.angkatan,
          'Nama Ibu': s.nama_ibu, 'Nama Ayah': s.nama_ayah, 'No. HP Wali': s.no_hp_ortu,
          'Pekerjaan Ayah': s.pekerjaan_ayah, 'Pekerjaan Ibu': s.pekerjaan_ibu, 'Alamat Orang Tua': s.alamat_ortu || s.alamat,
          'No. KK': s.no_kk, 'No. NIK': s.no_nik, 'Status': s.status, 'RFID': s.rfid_tag
      }));
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Data Murid');
      XLSX.writeFile(workbook, 'Data_Murid.xlsx');
    } catch (error) {
      toast({ title: 'Export gagal', description: error.message || 'Data murid tidak dapat diekspor.', variant: 'destructive' });
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!editingSantri?.id) {
        toast({ title: "Simpan Akun Terlebih Dahulu", description: "Avatar memakai path berdasarkan UUID akun. Simpan data murid sebelum upload foto.", variant: "destructive" });
        e.target.value = '';
        return;
    }

    setIsUploading(true);

    try {
        const { path, signedUrl } = await uploadAvatar({ ownerType: 'santri', ownerId: editingSantri.id, file });
        const saved = await updateSantri(editingSantri.id, { avatar_path: path });
        if (!saved) throw new Error('Avatar terunggah, tetapi referensi profil murid tidak tersimpan.');

        const finalUrl = signedUrl || formData.foto_url || '';
        setFormData(prev => ({ ...prev, avatar_path: path, foto_url: finalUrl }));
        setEditingSantri(prev => prev ? ({ ...prev, avatar_path: path, foto_url: finalUrl }) : prev);
        setSantriList(prev => prev.map(item => item.id === editingSantri.id ? ({ ...item, avatar_path: path, foto_url: finalUrl }) : item));
        toast({ title: "Upload Berhasil", description: "Avatar tersimpan dan akan tetap muncul setelah refresh." });
    } catch (error) {
        toast({ title: "Upload Gagal", description: getStorageErrorMessage(error), variant: "destructive" });
    } finally {
        setIsUploading(false);
        e.target.value = '';
    }
  };

  const triggerPhotoUpload = () => photoInputRef.current?.click();

  const handleNicknameChange = (e) => {
    const nickname = e.target.value.replace(/\s/g, '');
    const capitalized = nickname.charAt(0).toUpperCase() + nickname.slice(1);
    setFormData(prev => ({ ...prev, nama_panggilan: capitalized }));
  };


  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalFormData = { ...formData, kategori: 'Anak' };

    const requiredFields = [
      ['nama_lengkap', 'Nama lengkap'],
      ['tanggal_lahir', 'Tanggal lahir'],
      ['jenis_kelamin', 'Jenis kelamin'],
    ];
    const missingField = requiredFields.find(([field]) => !String(finalFormData[field] ?? '').trim());
    if (missingField) {
        toast({ title: "Gagal", description: `${missingField[1]} wajib diisi.`, variant: "destructive"});
        return;
    }

    const nisn = String(finalFormData.nisn ?? '').trim();
    if (nisn && !/^\d{10}$/.test(nisn)) {
        toast({ title: "NISN Tidak Valid", description: "NISN harus 10 digit angka.", variant: "destructive" });
        return;
    }

    const angkatan = String(finalFormData.angkatan ?? '').trim();
    if (angkatan && !/^\d{4}\/\d{4}$/.test(angkatan)) {
        toast({ title: "Angkatan Tidak Valid", description: "Angkatan harus berformat 2024/2025.", variant: "destructive" });
        return;
    }

    if (!finalFormData.nama_panggilan) {
        finalFormData.nama_panggilan = finalFormData.nama_lengkap.trim().split(/\s+/)[0] || null;
    }

    if (!finalFormData.password) finalFormData.password = finalFormData.nisn || finalFormData.nis;

    if (finalFormData.password && finalFormData.password.length < 4) {
        toast({ title: "Validasi Password Gagal", description: "Password minimal 4 karakter.", variant: "destructive" });
      return;
    }

    // Perlakukan undefined sama seperti kosong. Sebelumnya hanya '' dan null yang
    // dilewati, sehingga field yang tidak diinisialisasi resetForm lolos ke
    // Number(undefined) = NaN dan memunculkan galat "minimal Rp10.000" pada field
    // yang jelas-jelas kosong — tidak mungkin dilewati pengguna.
    if (String(finalFormData.default_spp_amount ?? '').trim() !== '') {
      const defaultSppAmount = Number(finalFormData.default_spp_amount);
      if (!Number.isFinite(defaultSppAmount) || defaultSppAmount < 10000) {
        toast({ title: "Default SPP Tidak Valid", description: "Default SPP minimal Rp10.000 atau kosongkan jika belum ditentukan.", variant: "destructive" });
        return;
      }
      finalFormData.default_spp_amount = defaultSppAmount;
    }

    try {
      let targetId = editingSantri?.id;

      if (!editingSantri) {
        const created = await createSantri({
          ...pickSantriProfileFields(finalFormData),
          ...(finalFormData.password ? { password: finalFormData.password } : {}),
        });
        if (!created?.id) throw new Error('Akun murid gagal dibuat.');
        targetId = created.id;
      }

      const profilePayload = editingSantri
        ? pickChangedSantriProfileFields(finalFormData, editingSantri)
        : pickSantriProfileFields(finalFormData);
      const selectedClassId = getSelectedClassId(finalFormData);
      const originalClassId = getSelectedClassId(editingSantri);
      const classChanged = Boolean(selectedClassId) && selectedClassId !== originalClassId;
      const shouldArchiveAfterSave = String(finalFormData.status || '').toLowerCase() === 'nonaktif';

      if (Object.prototype.hasOwnProperty.call(profilePayload, 'current_class_id')) {
        delete profilePayload.current_class_id;
      }
      if (shouldArchiveAfterSave) delete profilePayload.status;

      if (editingSantri && Object.keys(profilePayload).length === 0 && !classChanged && !shouldArchiveAfterSave) {
        toast({
          title: "Tidak ada perubahan",
          description: "Tidak ada field murid yang berbeda dari data tersimpan. Ubah minimal satu field lalu simpan kembali.",
          variant: "destructive"
        });
        return;
      }

      if (Object.keys(profilePayload).length > 0) {
        const savedSantri = await updateSantri(targetId, profilePayload);
        if (!savedSantri?.id) throw new Error('Data murid tidak tersimpan karena tidak ada row yang diperbarui.');
      }

      if (classChanged) {
        await moveSantriClass({
          santri_id: targetId,
          target_class_id: selectedClassId,
          reason: editingSantri ? 'Perubahan kelas dari Data Murid' : 'Penempatan kelas awal dari Data Murid',
        });
      }

      if (shouldArchiveAfterSave) {
        await archiveSantriAccounts([targetId], 'Dinonaktifkan melalui form Data Murid');
      }

      toast({
        title: "Berhasil!",
        description: shouldArchiveAfterSave
          ? "Data murid tersimpan dan dipindahkan ke arsip."
          : (editingSantri ? "Data murid berhasil diperbarui" : "Murid baru berhasil ditambahkan"),
      });
      await loadData();
      window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
      setIsFormOpen(false);
      resetForm();
    } catch (error) {
      toast({ title: "Gagal!", description: error.message, variant: "destructive" });
    }
  };

  const handleEdit = (santri) => {
    setEditingSantri(santri);
    setFormData({...santri, points: santri.points || 0});
    setIsFormOpen(true);
  };

  const handleDelete = async () => {
    if (selectedSantri.size === 0) return;
    const idsToDelete = Array.from(selectedSantri);

    setConfirmDialog({
      isOpen: true,
      title: 'Pindahkan ke Arsip',
      description: `${selectedSantri.size} murid akan dinonaktifkan dan dipindahkan ke arsip. Kelas, hafalan, karakter, absensi, pembayaran, dan seluruh riwayat tetap tersimpan serta dapat dipulihkan kapan saja.`,
      onConfirm: async () => {
        try {
          await archiveSantriAccounts(idsToDelete, 'Dipindahkan ke arsip dari Data Murid');
          await loadData();
          window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
          setSelectedSantri(new Set());
          toast({ title: "Masuk arsip", description: "Murid terpilih telah diarsipkan tanpa menghapus riwayatnya." });
        } catch (error) {
          toast({ title: "Gagal!", description: error.message, variant: "destructive" });
        }
      }
    });
  };

  const handleBulkStatusChange = async (status) => {
    if (selectedSantri.size === 0) return;
    const confirmationText = status === 'Aktif' ? 'mengaktifkan' : 'menonaktifkan';
    setConfirmDialog({
      isOpen: true,
      title: 'Ubah Status Murid',
      description: `Yakin ingin ${confirmationText} ${selectedSantri.size} data murid terpilih?`,
      onConfirm: async () => {
        const idsToUpdate = Array.from(selectedSantri);

        try {
          await archiveSantriAccounts(idsToUpdate, 'Dinonaktifkan dari Data Murid');
          await loadData();
          window.dispatchEvent(new CustomEvent('lpq:santri-data-changed'));
          setSelectedSantri(new Set());
          toast({ title: "Murid dinonaktifkan", description: "Data dipindahkan ke arsip dan dapat dipulihkan kapan saja." });
        } catch (error) {
          toast({ title: "Gagal!", description: error.message, variant: "destructive" });
        }
      }
    });
  };

  const getMigrationLabel = (targetCategory) => targetCategory === 'Anak' ? 'TPQ' : targetCategory;

  const migrateSantriCategory = async (santriId, targetCategory, reason) => {
      return changeSantriCategory({
          santri_id: santriId,
          new_category: targetCategory,
          reason,
      });
  };


  const toggleSelect = (id) => {
    const newSelection = new Set(selectedSantri);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedSantri(newSelection);
  };

  const toggleSelectAll = (isChecked) => {
    if (isChecked) setSelectedSantri(new Set(sortedAndFilteredSantri.map(s => s.id)));
    else setSelectedSantri(new Set());
  };

  const resetForm = () => {
    setFormData({
      nama_lengkap: '', nama_panggilan: '', nisn: '', nis: '', angkatan: '', jenis_kelamin: 'Laki-laki', tempat_lahir: '', tanggal_lahir: '',
      nama_ayah: '', nama_ibu: '', pekerjaan_ayah: '', pekerjaan_ibu: '', alamat_ortu: '',
      no_hp_ortu: '', alamat: '', status: 'Aktif', foto_url: '', password: '', rfid_tag: '',
      no_kk: '', no_nik: '', berkas_foto: false, berkas_akta: false, berkas_kk: false, berkas_form: false,
      default_spp_amount: '', id_kelas: null, points: 0, kategori: 'Anak'
    });
    setEditingSantri(null);
  };

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') direction = 'descending';
    setSortConfig({ key, direction });
  };

  const handleCopyRFID = async (rfid) => {
    if (!rfid) {
        toast({ title: "Gagal", description: "Tidak ada RFID tag untuk disalin.", variant: "destructive" });
        return;
    }
    try {
        await copyTextToClipboard(rfid);
        toast({
            title: "RFID disalin",
            description: "RFID tag disalin ke clipboard.",
            className: "bg-green-50 border-green-200 text-green-700",
            action: <CheckCircle className="w-5 h-5 text-green-600"/>
        });
    } catch {
        toast({ title: "Gagal Copy", description: "Tidak bisa menyalin RFID.", variant: "destructive" });
    }
  };

  const handleCopyNisn = async (induk) => {
    if (!induk) {
        toast({ title: "Gagal", description: "NISN belum diisi.", variant: "destructive" });
        return;
    }
    try {
        await copyTextToClipboard(induk);
        toast({
            title: "NISN disalin",
            description: "NISN disalin ke clipboard.",
            className: "bg-green-50 border-green-200 text-green-700",
            action: <CheckCircle className="w-5 h-5 text-green-600"/>
        });
    } catch {
        toast({ title: "Gagal Copy", description: "Tidak bisa menyalin NISN.", variant: "destructive" });
    }
  };

  const sortedAndFilteredSantri = useMemo(() => {
    let sortableItems = [...santriList];

    if (filters.rfid !== 'all') {
        sortableItems = sortableItems.filter(s => filters.rfid === 'assigned' ? !!s.rfid_tag : !s.rfid_tag);
    }
    if (filters.search) {
      const lowercasedFilter = filters.search.toLowerCase();
      sortableItems = sortableItems.filter(s =>
        s.nama_lengkap.toLowerCase().includes(lowercasedFilter) ||
        (s.nama_panggilan && s.nama_panggilan.toLowerCase().includes(lowercasedFilter)) ||
        (s.nama_ayah && s.nama_ayah.toLowerCase().includes(lowercasedFilter)) ||
        (s.rfid_tag && s.rfid_tag.toLowerCase().includes(lowercasedFilter))
      );
    }
    sortableItems.sort((a, b) => {
      if (sortConfig.key === 'guru_pengampu') {
        const nameA = classGuruMap[a.current_class_id || a.id_kelas] || 'zzzz';
        const nameB = classGuruMap[b.current_class_id || b.id_kelas] || 'zzzz';
        if (nameA < nameB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (nameA > nameB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      }
      if (!a[sortConfig.key] || !b[sortConfig.key]) return 0;
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'ascending' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'ascending' ? 1 : -1;
      return 0;
    });
    return sortableItems;
  }, [santriList, filters, sortConfig, classGuruMap]);

  return (
    <div>
      <div className="admin-panel-header">
          <div className="flex items-center gap-3">
             <div className="admin-panel-header-icon">
                <Users />
             </div>
             <div className="admin-panel-header-text">
                <h2>Manajemen Murid</h2>
                <p>Kelola data murid, kelas, dan status aktif.</p>
             </div>
          </div>

          <div className="admin-panel-header-actions">
            <button onClick={() => setIsArchiveOpen(true)} className="admin-action-cluster-btn">
                <Archive className="w-4 h-4" /> Arsip
            </button>
            <button
                onClick={() => setIsBirthdayModalOpen(true)}
                className="admin-action-cluster-btn relative"
                style={{ border: '1px solid hsl(330 80% 85%)', color: 'hsl(330 60% 55%)' }}
            >
                <Cake className="w-4 h-4" />
                {birthdayCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full shadow-sm animate-bounce leading-none">
                        {birthdayCount}
                    </span>
                )}
            </button>

            {selectedSantri.size > 0 && (
                <div className="admin-bulk-bar">

                    <button onClick={() => handleBulkStatusChange('Nonaktif')} className="admin-bulk-btn admin-bulk-btn--deactivate">
                        <XCircle className="w-3.5 h-3.5"/> Non-Aktif
                    </button>
                    <button onClick={handleDelete} className="admin-bulk-btn admin-bulk-btn--delete">
                        <Archive className="w-3.5 h-3.5"/> Arsipkan ({selectedSantri.size})
                    </button>
                </div>
            )}
            <div className="admin-action-cluster">
                 <button onClick={() => setIsBulkUploadOpen(true)} className="admin-action-cluster-btn">
                    <Upload className="w-3.5 h-3.5"/> Import
                 </button>
                 <button onClick={handleDownloadData} className="admin-action-cluster-btn">
                    <Download className="w-3.5 h-3.5"/> Export
                 </button>
            </div>
            <button onClick={() => { resetForm(); setIsFormOpen(true); }} className="admin-panel-primary-btn">
                <Plus className="w-4 h-4"/> Tambah Murid
            </button>
          </div>
      </div>

       <div className="admin-filter-bar">
            <div className="admin-search-input">
                <Search />
                <Input
                    placeholder="Cari murid berdasarkan nama, wali, atau RFID..."
                    value={filters.search}
                    onChange={e => setFilters(f => ({...f, search: e.target.value}))}
                />
            </div>
            <div className="admin-filter-selects">

                <Select value={filters.rfid} onValueChange={val => setFilters(f => ({...f, rfid: val}))}>
                    <SelectTrigger><SelectValue placeholder="RFID" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua RFID</SelectItem><SelectItem value="assigned">Ada RFID</SelectItem><SelectItem value="unassigned">Tanpa RFID</SelectItem></SelectContent>
                </Select>
            </div>
       </div>

      {fetchError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl mb-4 flex items-center justify-between">
          <p className="font-medium">Gagal memuat data murid: <span className="font-normal">{fetchError}</span></p>
          <Button variant="outline" size="sm" onClick={() => loadData()}>Coba Lagi</Button>
        </div>
      )}

      <div className="admin-table-shell">
        {isLoadingData && (
            <div className="admin-table-loading">
                <div className="admin-table-loading-spinner"></div>
                <p>Sedang memproses data...</p>
            </div>
        )}
        <div className="admin-table-scroll">
        <table>
          <thead>
            <tr>
              <th className="p-3 w-10"><Checkbox onCheckedChange={toggleSelectAll} checked={sortedAndFilteredSantri.length > 0 && selectedSantri.size === sortedAndFilteredSantri.length} /></th>
              <th className="p-3 text-left w-12 text-xs font-semibold text-muted-foreground uppercase tracking-wider">No.</th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('nama_lengkap')}><div className="flex items-center">Nama <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('nisn')}><div className="flex items-center">NISN <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('jenis_kelamin')}><div className="flex items-center">L/P <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('guru_pengampu')}><div className="flex items-center">Guru Pengampu <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors" onClick={() => requestSort('angkatan')}><div className="flex items-center">Angkatan <ArrowUpDown className="ml-1 h-3 w-3" /></div></th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Berkas</th>
              <th className="p-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Aksi</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800">
            {sortedAndFilteredSantri.map((santri, index) => (
              <tr key={santri.id} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group">
                <td className="p-3"><Checkbox onCheckedChange={() => toggleSelect(santri.id)} checked={selectedSantri.has(santri.id)} /></td>
                <td className="p-3 text-muted-foreground font-mono text-xs">{((currentPage - 1) * PAGE_SIZE) + index + 1}</td>
                <td className="p-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-slate-200 dark:border-slate-700 cursor-pointer hover:scale-105 transition-transform" onClick={() => setPreviewImage(santri.foto_url)}>
                            <AvatarImage src={santri.foto_url} />
                            <AvatarFallback className="bg-blue-100 text-blue-700 font-bold text-xs">{santri.nama_lengkap.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <button
                                type="button"
                                className="font-medium text-left text-foreground cursor-pointer hover:text-blue-600 hover:underline flex items-center gap-1 group/name focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 rounded-sm"
                                onClick={() => handleCopyRFID(santri.rfid_tag)}
                                title="Klik untuk menyalin RFID"
                                aria-label={`Salin RFID ${santri.nama_lengkap}`}
                            >
                                {santri.nama_lengkap}
                                <Copy className="w-3 h-3 opacity-0 group-hover/name:opacity-50" />
                            </button>
                            <button
                                type="button"
                                className="text-xs text-left text-muted-foreground font-mono cursor-pointer hover:text-green-600 hover:underline flex items-center gap-1 group/nick focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-sm"
                                onClick={() => handleCopyNisn(santri.nisn)}
                                title="Klik untuk menyalin NISN"
                                aria-label={`Salin NISN ${santri.nama_panggilan || santri.nama_lengkap}`}
                            >
                                {santri.nama_panggilan}
                                <Copy className="w-3 h-3 opacity-0 group-hover/nick:opacity-50" />
                            </button>
                        </div>
                    </div>
                </td>
                <td className="p-3 text-sm font-mono text-muted-foreground">{santri.nisn || '-'}</td>
                <td className="p-3"><Badge variant="outline" className={santri.jenis_kelamin === 'Laki-laki' ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-pink-50 text-pink-700 border-pink-200"}>{santri.jenis_kelamin === 'Laki-laki' ? 'L' : 'P'}</Badge></td>
                <td className="p-3 text-sm font-medium text-foreground">{classGuruMap[santri.current_class_id || santri.id_kelas] || <span className="text-muted-foreground italic text-xs">Belum ada</span>}</td>
                <td className="p-3"><Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">{santri.angkatan || '-'}</Badge></td>
                <td className="p-3"><div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 dark:bg-slate-900 border"><FileCheck className={`w-4 h-4 ${santri.berkas_foto && santri.berkas_akta && santri.berkas_kk && santri.berkas_form ? 'text-green-500' : 'text-slate-300'}`} /></div></td>
                <td className="p-3"><Button onClick={() => handleEdit(santri)} size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600 rounded-full"><Edit className="w-4 h-4" /></Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoadingData && sortedAndFilteredSantri.length === 0 && !fetchError && (
            <div className="admin-table-empty">
                <Search />
                <p>Tidak ada data murid ditemukan.</p>
            </div>
        )}
        </div>
        <DataPagination
          currentPage={currentPage}
          totalItems={totalSantri}
          pageSize={PAGE_SIZE}
          onPageChange={(page) => {
            setSelectedSantri(new Set());
            setCurrentPage(page);
          }}
          itemLabel="santri"
        />
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader><DialogTitle>{editingSantri ? 'Edit Data Murid' : 'Tambah Murid Baru'}</DialogTitle></DialogHeader>

          <form onSubmit={handleSubmit} className="admin-edit-shell">
            <div className="admin-edit-body">

                {/* 1. Header & Photo Section */}
                <div className="admin-edit-photo-area">
                    <Avatar className="w-20 h-20 border-2 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0" style={{ borderColor: 'hsl(var(--admin-border))' }} onClick={() => formData.foto_url && setPreviewImage(formData.foto_url)}>
                        <AvatarImage src={formData.foto_url} />
                        <AvatarFallback style={{ backgroundColor: 'hsl(var(--admin-accent-soft))', color: 'hsl(var(--admin-accent))' }}><Upload className="w-6 h-6" /></AvatarFallback>
                    </Avatar>
                    <div className="flex-1 w-full space-y-2">
                        <div className="flex gap-2 flex-wrap">
                             <Button type="button" onClick={triggerPhotoUpload} variant="outline" size="sm" disabled={isUploading || !editingSantri?.id} title={!editingSantri?.id ? 'Simpan akun sebelum upload avatar.' : undefined}>{isUploading ? 'Mengunggah...' : 'Upload Foto'}</Button>
                             <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
                        </div>
                        <p className="text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>JPG, PNG, WebP (Max 2 MB). Simpan akun baru sebelum upload.</p>
                        <div className="relative">
                            <Input type="text" placeholder="https://example.com/foto.jpg" value={formData.foto_url || ''} onChange={(e) => setFormData({ ...formData, foto_url: e.target.value })} className="pl-9 text-xs" />
                            <Upload className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3" style={{ color: 'hsl(var(--admin-text-muted))' }}/>
                        </div>
                    </div>
                </div>

                {/* 2. Personal Information Section */}
                <div className="admin-edit-section">
                    <div className="admin-edit-section-header"><User /> Informasi Pribadi</div>
                    <div className="admin-edit-field-grid">
                        <div className="admin-edit-field"><label>Nama Lengkap</label><Input type="text" value={formData.nama_lengkap || ''} onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })} required /></div>
                        <div className="admin-edit-field"><label>Nama Panggilan</label><Input type="text" value={formData.nama_panggilan || ''} onChange={handleNicknameChange} /></div>
                        <div className="admin-edit-field"><label>Jenis Kelamin</label><Select value={formData.jenis_kelamin} onValueChange={val => setFormData({ ...formData, jenis_kelamin: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Laki-laki">Laki-laki</SelectItem><SelectItem value="Perempuan">Perempuan</SelectItem></SelectContent></Select></div>
                        <div className="admin-edit-field"><label>Tempat Lahir</label><Input type="text" value={formData.tempat_lahir || ''} onChange={(e) => setFormData({ ...formData, tempat_lahir: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>Tanggal Lahir</label><Input type="date" value={formData.tanggal_lahir || ''} onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })} required /></div>
                        <div className="admin-edit-field"><label>Angkatan</label><Input type="text" placeholder="2024/2025" value={formData.angkatan || ''} onChange={(e) => setFormData({ ...formData, angkatan: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>NISN</label><Input type="text" inputMode="numeric" maxLength={10} placeholder="10 digit" value={formData.nisn || ''} onChange={(e) => setFormData({ ...formData, nisn: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>NIS</label><Input type="text" value={formData.nis || ''} onChange={(e) => setFormData({ ...formData, nis: e.target.value })} /></div>
                    </div>
                </div>

                {/* 3. Family & Contact Section */}
                <div className="admin-edit-section">
                    <div className="admin-edit-section-header"><Users /> Keluarga & Kontak</div>
                    <div className="admin-edit-field-grid">
                        <div className="admin-edit-field"><label>Nama Ayah</label><Input type="text" value={formData.nama_ayah || ''} onChange={(e) => setFormData({ ...formData, nama_ayah: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>Nama Ibu</label><Input type="text" value={formData.nama_ibu || ''} onChange={(e) => setFormData({ ...formData, nama_ibu: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>Pekerjaan Ayah</label><Input type="text" value={formData.pekerjaan_ayah || ''} onChange={(e) => setFormData({ ...formData, pekerjaan_ayah: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>Pekerjaan Ibu</label><Input type="text" value={formData.pekerjaan_ibu || ''} onChange={(e) => setFormData({ ...formData, pekerjaan_ibu: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>No. HP Wali</label><Input type="tel" value={formData.no_hp_ortu || ''} onChange={(e) => setFormData({ ...formData, no_hp_ortu: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>No. KK</label><Input type="text" value={formData.no_kk || ''} onChange={(e) => setFormData({ ...formData, no_kk: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>No. NIK</label><Input type="text" value={formData.no_nik || ''} onChange={(e) => setFormData({ ...formData, no_nik: e.target.value })} /></div>
                        <div className="admin-edit-field admin-edit-field-full"><label>Alamat</label><Textarea value={formData.alamat || ''} onChange={(e) => setFormData({ ...formData, alamat: e.target.value })} className="min-h-[60px]" /></div>
                        <div className="admin-edit-field admin-edit-field-full"><label>Alamat Orang Tua <span className="text-xs opacity-70 font-normal">(kosongkan bila sama dengan alamat di atas)</span></label><Textarea value={formData.alamat_ortu || ''} onChange={(e) => setFormData({ ...formData, alamat_ortu: e.target.value })} className="min-h-[60px]" /></div>
                    </div>
                </div>

                {/* 4. Academic Section */}
                <div className="admin-edit-section">
                    <div className="admin-edit-section-header"><GraduationCap /> Akademik & Sistem</div>
                    <div className="admin-edit-field-grid">
                        <div className="admin-edit-field"><label>RFID Tag</label><Input type="text" value={formData.rfid_tag || ''} onChange={(e) => setFormData({ ...formData, rfid_tag: e.target.value })} /></div>
                        <div className="admin-edit-field"><label>Status</label><Select value={formData.status} onValueChange={val => setFormData({ ...formData, status: val })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Aktif">Aktif</SelectItem><SelectItem value="Nonaktif">Non-Aktif</SelectItem></SelectContent></Select></div>
                        {enableTahfizh && (
                          <div className="admin-edit-field">
                            <label>Tingkat Tahfizh</label>
                            <Input
                              type="text"
                              list="tingkat-tahfizh-options"
                              placeholder="Contoh: Juz 30, Iqro 3, Ummi 4"
                              value={formData.jilid || ''}
                              onChange={(e) => setFormData({ ...formData, jilid: e.target.value })}
                            />
                            <datalist id="tingkat-tahfizh-options">
                              {getTingkatLevels().map((level) => <option key={level} value={level} />)}
                            </datalist>
                          </div>
                        )}

                        <div className="admin-edit-field"><label>Kelas Aktif <span className="normal-case text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>(untuk Absensi)</span></label><Select value={getSelectedClassId(formData) || undefined} onValueChange={val => setFormData({ ...formData, current_class_id: val, id_kelas: val })}><SelectTrigger><SelectValue placeholder="Pilih kelas aktif" /></SelectTrigger><SelectContent>{classesList.map(cls => <SelectItem key={cls.id} value={cls.id}>{cls.nama_kelas}{cls.guru?.nama ? ` - ${cls.guru.nama}` : ''}</SelectItem>)}</SelectContent></Select></div>
                        <div className="admin-edit-field">
                            <label>Default SPP Bulanan</label>
                            <Input type="number" min="10000" step="1000" value={formData.default_spp_amount ?? ''} onChange={(e) => setFormData({ ...formData, default_spp_amount: e.target.value })} placeholder="Contoh: 70000" />
                            <span className="text-[10px]" style={{ color: 'hsl(var(--admin-text-muted))' }}>Opsional. Nominal ini otomatis dipilih saat pembayaran SPP.</span>
                        </div>
                        <div className="admin-edit-field">
                            <label className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-500"/> Poin Gamifikasi</label>
                            <Input type="number" min="0" value={formData.points || 0} onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>

                    <div className="admin-edit-access-card mt-4">
                        <h4><Lock /> Akses Login</h4>
                        <div className="admin-edit-field-grid">
                            <div className="admin-edit-field"><label>Username</label><Input type="text" value={formData.nama_panggilan || ''} readOnly style={{ opacity: 0.7 }} /></div>
                            {/* Tidak `required`: bila dikosongkan, password otomatis memakai NISN
                            atau NIS (lihat handleSubmit), sama seperti perilaku impor massal.
                            Dulu field ini `required`, sehingga browser memblokir submit tanpa
                            pesan apa pun dan pengisian otomatis itu mustahil tercapai. */}
                        <div className="admin-edit-field"><label>Password</label><Input type="text" value={formData.password || ''} onChange={(e) => setFormData({ ...formData, password: e.target.value })} disabled={Boolean(editingSantri)} placeholder={editingSantri ? 'Reset password melalui alur admin terpisah' : 'Kosongkan untuk memakai NISN'} /></div>
                        </div>
                    </div>
                </div>

                {/* 5. Document Section */}
                <div className="admin-edit-section">
                     <div className="admin-edit-section-header"><FileText /> Kelengkapan Berkas</div>
                     <div className="admin-edit-field-grid">
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_foto" checked={Boolean(formData.berkas_foto)} onCheckedChange={(checked) => setFormData({ ...formData, berkas_foto: Boolean(checked) })} /><label htmlFor="berkas_foto" className="text-sm" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Foto</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_akta" checked={Boolean(formData.berkas_akta)} onCheckedChange={(checked) => setFormData({ ...formData, berkas_akta: Boolean(checked) })} /><label htmlFor="berkas_akta" className="text-sm" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Akta Kelahiran</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_kk" checked={Boolean(formData.berkas_kk)} onCheckedChange={(checked) => setFormData({ ...formData, berkas_kk: Boolean(checked) })} /><label htmlFor="berkas_kk" className="text-sm" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Kartu Keluarga</label></div>
                        <div className="flex items-center space-x-2"><Checkbox id="berkas_form" checked={Boolean(formData.berkas_form)} onCheckedChange={(checked) => setFormData({ ...formData, berkas_form: Boolean(checked) })} /><label htmlFor="berkas_form" className="text-sm" style={{ color: 'hsl(var(--admin-text-secondary))' }}>Formulir</label></div>
                    </div>
                </div>

            </div>

            <div className="admin-edit-footer">

                <div className="admin-edit-footer-actions">
                    <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                    <Button type="submit">{editingSantri ? 'Simpan Perubahan' : 'Tambah Murid'}</Button>
                </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <BulkUploadModal isOpen={isBulkUploadOpen} onClose={() => setIsBulkUploadOpen(false)} onUpload={handleDataProcessing} category="Anak" />
      <UploadReportModal isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} report={uploadReport} onConfirm={confirmBulkUpload} />
      <BirthdayNotificationModal isOpen={isBirthdayModalOpen} onClose={() => setIsBirthdayModalOpen(false)} students={birthdayStudents} />
      {/* Tanpa `categories`: arsip menampilkan semua kategori, mengikuti daftar
          utama panel ini yang juga tidak menyaring kategori. Dulu prop ini berisi
          ['Anak', 'TPQ'] / ['PTPT'] mengikuti subCategory era Qiroati. */}
      <SantriArchiveDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        title="Arsip Murid"
        onRestored={() => loadData()}
      />

      <ConfirmationDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.description}
      />

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={() => setPreviewImage(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none">
            {previewImage && <img src={previewImage} alt="Preview" className="w-full h-auto rounded-lg shadow-2xl" />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SantriManagement;
