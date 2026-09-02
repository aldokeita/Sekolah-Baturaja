#!/usr/bin/env bash
#
# Backup terjadwal untuk SDN Baturaja. Dijalankan di VPS, dari akar proyek.
#
# Mengambil DUA hal, dan keduanya wajib:
#   1. seluruh basis data lewat pg_dump
#   2. volume `uploads` milik layanan api — foto guru dan murid, berkas unggahan
#
# Nomor 2 mudah terlupakan. Basis data hanya menyimpan JALUR berkasnya, jadi
# backup yang hanya pg_dump akan pulih dengan setiap foto hilang dan tidak ada
# satu pun pesan galat yang memberi tahu.
#
# Panel Backup & Restore di aplikasi TIDAK menggantikan skrip ini: ia mengekspor
# 13 tabel yang diizinkan sebagai JSON dari peramban, sementara jadwal pelajaran,
# nilai, periode ajaran, user_profiles, dan tabel rapor tidak termasuk.
#
# Pemakaian:
#   ./scripts/backup-sekolah.sh [folder-tujuan] [simpan-berapa-hari]
#
# Bawaan: folder ./backup, simpan 30 hari.
#
# Keluar dengan status bukan nol bila gagal, supaya cron mengirim surel dan
# kegagalannya tidak lewat tanpa disadari.

set -euo pipefail

AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE="$AKAR/backend/docker-compose.yml"
TUJUAN="${1:-$AKAR/backup}"
SIMPAN_HARI="${2:-30}"
CAP="$(date +%Y%m%d-%H%M%S)"

pesan() { printf '%s  %s\n' "$(date +'%Y-%m-%d %H:%M:%S')" "$*"; }
gagal() { pesan "GAGAL: $*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || gagal "docker tidak ada di PATH."
[ -f "$COMPOSE" ] || gagal "tidak menemukan $COMPOSE."
mkdir -p "$TUJUAN" || gagal "tidak bisa membuat folder $TUJUAN."

DB_GZ="$TUJUAN/db-$CAP.sql.gz"
UPLOADS_TGZ="$TUJUAN/uploads-$CAP.tar.gz"

# ── 1. Basis data ───────────────────────────────────────────────────────────
# `exec -T` tanpa TTY supaya keluarannya biner bersih saat dijalankan cron.
# Tanpa kata sandi: container disetel --auth-local=trust untuk soket lokal.
pesan "Membuat dump basis data..."
if ! docker compose -f "$COMPOSE" exec -T db \
        pg_dump -U postgres -d lpq_db --clean --if-exists \
     | gzip -9 > "$DB_GZ"; then
    rm -f "$DB_GZ"
    gagal "pg_dump tidak berhasil. Pastikan container db menyala."
fi

# Periksa hasilnya SEBELUM apa pun dihapus. Pipa di atas bisa menghasilkan
# berkas gz yang utuh tetapi kosong bila pg_dump mati di tengah jalan.
gzip -t "$DB_GZ" 2>/dev/null || gagal "berkas $DB_GZ rusak."
UKURAN_DB="$(wc -c < "$DB_GZ")"
[ "$UKURAN_DB" -gt 2048 ] || gagal "dump basis data hanya $UKURAN_DB byte — terlalu kecil untuk benar."
zgrep -q "CREATE TABLE" "$DB_GZ" || gagal "dump tidak memuat satu pun CREATE TABLE."

# ── 2. Volume uploads ───────────────────────────────────────────────────────
# Volume-nya diambil lewat --volumes-from container api, bukan dengan menebak
# nama volume: nama itu diawali nama proyek compose dan berubah kalau foldernya
# diganti nama.
pesan "Mengarsipkan berkas unggahan..."
API_CID="$(docker compose -f "$COMPOSE" ps -q api || true)"
if [ -z "$API_CID" ]; then
    pesan "PERINGATAN: container api tidak ditemukan, volume uploads DILEWATI."
    pesan "PERINGATAN: backup ini TIDAK lengkap — foto tidak ikut."
else
    if ! docker run --rm --volumes-from "$API_CID" \
            -v "$TUJUAN":/backup alpine:3 \
            tar czf "/backup/$(basename "$UPLOADS_TGZ")" -C /app/uploads . ; then
        rm -f "$UPLOADS_TGZ"
        gagal "pengarsipan volume uploads tidak berhasil."
    fi
    tar tzf "$UPLOADS_TGZ" >/dev/null 2>&1 || gagal "arsip $UPLOADS_TGZ rusak."
fi

# ── 3. Buang yang lama, hanya setelah yang baru terbukti baik ───────────────
pesan "Menghapus backup lebih tua dari $SIMPAN_HARI hari..."
find "$TUJUAN" -maxdepth 1 -type f -name 'db-*.sql.gz'      -mtime "+$SIMPAN_HARI" -print -delete
find "$TUJUAN" -maxdepth 1 -type f -name 'uploads-*.tar.gz' -mtime "+$SIMPAN_HARI" -print -delete

pesan "Selesai. $(du -h "$DB_GZ" | cut -f1) basis data$( [ -f "$UPLOADS_TGZ" ] && printf ', %s berkas unggahan' "$(du -h "$UPLOADS_TGZ" | cut -f1)" )."
pesan "Tersimpan di $TUJUAN"
pesan "INGAT: backup yang hanya ada di server yang sama tidak melindungi dari server hilang. Salin ke luar."
