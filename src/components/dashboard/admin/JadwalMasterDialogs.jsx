import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ConfirmationDialog from '@/components/ui/confirmation-dialog';
import { toast } from '@/components/ui/use-toast';
import { BookMarked, CalendarRange, Check, Edit, Loader2, Plus, Trash2, X } from 'lucide-react';
import {
    SEMESTER_OPTIONS,
    activatePeriode,
    createMataPelajaran,
    createPeriode,
    deleteMataPelajaran,
    deletePeriode,
    getScheduleErrorMessage,
    isValidTahunAjaran,
    updateMataPelajaran,
    updatePeriode,
} from '@/lib/scheduleAdapters';

const EMPTY_MAPEL = { id: null, nama: '', kode: '', urutan: '' };
const EMPTY_PERIODE = { id: null, nama: '', tahun_ajaran: '', semester: 'Ganjil', tanggal_mulai: '', tanggal_selesai: '', is_active: false };

/**
 * Dialog master data mata pelajaran. Semua mutasi dikirim lewat scheduleAdapters
 * lalu memanggil `onChanged` supaya panel induk memuat ulang daftar terbaru.
 */
export const MataPelajaranDialog = ({ open, onOpenChange, items = [], isLoading = false, onChanged, canManage = true }) => {
    const [form, setForm] = useState(EMPTY_MAPEL);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmState, setConfirmState] = useState({ isOpen: false, target: null });

    const resetForm = () => setForm(EMPTY_MAPEL);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const nama = form.nama.trim();
        if (!nama) {
            toast({ title: 'Nama wajib diisi', description: 'Isi nama mata pelajaran terlebih dahulu.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            if (form.id) {
                await updateMataPelajaran(form.id, {
                    nama,
                    kode: form.kode.trim() || null,
                    urutan: form.urutan === '' ? null : Number(form.urutan),
                });
            } else {
                await createMataPelajaran({ nama, kode: form.kode, urutan: form.urutan === '' ? null : form.urutan });
            }
            toast({ title: 'Berhasil', description: `Mata pelajaran "${nama}" tersimpan.` });
            resetForm();
            await onChanged?.();
        } catch (error) {
            toast({ title: 'Gagal menyimpan', description: getScheduleErrorMessage(error), variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (target) => {
        try {
            await deleteMataPelajaran(target.id);
            toast({ title: 'Berhasil', description: `Mata pelajaran "${target.nama}" dinonaktifkan.` });
            if (form.id === target.id) resetForm();
            await onChanged?.();
        } catch (error) {
            toast({ title: 'Gagal menonaktifkan', description: getScheduleErrorMessage(error), variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><BookMarked className="w-5 h-5" /> Mata Pelajaran</DialogTitle>
                    <DialogDescription>Kelola daftar mata pelajaran yang dapat dipakai pada jadwal.</DialogDescription>
                </DialogHeader>

                {canManage && (
                <form onSubmit={handleSubmit} className="admin-edit-section">
                    <div className="admin-edit-field-grid">
                        <div className="admin-edit-field admin-edit-field-full">
                            <label htmlFor="mapel-nama">Nama Mata Pelajaran</label>
                            <Input id="mapel-nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: Matematika" required />
                        </div>
                        <div className="admin-edit-field">
                            <label htmlFor="mapel-kode">Kode <span className="normal-case font-normal opacity-70">(opsional)</span></label>
                            <Input id="mapel-kode" value={form.kode} onChange={(e) => setForm({ ...form, kode: e.target.value })} placeholder="MTK" />
                        </div>
                        <div className="admin-edit-field">
                            <label htmlFor="mapel-urutan">Urutan <span className="normal-case font-normal opacity-70">(opsional)</span></label>
                            <Input id="mapel-urutan" type="number" min="0" value={form.urutan} onChange={(e) => setForm({ ...form, urutan: e.target.value })} placeholder="1" />
                        </div>
                    </div>
                    <div className="admin-edit-footer-actions mt-4">
                        {form.id && (
                            <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                                <X className="w-4 h-4 mr-1.5" /> Batal Edit
                            </Button>
                        )}
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                            {form.id ? 'Simpan Perubahan' : 'Tambah Mata Pelajaran'}
                        </Button>
                    </div>
                </form>
                )}

                <div className="max-h-[45vh] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {isLoading && (
                        <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" /> Memuat mata pelajaran...
                        </p>
                    )}
                    {!isLoading && items.length === 0 && (
                        <p className="py-8 text-center text-sm text-muted-foreground">Belum ada mata pelajaran.</p>
                    )}
                    {!isLoading && items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-xl border border-white/60 bg-white/50 px-3 py-2 transition-colors hover:bg-white/80 dark:border-slate-700/60 dark:bg-slate-900/40 dark:hover:bg-slate-900/70">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                                {item.urutan ?? '–'}
                            </span>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{item.nama}</p>
                                {item.kode && <p className="text-xs text-muted-foreground">{item.kode}</p>}
                            </div>
                            {canManage && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${item.nama}`} onClick={() => setForm({ id: item.id, nama: item.nama || '', kode: item.kode || '', urutan: item.urutan ?? '' })}>
                                <Edit className="w-4 h-4" />
                            </Button>
                            )}
                            {canManage && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" aria-label={`Nonaktifkan ${item.nama}`} onClick={() => setConfirmState({ isOpen: true, target: item })}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                            )}
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
                </DialogFooter>

                <ConfirmationDialog
                    isOpen={confirmState.isOpen}
                    onClose={() => setConfirmState({ isOpen: false, target: null })}
                    onConfirm={() => { if (confirmState.target) handleDelete(confirmState.target); }}
                    title="Nonaktifkan Mata Pelajaran"
                    description={`Mata pelajaran "${confirmState.target?.nama || ''}" akan dinonaktifkan dan tidak lagi muncul saat menyusun jadwal baru. Jadwal yang sudah ada tetap tersimpan.`}
                    confirmText="Ya, Nonaktifkan"
                />
            </DialogContent>
        </Dialog>
    );
};

/**
 * Dialog master data periode ajaran. Backend menjamin hanya satu periode aktif,
 * jadi menandai satu periode aktif otomatis menonaktifkan sisanya.
 */
export const PeriodeDialog = ({ open, onOpenChange, items = [], isLoading = false, onChanged, canManage = true }) => {
    const [form, setForm] = useState(EMPTY_PERIODE);
    const [isSaving, setIsSaving] = useState(false);
    const [confirmState, setConfirmState] = useState({ isOpen: false, target: null });

    const resetForm = () => setForm(EMPTY_PERIODE);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const nama = form.nama.trim();
        const tahunAjaran = form.tahun_ajaran.trim();
        if (!nama) {
            toast({ title: 'Nama wajib diisi', description: 'Isi nama periode terlebih dahulu.', variant: 'destructive' });
            return;
        }
        if (!isValidTahunAjaran(tahunAjaran)) {
            toast({ title: 'Format tahun ajaran salah', description: 'Gunakan format 2026/2027.', variant: 'destructive' });
            return;
        }
        setIsSaving(true);
        try {
            const payload = {
                nama,
                tahun_ajaran: tahunAjaran,
                semester: form.semester,
                tanggal_mulai: form.tanggal_mulai || null,
                tanggal_selesai: form.tanggal_selesai || null,
                is_active: Boolean(form.is_active),
            };
            if (form.id) await updatePeriode(form.id, payload);
            else await createPeriode({
                nama, tahunAjaran, semester: form.semester,
                tanggalMulai: form.tanggal_mulai, tanggalSelesai: form.tanggal_selesai, isActive: form.is_active,
            });
            toast({ title: 'Berhasil', description: `Periode "${nama}" tersimpan.` });
            resetForm();
            await onChanged?.();
        } catch (error) {
            toast({ title: 'Gagal menyimpan', description: getScheduleErrorMessage(error), variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleActivate = async (item) => {
        try {
            await activatePeriode(item.id);
            toast({ title: 'Berhasil', description: `Periode "${item.nama}" kini aktif.` });
            await onChanged?.();
        } catch (error) {
            toast({ title: 'Gagal mengaktifkan', description: getScheduleErrorMessage(error), variant: 'destructive' });
        }
    };

    const handleDelete = async (target) => {
        try {
            await deletePeriode(target.id);
            toast({ title: 'Berhasil', description: `Periode "${target.nama}" dihapus.` });
            if (form.id === target.id) resetForm();
            await onChanged?.();
        } catch (error) {
            toast({ title: 'Gagal menghapus', description: getScheduleErrorMessage(error), variant: 'destructive' });
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><CalendarRange className="w-5 h-5" /> Periode Ajaran</DialogTitle>
                    <DialogDescription>Kelola tahun ajaran dan semester. Hanya satu periode yang dapat aktif.</DialogDescription>
                </DialogHeader>

                {canManage && (
                <form onSubmit={handleSubmit} className="admin-edit-section">
                    <div className="admin-edit-field-grid">
                        <div className="admin-edit-field admin-edit-field-full">
                            <label htmlFor="periode-nama">Nama Periode</label>
                            <Input id="periode-nama" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Contoh: 2026/2027 Ganjil" required />
                        </div>
                        <div className="admin-edit-field">
                            <label htmlFor="periode-tahun">Tahun Ajaran</label>
                            <Input id="periode-tahun" value={form.tahun_ajaran} onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })} placeholder="2026/2027" required />
                        </div>
                        <div className="admin-edit-field">
                            <label htmlFor="periode-semester">Semester</label>
                            <Select value={form.semester} onValueChange={(value) => setForm({ ...form, semester: value })}>
                                <SelectTrigger id="periode-semester"><SelectValue placeholder="Pilih semester" /></SelectTrigger>
                                <SelectContent>
                                    {SEMESTER_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="admin-edit-field">
                            <label htmlFor="periode-mulai">Tanggal Mulai <span className="normal-case font-normal opacity-70">(opsional)</span></label>
                            <Input id="periode-mulai" type="date" value={form.tanggal_mulai || ''} onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })} />
                        </div>
                        <div className="admin-edit-field">
                            <label htmlFor="periode-selesai">Tanggal Selesai <span className="normal-case font-normal opacity-70">(opsional)</span></label>
                            <Input id="periode-selesai" type="date" value={form.tanggal_selesai || ''} onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })} />
                        </div>
                    </div>
                    <div className="mt-4 flex min-h-11 items-center gap-2 rounded-xl border border-white/70 bg-white/50 px-3 py-2 dark:border-slate-700/70 dark:bg-slate-900/40">
                        <Checkbox id="periode-aktif" checked={Boolean(form.is_active)} onCheckedChange={(checked) => setForm({ ...form, is_active: Boolean(checked) })} />
                        <label htmlFor="periode-aktif" className="cursor-pointer select-none text-sm font-medium">Jadikan periode aktif</label>
                    </div>
                    <div className="admin-edit-footer-actions mt-4">
                        {form.id && (
                            <Button type="button" variant="outline" onClick={resetForm} disabled={isSaving}>
                                <X className="w-4 h-4 mr-1.5" /> Batal Edit
                            </Button>
                        )}
                        <Button type="submit" disabled={isSaving}>
                            {isSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
                            {form.id ? 'Simpan Perubahan' : 'Tambah Periode'}
                        </Button>
                    </div>
                </form>
                )}

                <div className="max-h-[40vh] overflow-y-auto custom-scrollbar space-y-2 pr-1">
                    {isLoading && (
                        <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                            <Loader2 className="w-4 h-4 animate-spin" /> Memuat periode...
                        </p>
                    )}
                    {!isLoading && items.length === 0 && (
                        <p className="py-8 text-center text-sm text-muted-foreground">Belum ada periode ajaran.</p>
                    )}
                    {!isLoading && items.map((item) => (
                        <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/60 bg-white/50 px-3 py-2 dark:border-slate-700/60 dark:bg-slate-900/40">
                            <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-2 truncate text-sm font-semibold">
                                    {item.nama}
                                    {item.is_active && (
                                        <span className="admin-status-badge admin-status-badge--success inline-flex items-center gap-1">
                                            <Check className="w-3 h-3" /> Aktif
                                        </span>
                                    )}
                                </p>
                                <p className="text-xs text-muted-foreground">{item.tahun_ajaran} • Semester {item.semester}</p>
                            </div>
                            {canManage && !item.is_active && (
                                <Button type="button" variant="outline" size="sm" onClick={() => handleActivate(item)}>Aktifkan</Button>
                            )}
                            {canManage && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={`Edit ${item.nama}`} onClick={() => setForm({
                                id: item.id,
                                nama: item.nama || '',
                                tahun_ajaran: item.tahun_ajaran || '',
                                semester: item.semester || 'Ganjil',
                                tanggal_mulai: item.tanggal_mulai ? String(item.tanggal_mulai).slice(0, 10) : '',
                                tanggal_selesai: item.tanggal_selesai ? String(item.tanggal_selesai).slice(0, 10) : '',
                                is_active: Boolean(item.is_active),
                            })}>
                                <Edit className="w-4 h-4" />
                            </Button>
                            )}
                            {canManage && (
                            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" aria-label={`Hapus ${item.nama}`} onClick={() => setConfirmState({ isOpen: true, target: item })}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                            )}
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
                </DialogFooter>

                <ConfirmationDialog
                    isOpen={confirmState.isOpen}
                    onClose={() => setConfirmState({ isOpen: false, target: null })}
                    onConfirm={() => { if (confirmState.target) handleDelete(confirmState.target); }}
                    title="Hapus Periode Ajaran"
                    description={`Periode "${confirmState.target?.nama || ''}" akan dihapus permanen beserta SELURUH jadwal pelajaran di dalamnya. Tindakan ini tidak dapat dibatalkan.`}
                    confirmText="Ya, Hapus"
                />
            </DialogContent>
        </Dialog>
    );
};
