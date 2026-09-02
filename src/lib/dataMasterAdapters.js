import apiClient, { publicFetch } from '@/lib/apiClient';

export const activeStatusValues = new Set(['aktif', 'active']);

// The santri detail endpoint returns the joined class as flat class_* columns;
// the UI reads the nested shape PostgREST used to embed (class.nama_kelas,
// class.guru.nama), so rebuild it here.
const buildNestedClass = (santri) => {
  if (santri.class ?? santri.current_class) return santri.class ?? santri.current_class;
  if (!santri.class_nama) return null;
  return {
    id: santri.class_id ?? santri.current_class_id ?? null,
    nama_kelas: santri.class_nama,
    sesi: santri.class_sesi ?? null,
    kategori: santri.class_kategori ?? null,
    id_guru: santri.class_id_guru ?? null,
    is_active: santri.class_is_active ?? null,
    guru: santri.class_guru_nama ? { nama: santri.class_guru_nama } : null,
  };
};

export const mapSantriForLegacyUi = (santri) => ({
  ...santri,
  id_kelas: santri.current_class_id ?? santri.id_kelas ?? null,
  class: buildNestedClass(santri),
  tanggal_pendaftaran: santri.tanggal_pendaftaran ?? santri.created_at ?? null,
});

export const mapClassForLegacyUi = (classItem) => ({
  ...classItem,
  order: classItem.sort_order ?? classItem.order ?? 0,
  // include_guru returns the teacher as flat guru_* columns; the UI reads the
  // nested shape PostgREST used to embed, so rebuild it here.
  guru: classItem.guru ?? (classItem.guru_nama
    ? { nama: classItem.guru_nama, no_hp: classItem.guru_no_hp ?? null, foto_url: classItem.guru_foto_url ?? null }
    : null),
});

export const normalizeNomorIndukQiroati = (value) => String(value ?? '').trim();

export const normalizeDefaultSppAmount = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

// Penjagaan Default SPP, dipisah dari komponen supaya bisa diuji.
//
// Nilai kosong harus lolos sebagai null, BUKAN ditolak. Bentuk kosongnya ada
// empat: undefined (field tidak diinisialisasi resetForm), null, string kosong,
// dan spasi belaka. Penjagaan lama hanya mengenali dua di antaranya, sehingga
// form tambah murid menolak dirinya sendiri tanpa jalan keluar bagi pengguna.
export const SPP_MINIMUM = 10000;

export const validateDefaultSppAmount = (value) => {
  if (String(value ?? '').trim() === '') return { ok: true, amount: null };
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < SPP_MINIMUM) return { ok: false, amount: null };
  return { ok: true, amount };
};

export const pickSantriProfileFields = (input) => {
  const nomorInduk = normalizeNomorIndukQiroati(input.nomor_induk);

  return {
    nomor_induk: nomorInduk,
    nisn: input.nisn?.trim() || null,
    nis: input.nis?.trim() || null,
    angkatan: input.angkatan?.trim() || null,
    nama_lengkap: input.nama_lengkap?.trim(),
    nama_panggilan: input.nama_panggilan?.trim() || null,
    kategori: input.kategori || 'Anak',
    jenis_kelamin: input.jenis_kelamin || null,
    agama: input.agama || null,
    tanggal_lahir: input.tanggal_lahir || null,
    tempat_lahir: input.tempat_lahir || null,
    alamat: input.alamat || null,
    no_hp_ortu: input.no_hp_ortu || null,
    foto_url: input.foto_url || null,
    avatar_path: input.avatar_path || null,
    rfid_tag: input.rfid_tag || null,
    current_class_id: input.current_class_id ?? input.id_kelas ?? null,
    sesi_mengaji: input.sesi_mengaji || null,
    jilid: input.jilid || null,
    tanggal_pendaftaran: input.tanggal_pendaftaran || null,
    nama_ayah: input.nama_ayah || null,
    nama_ibu: input.nama_ibu || null,
    pekerjaan_ayah: input.pekerjaan_ayah || null,
    pekerjaan_ibu: input.pekerjaan_ibu || null,
    // Null means "same as the student's address"; the detail view falls back.
    alamat_ortu: input.alamat_ortu || null,
    no_kk: input.no_kk || null,
    no_nik: input.no_nik || null,
    berkas_foto: Boolean(input.berkas_foto),
    berkas_akta: Boolean(input.berkas_akta),
    berkas_kk: Boolean(input.berkas_kk),
    berkas_form: Boolean(input.berkas_form),
    link_qiroati: input.link_qiroati || null,
    default_spp_amount: normalizeDefaultSppAmount(input.default_spp_amount),
    status: input.status || 'Aktif',
    points: Number(input.points) || 0,
    order_in_class: input.order_in_class ?? null,
  };
};

const normalizeComparableValue = (value) => {
  if (value === undefined || value === '') return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isNaN(value)) return null;
  return value;
};

export const pickChangedSantriProfileFields = (input, original = {}) => {
  const next = pickSantriProfileFields(input);
  const previous = pickSantriProfileFields({
    ...original,
    current_class_id: original.current_class_id ?? original.id_kelas ?? null,
    id_kelas: original.current_class_id ?? original.id_kelas ?? null,
  });

  return Object.entries(next).reduce((payload, [key, value]) => {
    if (normalizeComparableValue(value) !== normalizeComparableValue(previous[key])) {
      payload[key] = value;
    }
    return payload;
  }, {});
};

export const pickGuruProfileFields = (input, role = 'guru') => ({
  nama: input.nama?.trim(),
  email: input.email?.trim() || null,
  no_hp: input.no_hp || null,
  alamat: input.alamat || null,
  foto_url: input.avatar_path ? null : (input.foto_url || null),
  avatar_path: input.avatar_path || null,
  rfid_tag: input.rfid_tag || null,
  jabatan: input.jabatan || null,
  roles: Array.from(new Set([
    ...(input.roles || []).filter((item) => !['Admin', 'Pentashih'].includes(item)),
    ...((input.roles || []).includes('Pentashih') ? ['Pentashih'] : []),
    ...(role === 'admin' ? ['Admin'] : []),
  ])),
  is_notulen: Boolean(input.is_notulen),
  jenis_kelamin: input.jenis_kelamin || null,
  tanggal_lahir: input.tanggal_lahir || null,
  status_guru: input.status_guru || null,
  // Field NUPTK di panel Data Guru dulu tidak pernah sampai ke backend: ia
  // menulis ke `nomor_induk_qiroati`, kolom yang tidak ada pada tabel guru, dan
  // pemilih field ini pun tidak meneruskannya.
  nuptk: input.nuptk || null,
  status: input.status || 'active',
});

export const getOperationalRoleFromGuruForm = (input) => {
  const roles = input.roles || [];
  // Priority: Admin (full access) wins, then Tata Usaha (back-office staff),
  // then Pentashih, otherwise a plain teacher account.
  if (roles.includes('Admin')) return 'admin';
  if (roles.includes('Tata Usaha')) return 'tata_usaha';
  // Kepala sekolah memakai app_role `pentashih` — dashboard pengawasan sekolah,
  // yang sama dengan wakilnya. Bukan app_role baru: keduanya mengawasi hal yang
  // persis sama (kehadiran, keterisian kelas, murid yang perlu perhatian) dan
  // sama-sama tidak berhak menyunting. Menambah app_role kembar hanya
  // menggandakan jumlah tempat yang harus diperiksa ulang di setiap handler.
  //
  // Yang membedakan keduanya adalah SEBUTAN, bukan hak akses: judul dashboard dan
  // kartu profilnya berbunyi "Kepala Sekolah" ketika akunnya memegang sebutan itu
  // (lihat isKepalaSekolah di src/lib/staf.js).
  //
  // Admin dan Tata Usaha tetap didahulukan: kepala sekolah yang juga memegang
  // salah satunya jelas menginginkan dashboard yang lebih luas.
  if (roles.includes('Pentashih') || roles.includes('Kepala Sekolah')) return 'pentashih';
  return 'guru';
};

// --- Santri query functions ---

const buildSantriParams = (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.kategori) params.set('kategori', filters.kategori);
  if (filters.excludeKategori) params.set('exclude_kategori', filters.excludeKategori);
  if (filters.classId) params.set('class_id', filters.classId);
  if (Array.isArray(filters.classIds) && filters.classIds.length > 0) {
    params.set('class_ids', filters.classIds.join(','));
  }
  if (Array.isArray(filters.kategoriIn) && filters.kategoriIn.length > 0) {
    params.set('kategori_in', filters.kategoriIn.join(','));
  }
  if (Array.isArray(filters.sesi) && filters.sesi.length > 0) params.set('sesi', filters.sesi.join(','));
  if (filters.jilid) params.set('jilid', filters.jilid);
  if (filters.rfid) params.set('rfid', filters.rfid);
  if (filters.activeOnly) params.set('active_only', 'true');
  if (filters.notDeleted) params.set('not_deleted', 'true');
  if (filters.order) params.set('order', filters.order);
  if (filters.direction) params.set('direction', filters.direction);
  if (filters.search) params.set('search', filters.search);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));
  return params.toString() ? `?${params.toString()}` : '';
};

export const fetchSantriList = async (filters = {}) => {
  const data = await apiClient.get(`/api/santri${buildSantriParams(filters)}`);
  return (data || []).map(mapSantriForLegacyUi);
};

/* Teman sekelas murid yang sedang masuk, beserta status kehadiran hari ini.
 *
 * Dipakai HANYA oleh dashboard murid. Daftar murid biasa (/api/santri) mengunci
 * seorang murid pada barisnya sendiri, sehingga panel "Teman Sekelas" dulu
 * hanya berisi dirinya sendiri. Endpoint ini mengirim kolom yang tampil saja —
 * nama, foto, tingkat mengaji, status hari ini. */
export const fetchClassmates = async () => {
  const data = await apiClient.get('/api/santri/classmates');
  return data || [];
};

// Same filters as fetchSantriList, but also returns the unpaginated total.
export const fetchSantriPage = async (filters = {}) => {
  const { data, total } = await apiClient.get(
    `/api/santri${buildSantriParams(filters)}`,
    { withMeta: true }
  );
  return { data: (data || []).map(mapSantriForLegacyUi), total };
};

// Fetches every matching santri by walking the pages. The list endpoint caps
// limit at 200, so whole-roster views (institution-wide dashboards) would
// silently truncate on a single call. `page` is 0-based server-side.
export const fetchAllSantri = async (filters = {}) => {
  const pageSize = 200;
  const first = await fetchSantriPage({ ...filters, page: 0, limit: pageSize });
  const total = Number(first.total) || first.data.length;
  const rows = [...first.data];

  const pageCount = Math.ceil(total / pageSize);
  for (let page = 1; page < pageCount; page += 1) {
    const next = await fetchSantriPage({ ...filters, page, limit: pageSize });
    if (!next.data.length) break;
    rows.push(...next.data);
  }
  return rows;
};

export const fetchSantriDetail = async (id) => {
  const data = await apiClient.get(`/api/santri/${id}`);
  return data ? mapSantriForLegacyUi(data) : null;
};

export const createSantri = async (payload) => {
  const data = await apiClient.post('/api/santri', payload);
  return mapSantriForLegacyUi(data);
};

export const updateSantri = async (id, payload) => {
  const data = await apiClient.put(`/api/santri/${id}`, payload);
  return mapSantriForLegacyUi(data);
};

export const deleteSantri = async (id) => {
  await apiClient.delete(`/api/santri/${id}`);
};

export const fetchSantriCount = async () => {
  return publicFetch('/api/santri/count');
};

export const fetchClassCount = async () => {
  return publicFetch('/api/classes/count');
};

export const bulkInsertSantri = async (payloads) => {
  const res = await apiClient.post('/api/santri/bulk', payloads);
  return {
    inserted: (res?.inserted || []).map(mapSantriForLegacyUi),
    failed: res?.failed || [],
  };
};

/** Impor massal guru. Respons: { inserted:[{item, password_awal?}], failed:[{index,email,error}] } */
export const bulkInsertGuru = async (rows) => {
  const res = await apiClient.post('/api/guru/bulk', { rows });
  return { inserted: res?.inserted || [], failed: res?.failed || [] };
};

export const updateSantriJilid = async (id, jilid) => {
  return apiClient.put(`/api/santri/${id}/jilid`, { jilid });
};

export const updateSantriOrder = async (id, orderInClass) => {
  return apiClient.put(`/api/santri/${id}/order`, { order_in_class: orderInClass });
};

export const moveSantriClass = async ({ santri_id, target_class_id, reason }) => {
  return apiClient.post('/api/santri/move-class', { santri_id, target_class_id, reason });
};

/* Kenaikan kelas satu tahun ajaran untuk banyak rombel sekaligus.
 *
 * `peta` dikirim dari panel, bukan diturunkan backend: sekolah berbeda
 * kebijakannya — ada yang mempertahankan rombel (2B ke 3B), ada yang mengacak
 * ulang tiap tahun, ada yang menggabung dua rombel. Panel mengusulkan, admin
 * menyetujui, backend menjalankan yang disetujui. */
export const promoteClasses = async ({
  tahunAjaranAsal,
  tahunAjaranTujuan,
  peta,
  lulusClassIds = [],
  tinggalSantriIds = [],
  catatan = '',
}) => apiClient.post('/api/santri/promote-class', {
  tahun_ajaran_asal: tahunAjaranAsal,
  tahun_ajaran_tujuan: tahunAjaranTujuan,
  peta,
  lulus_class_ids: lulusClassIds,
  tinggal_santri_ids: tinggalSantriIds,
  catatan,
});

export const fetchPromotionRuns = async () => {
  const data = await apiClient.get('/api/santri/promotion-runs');
  return Array.isArray(data) ? data : [];
};

export const changeSantriCategory = async ({ santri_id, new_category, reason }) => {
  return apiClient.post('/api/guru/change-category', { santri_id, new_category, reason });
};

// --- Guru query functions ---

export const fetchGuruList = async () => {
  const data = await apiClient.get('/api/guru');
  return data || [];
};

export const fetchGuruDetail = async (id) => {
  return apiClient.get(`/api/guru/${id}`);
};

// Replaces the manage-user edge function: the backend creates the auth row,
// the role profile, and the guru record in one transaction.
export const createGuru = async ({ role = 'guru', password, profile }) => {
  return apiClient.post('/api/guru', { role, password, profile });
};

export const deactivateGuru = async (id) => {
  return apiClient.delete(`/api/guru/${id}`);
};

export const updateGuru = async (id, payload) => {
  return apiClient.put(`/api/guru/${id}`, payload);
};

export const deleteGuru = async (id) => {
  await apiClient.delete(`/api/guru/${id}`);
};

export const fetchGuruCount = async () => {
  return publicFetch('/api/guru/count');
};

export const fetchGuruByRfid = async (rfid) => {
  return apiClient.get(`/api/guru/by-rfid/${encodeURIComponent(rfid)}`);
};

export const fetchSantriByRfid = async (rfid) => {
  const data = await apiClient.get(`/api/santri/by-rfid/${encodeURIComponent(rfid)}`);
  return data ? mapSantriForLegacyUi(data) : null;
};

// --- Class query functions ---

export const fetchClassList = async (filters = {}) => {
  const params = new URLSearchParams();
  if (filters.kategori) params.set('kategori', filters.kategori);
  if (filters.is_active !== undefined) params.set('is_active', String(filters.is_active));
  if (filters.id_guru) params.set('id_guru', filters.id_guru);
  if (filters.includeGuru) params.set('include_guru', 'true');
  if (filters.includeSantri) params.set('include_santri', 'true');
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString() ? `?${params.toString()}` : '';
  const data = await apiClient.get(`/api/classes${qs}`);
  return (data || []).map(mapClassForLegacyUi);
};

export const fetchClassDetail = async (id) => {
  const data = await apiClient.get(`/api/classes/${id}`);
  return data ? mapClassForLegacyUi(data) : null;
};

export const createClass = async (payload) => {
  const data = await apiClient.post('/api/classes', payload);
  return mapClassForLegacyUi(data);
};

export const updateClass = async (id, payload) => {
  const data = await apiClient.put(`/api/classes/${id}`, payload);
  return mapClassForLegacyUi(data);
};

export const deleteClass = async (id) => {
  await apiClient.delete(`/api/classes/${id}`);
};

// orderedIds is the class ids in their new display order; sort_order is 1-based
// so a class never gets 0, which the list query treats the same as "unset".
export const reorderClasses = async (orderedIds) => {
  return apiClient.put(
    '/api/classes/reorder',
    (orderedIds || []).map((id, index) => ({ id, sort_order: index + 1 }))
  );
};

export const fetchClassMutations = async (id) => {
  const data = await apiClient.get(`/api/classes/${id}/mutations`);
  return data || [];
};

// Full mutation log across every class (admin only).
// Accepts either `fetchAllClassMutations(200)` or `fetchAllClassMutations({ limit: 200 })`
// — every existing call site uses the object form, which previously stringified
// to `limit=[object Object]` and made the backend fall back to its default of 50.
// The default is 200 because that is the hard cap in the backend's paginate();
// asking for more silently returned only 200 anyway.
const MAX_CLASS_MUTATION_LIMIT = 200;

export const fetchAllClassMutations = async (options = MAX_CLASS_MUTATION_LIMIT) => {
  const requested = typeof options === 'object' && options !== null ? options.limit : options;
  const parsed = Number(requested);
  const limit = Number.isFinite(parsed) && parsed > 0
    ? Math.min(Math.trunc(parsed), MAX_CLASS_MUTATION_LIMIT)
    : MAX_CLASS_MUTATION_LIMIT;
  const data = await apiClient.get(`/api/classes/mutations?limit=${limit}`);
  return data || [];
};

export const deleteClassMutation = async (id) => {
  await apiClient.delete(`/api/classes/mutations/${id}`);
};
