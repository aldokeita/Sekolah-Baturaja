# AGENTS.md — src/lib/

Adapter layer dan utilitas inti. Semua akses data dari frontend melewati modul di sini.

## Arsitektur

```
apiClient.js              → HTTP client terpusat (GET/POST/PUT/DELETE + JWT refresh)
*Adapters.js              → Satu file per domain, memanggil apiClient
featureFlags.js           → Toggle fitur (game, edge function, backup)
```

Komponen **TIDAK BOLEH** memanggil API langsung. Semua request harus melalui adapter.

## Daftar adapter

| File | Domain | Endpoint prefix |
|------|--------|-----------------|
| `academicAdapters.js` | Hafalan, kalender, progress | `/api/academic/*`, `/api/attendance/calendar` |
| `attendanceAdapters.js` | Absensi santri & guru | `/api/attendance/*` |
| `appConfigAdapters.js` | Konfigurasi aplikasi | `/api/config/*` |
| `dataMasterAdapters.js` | Santri, guru, kelas, mutasi | `/api/santri/*`, `/api/guru/*`, `/api/classes/*` |
| `financeAdapters.js` | Expense & cashflow | `/api/expenses/*` |
| `gamificationAdapters.js` | Poin & reward santri | `/api/gamification/*` |
| `loginSecurityAdapters.js` | Log login & rate limit | `/api/auth/login-logs/*` |
| `mediaPlayerAdapters.js` | Musik/media player | `/api/media/*` |
| `rapatGuruAdapters.js` | Rapat guru (absensi, notulensi, jadwal) | `/api/mmq/*` |
| `paymentAdapters.js` | Pembayaran SPP | `/api/payments/*` |
| `publicContentAdapters.js` | Konten publik website | `/api/content/*` |
| `santriArchiveAdapters.js` | Arsip santri non-aktif | `/api/santri/archive/*` |
| `storageAdapters.js` | Upload file (avatar, asset) | `/api/storage/*` |
| `whatsappGroupLinksAdapters.js` | Link grup WA | `/api/whatsapp/groups/*` |
| `whatsappTemplateAdapters.js` | Template pesan WA | `/api/whatsapp/templates/*` |
| `edgeFunctionAdapters.js` | Supabase edge functions | Via Supabase client |

## Utilitas non-adapter

| File | Fungsi |
|------|--------|
| `utils.js` | Helper umum (format tanggal, currency, dsb) |
| `birthdayUtils.js` | Kalkulasi ulang tahun santri |
| `clipboardUtils.js` | Copy ke clipboard |
| `santriLevel.js` | Mapping level/jilid santri |
| `attendanceConfiguration.js` | Konstanta konfigurasi absensi |
| `dcStyle.js` | Style helper untuk dc-convert |
| `enrollmentContent.js` | Konten statis pendaftaran |
| `institutionContent.js` | Profil institusi |
| `schoolProfile.js` | Data profil sekolah |

## Konvensi

- Setiap adapter export named functions, bukan default export
- Pattern: `export const fetchX = async (filters) => apiClient.get('/api/...')`
- Adapter TIDAK menyimpan state — stateless, pure fetch
- Error propagation: adapter throw, komponen catch
- `apiClient.js` handle JWT refresh otomatis di interceptor 401
- `publicFetch` untuk endpoint tanpa auth (halaman publik)

## Anti-pattern

- JANGAN import `supabase` client langsung dari komponen — gunakan adapter
- JANGAN buat adapter baru tanpa endpoint backend yang sesuai
- JANGAN hardcode URL API — gunakan `apiClient` yang sudah configured
- JANGAN campur logic UI di adapter — adapter hanya data fetching
