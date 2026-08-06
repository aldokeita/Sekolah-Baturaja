# AGENTS.md — src/components/dashboard/admin/

36 panel manajemen admin. Setiap file = satu fitur/domain admin dashboard.

## Struktur

Tidak ada subdirektori. Setiap `.jsx` file adalah satu panel admin yang di-render oleh `AdminDashboard.jsx` (parent di `src/components/dashboard/`).

## Kategori panel

### Data Master
| Panel | File | Fungsi |
|-------|------|--------|
| Data Murid | `SantriManagement.jsx` | CRUD murid, profil, status aktif — satu tabel, tanpa kategori |
| Guru | `GuruManagement.jsx` | CRUD guru, profil pengajar |
| Kelas | `ClassManagement.jsx` | CRUD kelas, assign guru/murid — satu daftar, tanpa sub-tab kategori |
| User | `UserManagement.jsx` | Manajemen akun login & role |
| Arsip Santri | `SantriArchiveDialog.jsx` | Dialog arsip santri non-aktif |

### Absensi
| Panel | File | Fungsi |
|-------|------|--------|
| Absensi Digital | `DigitalAttendance.jsx` | Input absensi harian |
| Rekap Absensi | `AttendanceRecap.jsx` | Rekap absensi santri per periode |
| Rekap Guru | `GuruAttendanceRecap.jsx` | Rekap absensi guru |
| Konfigurasi | `AttendanceConfiguration.jsx` | Setting jam masuk, toleransi |
| Kalender | `CalendarManagement.jsx` | Kalender akademik & hari libur |
| TV Display | `TvDisplaySettings.jsx` | Setting tampilan TV absensi |

### Keuangan
| Panel | File | Fungsi |
|-------|------|--------|
| Pembayaran | `PaymentSystem.jsx` | Input & kelola pembayaran SPP |
| Riwayat | `PaymentHistory.jsx` | History pembayaran per santri |
| Rekap | `PaymentRecap.jsx` | Rekap keuangan per periode |
| Edit | `EditPaymentModal.jsx` | Modal edit detail pembayaran |
| Bukti | `PaymentProofModal.jsx` | Modal upload/lihat bukti bayar |
| Catatan | `PaymentNotes.jsx` | Catatan pembayaran |
| Pengeluaran | `ExpenseManagement.jsx` | CRUD pengeluaran operasional |
| Gaji | `SalaryCalculation.jsx` | Kalkulasi gaji guru |

### Akademik
| Panel | File | Fungsi |
|-------|------|--------|
| Hafalan Item | `HafalanItemDraggable.jsx` | Drag-and-drop urutan item hafalan |
| Performa Jilid | `JilidPerformanceChart.jsx` | Chart performa per jilid |
| Ubah Jilid | `JilidChangeModal.jsx` | Modal pindah jilid santri |
| Performa Kelas | `ClassPerformanceModal.jsx` | Modal statistik performa kelas |
| Performa Guru | `GuruPerformanceSummary.jsx` | Ringkasan performa guru |

### MMQ & Lainnya
| Panel | File | Fungsi |
|-------|------|--------|
| MMQ | `MMQManagement.jsx` | Majlis Mudzakarah Qiroati |
| MMQ Absensi | `MMQAttendanceModal.jsx` | Absensi peserta MMQ |
| MMQ Jadwal | `MMQScheduleForm.jsx` | Form jadwal MMQ |
| Konten | `ContentManagement.jsx` | Kelola konten website publik |
| Media Player | `MediaPlayerSettings.jsx` | Setting audio player |
| Game Config | `GameConfiguration.jsx` | Konfigurasi fitur game |
| Gatcha | `GatchaSettings.jsx` | Setting gatcha reward |
| Login Logs | `LoginLogs.jsx` | Monitor log login pengguna |
| Backup | `BackupRestoreManagement.jsx` | Backup & restore data |
| Visitor Stats | `VisitorStats.jsx` | Statistik pengunjung |

## Konvensi

- Semua panel menggunakan adapter dari `src/lib/*Adapters.js` — tidak ada query langsung
- Pattern umum: `useState` + `useEffect` fetch on mount + CRUD handlers
- Modal menggunakan komponen dari `src/components/ui/` (shadcn dialog/sheet)
- Widget bersama ada di `src/components/dashboard/shared/`
- Loading/error/empty state wajib ada di setiap panel

## Anti-pattern

- JANGAN tambah panel tanpa adapter endpoint yang sudah tersedia di backend
- JANGAN duplikasi logic fetch — gunakan adapter yang sudah ada
- JANGAN buat komponen >500 baris — pecah ke sub-komponen atau pindahkan logic ke custom hook
