import { describe, it, expect } from 'vitest';
import {
  groupHafalanItemsByJilid,
  groupHafalanItemsByTarget,
  getHafalanScopeForCategory,
  getDevelopmentScoreMeta,
  progressStatusToComplete,
  completeToProgressStatus,
  HAFALAN_SCOPE_PER_KELAS,
  HAFALAN_SCOPE_PER_JUZ,
  JUZ_TAHFIZH_TARGETS,
} from '@/lib/academicAdapters';

// Mengunci keputusan yang mengikat: lingkup hafalan ditentukan oleh JENIS materi,
// bukan oleh status murid. Sebelumnya murid non-PTPT tidak pernah bisa punya
// hafalan per juz. Bila seseorang mengembalikan penyaringan berbasis status,
// test ini yang jatuh lebih dulu.
describe('getHafalanScopeForCategory', () => {
  it('memetakan Tahfizh ke lingkup per juz', () => {
    expect(getHafalanScopeForCategory('Tahfizh')).toBe(HAFALAN_SCOPE_PER_JUZ);
  });

  it('tidak peduli huruf besar-kecil maupun spasi', () => {
    expect(getHafalanScopeForCategory('  tahfizh ')).toBe(HAFALAN_SCOPE_PER_JUZ);
    expect(getHafalanScopeForCategory('TAHFIZH')).toBe(HAFALAN_SCOPE_PER_JUZ);
  });

  it('memetakan Doa, Sholat, dan Surat ke lingkup per kelas', () => {
    ['Doa', 'Sholat', 'Surat'].forEach((kategori) => {
      expect(getHafalanScopeForCategory(kategori)).toBe(HAFALAN_SCOPE_PER_KELAS);
    });
  });

  it('memakai lingkup per kelas untuk nilai kosong', () => {
    expect(getHafalanScopeForCategory(null)).toBe(HAFALAN_SCOPE_PER_KELAS);
    expect(getHafalanScopeForCategory('')).toBe(HAFALAN_SCOPE_PER_KELAS);
  });

  it('nilai tersimpan di basis data TIDAK ikut berganti nama', () => {
    // Labelnya saja yang diterjemahkan di UI, sama seperti peran Pentashih.
    expect(HAFALAN_SCOPE_PER_KELAS).toBe('TPQ');
    expect(HAFALAN_SCOPE_PER_JUZ).toBe('PTPT');
  });
});

describe('groupHafalanItemsByJilid', () => {
  it('selalu menyediakan enam kelompok meski tanpa item', () => {
    expect(Object.keys(groupHafalanItemsByJilid([]))).toEqual(['1', '2', '3', '4', '5', '6']);
  });

  it('membuang awalan "Jilid" sehingga "Jilid 3" masuk ke kelompok 3', () => {
    const hasil = groupHafalanItemsByJilid([
      { id: 'a', jilid: 'Jilid 3' },
      { id: 'b', jilid: '3' },
      { id: 'c', jilid: 'jilid  3' },
    ]);
    expect(hasil['3'].map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('menempatkan item tanpa jilid ke kelompok 1', () => {
    expect(groupHafalanItemsByJilid([{ id: 'a' }])['1']).toHaveLength(1);
  });

  it('mengabaikan jilid di luar 1-6 tanpa melempar', () => {
    const hasil = groupHafalanItemsByJilid([{ id: 'x', jilid: '99' }]);
    expect(Object.values(hasil).flat()).toHaveLength(0);
  });
});

describe('groupHafalanItemsByTarget', () => {
  it('mengelompokkan tepat per juz sasaran', () => {
    const hasil = groupHafalanItemsByTarget([
      { id: 'a', jilid: 'Juz 30' },
      { id: 'b', jilid: ' Juz 30 ' },
      { id: 'c', jilid: 'Juz 1' },
    ]);
    expect(hasil['Juz 30'].map((i) => i.id)).toEqual(['a', 'b']);
    expect(hasil['Juz 1'].map((i) => i.id)).toEqual(['c']);
  });

  it('menyediakan seluruh sasaran bawaan meski kosong', () => {
    expect(Object.keys(groupHafalanItemsByTarget([]))).toEqual(JUZ_TAHFIZH_TARGETS);
  });
});

describe('skala perkembangan', () => {
  it('memetakan skor 1-4 ke kode yang benar', () => {
    expect(getDevelopmentScoreMeta(1).code).toBe('BB');
    expect(getDevelopmentScoreMeta(4).code).toBe('SB');
  });

  it('menerima skor berbentuk string', () => {
    expect(getDevelopmentScoreMeta('3').code).toBe('BSH');
  });

  it('jatuh ke skor terendah untuk nilai di luar skala', () => {
    expect(getDevelopmentScoreMeta(99).code).toBe('BB');
    expect(getDevelopmentScoreMeta(null).code).toBe('BB');
  });
});

describe('status progress', () => {
  it('bolak-balik antara status dan boolean', () => {
    expect(progressStatusToComplete('lulus')).toBe(true);
    expect(progressStatusToComplete('proses')).toBe(false);
    expect(completeToProgressStatus(true)).toBe('lulus');
    expect(completeToProgressStatus(false)).toBe('proses');
  });
});
