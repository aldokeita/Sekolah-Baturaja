import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { toast } from '@/components/ui/use-toast';
import {
    BookMarked, CalendarDays, CalendarRange, CalendarX2, Clock, DoorOpen,
    Edit, Loader2, MapPin, Plus, RefreshCw, Trash2, User,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { canManageRole } from '@/lib/roles';
import { fetchClassList, fetchGuruList } from '@/lib/dataMasterAdapters';
import {
    HARI_OPTIONS,
    createJadwal,
    deleteJadwal,
    fetchJadwalList,
    fetchMataPelajaranList,
    fetchPeriodeList,
    formatJam,
    formatJamRange,
    getPeriodeLabel,
    getScheduleErrorMessage,
    groupJadwalByHari,
    isJamRangeValid,
    updateJadwal,
} from '@/lib/scheduleAdapters';
import { MataPelajaranDialog, PeriodeDialog } from './JadwalMasterDialogs';

// Gradasi aurora teal → violet dibagi rata sepanjang Senin..Sabtu, sehingga
// posisi hari dalam minggu langsung terbaca dari warna kepala kolom.
const DAY_ACCENT = {
    1: 'from-teal-400 to-cyan-400',
    2: 'from-cyan-400 to-sky-400',
    3: 'from-sky-400 to-blue-400',
    4: 'from-blue-400 to-indigo-400',
    5: 'from-indigo-400 to-violet-400',
    6: 'from-violet-400 to-fuchsia-400',
};

const EMPTY_FORM = {
    id: null, class_id: '', mata_pelajaran_id: '', guru_id: 'none',
    hari: '1', jam_mulai: '07:00', jam_selesai: '08:00', ruang: '', catatan: '',
};

const SlotCard = ({ slot, canManage, onEdit, onDelete }) => (
    <article className="group relative overflow-hidden rounded-xl border border-white/70 bg-white/60 p-3 shadow-sm backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/80 hover:shadow-md dark:border-slate-700/70 dark:bg-slate-900/50 dark:hover:border-cyan-700/80">
        <div className="flex items-start justify-between gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/10 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-cyan-700 dark:text-cyan-300">
                <Clock className="h-3 w-3" aria-hidden="true" />
                {formatJamRange(slot.jam_mulai, slot.jam_selesai)}
            </span>
            {canManage && (
                <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 max-lg:opacity-100">
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Edit jadwal ${slot.mata_pelajaran_nama || ''}`} onClick={() => onEdit(slot)}>
                        <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" aria-label={`Hapus jadwal ${slot.mata_pelajaran_nama || ''}`} onClick={() => onDelete(slot)}>
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )}
        </div>
        <p className="mt-2 text-sm font-semibold leading-snug">{slot.mata_pelajaran_nama || 'Mata pelajaran dihapus'}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="truncate">{slot.guru_nama || 'Guru belum ditentukan'}</span>
        </p>
        {slot.ruang && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{slot.ruang}</span>
            </p>
        )}
    </article>
);

const DayColumn = ({ day, slots, canManage, onEdit, onDelete, onAdd }) => (
    <section aria-label={`Jadwal hari ${day.label}`} className="rounded-2xl border border-white/60 bg-white/40 p-3 backdrop-blur-md dark:border-slate-700/60 dark:bg-slate-900/30">
        <header className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
                <span className={`h-6 w-1.5 rounded-full bg-gradient-to-b ${DAY_ACCENT[day.value]}`} aria-hidden="true" />
                <h3 className="text-sm font-bold tracking-tight">{day.label}</h3>
            </div>
            <span className="rounded-full bg-slate-500/10 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                {slots.length}
            </span>
        </header>
        <div className="space-y-2">
            {slots.map((slot) => (
                <SlotCard key={slot.id} slot={slot} canManage={canManage} onEdit={onEdit} onDelete={onDelete} />
            ))}
            {slots.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-300/70 py-5 text-center text-xs text-muted-foreground dark:border-slate-700">
                    Tidak ada pelajaran
                </p>
            )}
            {canManage && (
                <button type="button" onClick={() => onAdd(day.value)} className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-cyan-400/50 py-2 text-xs font-medium text-cyan-700 transition-colors hover:border-cyan-500 hover:bg-cyan-500/10 dark:text-cyan-300">
                    <Plus className="h-3.5 w-3.5" /> Tambah
                </button>
            )}
        </div>
    </section>
);

const JadwalPelajaran = () => {
    const { role } = useAuth();
    // Otorisasi sesungguhnya ditegakkan middleware Go; penyembunyian kontrol di
    // sini murni supaya peran lain tidak disuguhi aksi yang pasti ditolak 403.
    const canManage = canManageRole(role);

    const [periodeList, setPeriodeList] = useState([]);
    const [mapelList, setMapelList] = useState([]);
    const [classList, setClassList] = useState([]);
    const [guruList, setGuruList] = useState([]);
    const [jadwalRows, setJadwalRows] = useState([]);

    const [selectedPeriodeId, setSelectedPeriodeId] = useState('');
    const [selectedClassId, setSelectedClassId] = useState('');

    const [isLoadingMaster, setIsLoadingMaster] = useState(true);
    const [isLoadingJadwal, setIsLoadingJadwal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [loadError, setLoadError] = useState(null);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isMapelOpen, setIsMapelOpen] = useState(false);
    const [isPeriodeOpen, setIsPeriodeOpen] = useState(false);
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [confirmState, setConfirmState] = useState({ isOpen: false, target: null });

    const loadMasterData = useCallback(async () => {
        setIsLoadingMaster(true);
        setLoadError(null);
        try {
            const [periode, mapel, classes, guru] = await Promise.all([
                fetchPeriodeList(),
                fetchMataPelajaranList({ activeOnly: true }),
                fetchClassList({ is_active: true, limit: 200 }),
                fetchGuruList(),
            ]);
            setPeriodeList(periode);
            setMapelList(mapel);
            setClassList(classes);
            setGuruList(guru);
            setSelectedPeriodeId((current) => {
                if (current && periode.some((item) => item.id === current)) return current;
                return periode.find((item) => item.is_active)?.id || periode[0]?.id || '';
            });
            setSelectedClassId((current) => {
                if (current && classes.some((item) => item.id === current)) return current;
                return classes[0]?.id || '';
            });
        } catch (error) {
            const description = getScheduleErrorMessage(error);
            setLoadError(description);
            toast({ title: 'Gagal memuat data jadwal', description, variant: 'destructive' });
        } finally {
            setIsLoadingMaster(false);
        }
    }, []);

    const loadJadwal = useCallback(async () => {
        if (!selectedPeriodeId || !selectedClassId) {
            setJadwalRows([]);
            return;
        }
        setIsLoadingJadwal(true);
        try {
            setJadwalRows(await fetchJadwalList({ periodeId: selectedPeriodeId, classId: selectedClassId }));
        } catch (error) {
            setJadwalRows([]);
            toast({ title: 'Gagal memuat jadwal', description: getScheduleErrorMessage(error), variant: 'destructive' });
        } finally {
            setIsLoadingJadwal(false);
        }
    }, [selectedPeriodeId, selectedClassId]);

    useEffect(() => { loadMasterData(); }, [loadMasterData]);
    useEffect(() => { loadJadwal(); }, [loadJadwal]);

    const jadwalByHari = useMemo(() => groupJadwalByHari(jadwalRows), [jadwalRows]);
    const selectedClass = useMemo(() => classList.find((item) => item.id === selectedClassId), [classList, selectedClassId]);
    const hasAnySlot = jadwalRows.length > 0;

    const openCreateForm = (hari) => {
        setFormData({ ...EMPTY_FORM, class_id: selectedClassId, hari: String(hari || 1) });
        setIsFormOpen(true);
    };

    const openEditForm = (slot) => {
        setFormData({
            id: slot.id,
            class_id: slot.class_id || selectedClassId,
            mata_pelajaran_id: slot.mata_pelajaran_id || '',
            guru_id: slot.guru_id || 'none',
            hari: String(slot.hari ?? 1),
            jam_mulai: formatJam(slot.jam_mulai),
            jam_selesai: formatJam(slot.jam_selesai),
            ruang: slot.ruang || '',
            catatan: slot.catatan || '',
        });
        setIsFormOpen(true);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!selectedPeriodeId) {
            toast({ title: 'Periode belum dipilih', description: 'Pilih periode ajaran terlebih dahulu.', variant: 'destructive' });
            return;
        }
        if (!formData.class_id || !formData.mata_pelajaran_id) {
            toast({ title: 'Data belum lengkap', description: 'Kelas dan mata pelajaran wajib dipilih.', variant: 'destructive' });
            return;
        }
        if (!isJamRangeValid(formData.jam_mulai, formData.jam_selesai)) {
            toast({ title: 'Jam tidak valid', description: 'Jam selesai harus lebih akhir daripada jam mulai.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            if (formData.id) {
                await updateJadwal(formData.id, {
                    class_id: formData.class_id,
                    mata_pelajaran_id: formData.mata_pelajaran_id,
                    guru_id: formData.guru_id === 'none' ? null : formData.guru_id,
                    hari: formData.hari,
                    jam_mulai: formData.jam_mulai,
                    jam_selesai: formData.jam_selesai,
                    ruang: formData.ruang.trim() || null,
                    catatan: formData.catatan.trim() || null,
                });
            } else {
                await createJadwal({
                    periodeId: selectedPeriodeId,
                    classId: formData.class_id,
                    mataPelajaranId: formData.mata_pelajaran_id,
                    guruId: formData.guru_id === 'none' ? null : formData.guru_id,
                    hari: formData.hari,
                    jamMulai: formData.jam_mulai,
                    jamSelesai: formData.jam_selesai,
                    ruang: formData.ruang,
                    catatan: formData.catatan,
                });
            }
            toast({ title: 'Berhasil', description: formData.id ? 'Jadwal berhasil diperbarui.' : 'Jadwal baru berhasil ditambahkan.' });
            setIsFormOpen(false);
            setFormData(EMPTY_FORM);
            await loadJadwal();
        } catch (error) {
            // Pesan 409 (bentrok kelas/guru) sudah ditulis backend untuk pengguna
            // akhir, jadi diteruskan apa adanya.
            toast({ title: 'Gagal menyimpan jadwal', description: getScheduleErrorMessage(error), variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (target) => {
        try {
            await deleteJadwal(target.id);
            toast({ title: 'Berhasil', description: 'Jadwal berhasil dihapus.' });
            await loadJadwal();
        } catch (error) {
            toast({ title: 'Gagal menghapus jadwal', description: getScheduleErrorMessage(error), variant: 'destructive' });
        }
    };

    return (
        <div className="admin-panel space-y-6">
            <div className="admin-panel-header">
                <div className="flex items-center gap-3">
                    <div className="admin-panel-header-icon"><CalendarDays /></div>
                    <div className="admin-panel-header-text">
                        <h2>Jadwal Pelajaran</h2>
                        <p>Susun jadwal mingguan tiap kelas, lengkap dengan guru pengampu dan ruang.</p>
                    </div>
                </div>

                <div className="admin-panel-header-actions">
                    <div className="admin-action-cluster">
                        {canManage && (
                            <button type="button" onClick={() => setIsMapelOpen(true)} className="admin-action-cluster-btn">
                                <BookMarked className="h-3.5 w-3.5" /> Mata Pelajaran
                            </button>
                        )}
                        {canManage && (
                            <button type="button" onClick={() => setIsPeriodeOpen(true)} className="admin-action-cluster-btn">
                                <CalendarRange className="h-3.5 w-3.5" /> Periode
                            </button>
                        )}
                        <button type="button" onClick={loadJadwal} className="admin-action-cluster-btn" disabled={isLoadingJadwal}>
                            <RefreshCw className={`h-3.5 w-3.5 ${isLoadingJadwal ? 'animate-spin' : ''}`} /> Muat Ulang
                        </button>
                    </div>
                    {canManage && (
                        <button type="button" onClick={() => openCreateForm(1)} className="admin-panel-primary-btn" disabled={!selectedPeriodeId || !selectedClassId}>
                            <Plus className="h-4 w-4" /> Tambah Jadwal
                        </button>
                    )}
                </div>
            </div>

            <div className="admin-filter-bar">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="flex-1">
                        <Select value={selectedPeriodeId} onValueChange={setSelectedPeriodeId} disabled={isLoadingMaster || periodeList.length === 0}>
                            <SelectTrigger aria-label="Periode ajaran">
                                <SelectValue placeholder={periodeList.length === 0 ? 'Belum ada periode' : 'Pilih periode ajaran'} />
                            </SelectTrigger>
                            <SelectContent>
                                {periodeList.map((periode) => (
                                    <SelectItem key={periode.id} value={periode.id}>
                                        {getPeriodeLabel(periode)}{periode.is_active ? ' • Aktif' : ''}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex-1">
                        <Select value={selectedClassId} onValueChange={setSelectedClassId} disabled={isLoadingMaster || classList.length === 0}>
                            <SelectTrigger aria-label="Kelas">
                                <SelectValue placeholder={classList.length === 0 ? 'Belum ada kelas' : 'Pilih kelas'} />
                            </SelectTrigger>
                            <SelectContent>
                                {classList.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>{item.nama_kelas}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <p className="text-xs font-medium text-muted-foreground sm:w-40 sm:text-right">
                        {selectedClass ? `${jadwalRows.length} jam pelajaran` : 'Kelas belum dipilih'}
                    </p>
                </div>
            </div>

            {loadError && (
                <div className="admin-error-state" role="alert">
                    <p className="text-sm font-medium">{loadError}</p>
                    <Button variant="outline" size="sm" onClick={loadMasterData} className="ml-auto flex-shrink-0">Coba Lagi</Button>
                </div>
            )}

            {(isLoadingMaster || isLoadingJadwal) && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-6" aria-busy="true" aria-label="Memuat jadwal">
                    {HARI_OPTIONS.map((day) => (
                        <Skeleton key={day.value} className="admin-skeleton-shimmer h-56 rounded-2xl" />
                    ))}
                </div>
            )}

            {!isLoadingMaster && !isLoadingJadwal && !loadError && !selectedPeriodeId && (
                <div className="admin-empty-state">
                    <CalendarRange className="admin-empty-state-icon" aria-hidden="true" />
                    <p className="admin-empty-state-title">Belum ada periode ajaran</p>
                    <p className="admin-empty-state-description">Buat periode ajaran terlebih dahulu melalui tombol Periode di atas.</p>
                </div>
            )}

            {!isLoadingMaster && !isLoadingJadwal && !loadError && selectedPeriodeId && !selectedClassId && (
                <div className="admin-empty-state">
                    <DoorOpen className="admin-empty-state-icon" aria-hidden="true" />
                    <p className="admin-empty-state-title">Belum ada kelas</p>
                    <p className="admin-empty-state-description">Tambahkan kelas pada panel Manajemen Kelas sebelum menyusun jadwal.</p>
                </div>
            )}

            {!isLoadingMaster && !isLoadingJadwal && !loadError && selectedPeriodeId && selectedClassId && !hasAnySlot && (
                <div className="admin-empty-state">
                    <CalendarX2 className="admin-empty-state-icon" aria-hidden="true" />
                    <p className="admin-empty-state-title">Belum ada jadwal untuk kelas ini</p>
                    <p className="admin-empty-state-description">
                        {canManage
                            ? 'Mulai susun jadwal mingguan dengan menekan tombol Tambah Jadwal.'
                            : 'Jadwal untuk kelas ini belum disusun oleh petugas.'}
                    </p>
                    {canManage && (
                        <Button className="mt-4" onClick={() => openCreateForm(1)}>
                            <Plus className="mr-1.5 h-4 w-4" /> Tambah Jadwal
                        </Button>
                    )}
                </div>
            )}

            {/* Grid mingguan. Satu pohon DOM saja: di bawah lg tiap hari menjadi
                kartu selebar layar yang menumpuk vertikal, jadi tidak ada scroll
                horizontal di mobile. */}
            {!isLoadingMaster && !isLoadingJadwal && !loadError && selectedPeriodeId && selectedClassId && hasAnySlot && (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-6">
                    {HARI_OPTIONS.map((day) => (
                        <DayColumn
                            key={day.value}
                            day={day}
                            slots={jadwalByHari[day.value] || []}
                            canManage={canManage}
                            onEdit={openEditForm}
                            onDelete={(slot) => setConfirmState({ isOpen: true, target: slot })}
                            onAdd={openCreateForm}
                        />
                    ))}
                </div>
            )}

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{formData.id ? 'Edit Jadwal' : 'Tambah Jadwal'}</DialogTitle>
                        <DialogDescription>
                            Periode {getPeriodeLabel(periodeList.find((item) => item.id === selectedPeriodeId)) || '-'}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="admin-edit-section">
                        <div className="admin-edit-field-grid">
                            <div className="admin-edit-field">
                                <label htmlFor="jadwal-kelas">Kelas</label>
                                <Select value={formData.class_id} onValueChange={(value) => setFormData({ ...formData, class_id: value })}>
                                    <SelectTrigger id="jadwal-kelas"><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                                    <SelectContent>
                                        {classList.map((item) => <SelectItem key={item.id} value={item.id}>{item.nama_kelas}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="admin-edit-field">
                                <label htmlFor="jadwal-hari">Hari</label>
                                <Select value={formData.hari} onValueChange={(value) => setFormData({ ...formData, hari: value })}>
                                    <SelectTrigger id="jadwal-hari"><SelectValue placeholder="Pilih hari" /></SelectTrigger>
                                    <SelectContent>
                                        {HARI_OPTIONS.map((day) => <SelectItem key={day.value} value={String(day.value)}>{day.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="admin-edit-field">
                                <label htmlFor="jadwal-jam-mulai">Jam Mulai</label>
                                <Input id="jadwal-jam-mulai" type="time" value={formData.jam_mulai} onChange={(e) => setFormData({ ...formData, jam_mulai: e.target.value })} required />
                            </div>
                            <div className="admin-edit-field">
                                <label htmlFor="jadwal-jam-selesai">Jam Selesai</label>
                                <Input id="jadwal-jam-selesai" type="time" value={formData.jam_selesai} onChange={(e) => setFormData({ ...formData, jam_selesai: e.target.value })} required />
                            </div>
                            <div className="admin-edit-field">
                                <label htmlFor="jadwal-mapel">Mata Pelajaran</label>
                                <Select value={formData.mata_pelajaran_id} onValueChange={(value) => setFormData({ ...formData, mata_pelajaran_id: value })}>
                                    <SelectTrigger id="jadwal-mapel"><SelectValue placeholder="Pilih mata pelajaran" /></SelectTrigger>
                                    <SelectContent>
                                        {mapelList.map((item) => <SelectItem key={item.id} value={item.id}>{item.nama}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="admin-edit-field">
                                <label htmlFor="jadwal-guru">Guru Pengampu <span className="normal-case font-normal opacity-70">(opsional)</span></label>
                                <Select value={formData.guru_id} onValueChange={(value) => setFormData({ ...formData, guru_id: value })}>
                                    <SelectTrigger id="jadwal-guru"><SelectValue placeholder="Pilih guru" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Belum ditentukan</SelectItem>
                                        {guruList.map((guru) => <SelectItem key={guru.id} value={guru.id}>{guru.nama}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="admin-edit-field">
                                <label htmlFor="jadwal-ruang">Ruang <span className="normal-case font-normal opacity-70">(opsional)</span></label>
                                <Input id="jadwal-ruang" value={formData.ruang} onChange={(e) => setFormData({ ...formData, ruang: e.target.value })} placeholder="Contoh: Ruang 3A" />
                            </div>
                            <div className="admin-edit-field admin-edit-field-full">
                                <label htmlFor="jadwal-catatan">Catatan <span className="normal-case font-normal opacity-70">(opsional)</span></label>
                                <Textarea id="jadwal-catatan" rows={3} value={formData.catatan} onChange={(e) => setFormData({ ...formData, catatan: e.target.value })} placeholder="Catatan tambahan untuk jam pelajaran ini" />
                            </div>
                        </div>
                        <div className="admin-edit-footer-actions mt-4">
                            <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>Batal</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                                {isSaving ? 'Menyimpan...' : 'Simpan Jadwal'}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>

            <MataPelajaranDialog
                open={isMapelOpen}
                onOpenChange={setIsMapelOpen}
                items={mapelList}
                isLoading={isLoadingMaster}
                onChanged={loadMasterData}
                canManage={canManage}
            />

            <PeriodeDialog
                open={isPeriodeOpen}
                onOpenChange={setIsPeriodeOpen}
                items={periodeList}
                isLoading={isLoadingMaster}
                onChanged={loadMasterData}
                canManage={canManage}
            />

            <ConfirmationDialog
                isOpen={confirmState.isOpen}
                onClose={() => setConfirmState({ isOpen: false, target: null })}
                onConfirm={() => { if (confirmState.target) handleDelete(confirmState.target); }}
                title="Hapus Jadwal"
                description={confirmState.target
                    ? `Jadwal ${confirmState.target.mata_pelajaran_nama || ''} pukul ${formatJamRange(confirmState.target.jam_mulai, confirmState.target.jam_selesai)} akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.`
                    : ''}
                confirmText="Ya, Hapus"
            />
        </div>
    );
};

export default JadwalPelajaran;
