// roles.js — satu tempat untuk pertanyaan "apakah peran ini boleh?".
//
// Kenapa ada berkas ini: `superadmin` adalah superset `admin` — pemilik/penjual
// template. Di backend hal itu sudah ditangani sekali lewat `middleware.IsAdmin`,
// tapi di sisi UI dulu tersebar sebagai `role === 'admin'` di belasan komponen.
// Setiap tempat yang terlewat membuat superadmin kehilangan tombol yang mestinya
// ada — bukan galat yang kelihatan, hanya kontrol yang senyap menghilang.
//
// Ini hanya untuk menyembunyikan kontrol yang mati. Penjagaan yang sebenarnya
// tetap di Go (lihat backend/internal/middleware/auth.go).

export const ROLE_SUPERADMIN = 'superadmin';

/** Admin atau superadmin — pemegang kendali penuh sistem. */
export const isAdminRole = (role) => role === 'admin' || role === ROLE_SUPERADMIN;

/** Hanya penjual template: yang boleh mengubah identitas produk. */
export const isSuperadminRole = (role) => role === ROLE_SUPERADMIN;

/** Admin, superadmin, atau tata usaha — boleh mengelola data operasional. */
export const canManageRole = (role) => isAdminRole(role) || role === 'tata_usaha';
