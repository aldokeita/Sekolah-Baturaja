import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WHATSAPP_TEMPLATES,
  normalizeWhatsAppTemplates,
  renderWhatsAppTemplate,
} from '@/lib/whatsappTemplateAdapters';

/* Template PPDB dikirim ke orang tua calon murid, dan pengirimannya manual: petugas
 * menekan tombol, WhatsApp terbuka, lalu dia menekan kirim. Artinya tidak ada
 * lapisan lain yang akan menangkap kesalahan sebelum pesannya sampai — satu nama
 * penanda yang salah tulis akan terkirim sebagai "-" ke orang tua. */
describe('template PPDB', () => {
  const KUNCI = ['ppdbDiverifikasi', 'ppdbDiterima', 'ppdbDitolak'];

  // Persis yang dikirim PpdbRegistrations.jsx pada kabariOrangTua.
  const VARIABEL = {
    nama_santri: 'Zahra Nur Fadhilah',
    nama_ortu: 'Dewi Lestari',
    nomor_pendaftaran: 'PPDB-2026-0001',
    tahun_ajaran: '2026/2027',
    jalur: 'Zonasi',
    telepon: '(0735) 320145',
    nama_lembaga: 'Sekolah Dasar Negeri Baturaja',
  };

  it.each(KUNCI)('%s ada di bawaan dan tidak kosong', (kunci) => {
    expect(DEFAULT_WHATSAPP_TEMPLATES[kunci]).toBeTruthy();
    expect(DEFAULT_WHATSAPP_TEMPLATES[kunci].trim().length).toBeGreaterThan(80);
  });

  /* Penanda yang tidak terisi adalah kegagalan yang paling mungkin dan paling
   * memalukan: pesannya tetap terkirim, hanya dengan tanda hubung di tempat nama
   * anak. */
  it.each(KUNCI)('%s tidak menyisakan penanda yang belum terisi', (kunci) => {
    const hasil = renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES[kunci], VARIABEL);
    expect(hasil).not.toMatch(/\{\{/);
    expect(hasil).not.toContain('undefined');
  });

  it.each(KUNCI)('%s menyebut nama anak, nomor pendaftaran, dan nama sekolah', (kunci) => {
    const hasil = renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES[kunci], VARIABEL);
    expect(hasil).toContain(VARIABEL.nama_santri);
    expect(hasil).toContain(VARIABEL.nomor_pendaftaran);
    expect(hasil).toContain(VARIABEL.nama_lembaga);
  });

  /* Aplikasi ini template untuk sekolah dasar NEGERI. Tiga template lama
   * (kenaikan jilid, penurunan jilid, bukti pembayaran) memakai salam keagamaan
   * karena peninggalan sekolah Al-Qur'an; yang baru tidak boleh ikut, karena
   * pembeli bisa berupa sekolah mana pun. */
  it.each(KUNCI)('%s tidak memakai salam keagamaan', (kunci) => {
    expect(DEFAULT_WHATSAPP_TEMPLATES[kunci]).not.toMatch(/Assalamualaikum|Barakallahu|insya Allah/i);
  });

  it('membedakan kabar diterima dari kabar tidak diterima', () => {
    const diterima = renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES.ppdbDiterima, VARIABEL);
    const ditolak = renderWhatsAppTemplate(DEFAULT_WHATSAPP_TEMPLATES.ppdbDitolak, VARIABEL);
    expect(diterima).toMatch(/DITERIMA/);
    expect(diterima).toMatch(/daftar ulang/i);
    expect(ditolak).toMatch(/belum dapat kami terima/i);
    // Kabar penolakan tidak boleh mengajak daftar ulang.
    expect(ditolak).not.toMatch(/daftar ulang/i);
  });
});

describe('renderWhatsAppTemplate', () => {
  it('mengganti penanda berulang di seluruh teks', () => {
    expect(renderWhatsAppTemplate('{{a}} dan {{a}}', { a: 'X' })).toBe('X dan X');
  });

  it('menerima spasi di dalam kurung', () => {
    expect(renderWhatsAppTemplate('{{ nama }}', { nama: 'Budi' })).toBe('Budi');
  });

  // Penanda tanpa nilai menjadi tanda hubung, bukan "undefined" — supaya pesan
  // yang terkirim tetap terbaca sebagai kalimat.
  it('mengganti nilai yang hilang dengan tanda hubung', () => {
    expect(renderWhatsAppTemplate('Nama: {{nama}}', {})).toBe('Nama: -');
  });

  it('menerima template kosong tanpa melempar', () => {
    expect(renderWhatsAppTemplate(null, {})).toBe('');
    expect(renderWhatsAppTemplate(undefined)).toBe('');
  });
});

describe('normalizeWhatsAppTemplates', () => {
  it('mengembalikan seluruh kunci bawaan walau isinya kosong', () => {
    const hasil = normalizeWhatsAppTemplates({});
    expect(Object.keys(hasil).sort()).toEqual(Object.keys(DEFAULT_WHATSAPP_TEMPLATES).sort());
  });

  it('mempertahankan template yang sudah disunting pembeli', () => {
    const hasil = normalizeWhatsAppTemplates({ ppdbDiterima: 'Pesan sendiri' });
    expect(hasil.ppdbDiterima).toBe('Pesan sendiri');
    // Yang lain tetap bawaan.
    expect(hasil.ppdbDitolak).toBe(DEFAULT_WHATSAPP_TEMPLATES.ppdbDitolak);
  });

  // Template yang dikosongkan pembeli jatuh ke bawaan, bukan mengirim pesan kosong.
  it('menolak template yang hanya berisi spasi', () => {
    expect(normalizeWhatsAppTemplates({ ppdbDiterima: '   ' }).ppdbDiterima)
      .toBe(DEFAULT_WHATSAPP_TEMPLATES.ppdbDiterima);
  });

  it('menerima isi berbentuk teks JSON', () => {
    const hasil = normalizeWhatsAppTemplates(JSON.stringify({ ppdbDitolak: 'Dari JSON' }));
    expect(hasil.ppdbDitolak).toBe('Dari JSON');
  });

  it('menerima masukan yang tidak sah tanpa melempar', () => {
    expect(() => normalizeWhatsAppTemplates(null)).not.toThrow();
    expect(() => normalizeWhatsAppTemplates('bukan json')).not.toThrow();
    expect(() => normalizeWhatsAppTemplates([1, 2])).not.toThrow();
  });
});
