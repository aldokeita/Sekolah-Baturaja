import apiClient from '@/lib/apiClient';
import { mapSantriForLegacyUi } from '@/lib/dataMasterAdapters';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

const ARCHIVE_SELECT = ['id','nama_lengkap','nama_panggilan','nomor_induk_qiroati','kategori','status','deleted_at','archive_reason','current_class_id','sesi_mengaji','jilid','foto_url','avatar_path'].join(',');

export const getFunctionErrorMessage = async (error, fallback) => {
  if (!error) return fallback;
  try {
    const response = error.context;
    if (response && typeof response.clone === 'function') {
      const payload = await response.clone().json();
      return payload?.error?.message || payload?.message || fallback;
    }
  } catch { /* fall through */ }
  return error.message || fallback;
};

export const getArchivedSantri = async (categories = []) => {
  const [santriRows, classRows] = await Promise.all([
    apiClient.get('/api/santri?status=Nonaktif&include_archived=true'),
    apiClient.get('/api/classes'),
  ]);
  const normalizedCategories = new Set(categories.map((c) => String(c).toLowerCase()));
  const classNames = new Map((classRows || []).map((item) => [item.id, item.nama_kelas]));
  const filteredRows = (santriRows || []).filter((item) => (
    normalizedCategories.size === 0 || normalizedCategories.has(String(item.kategori || 'Anak').toLowerCase())
  ));
  const resolvedRows = await resolveAvatarRecords(filteredRows, { ownerType: 'santri' });
  return resolvedRows.map((item) => ({
    ...mapSantriForLegacyUi(item),
    class_name: classNames.get(item.current_class_id) || 'Belum ditempatkan',
  }));
};

export const setSantriArchived = async ({ santriId, archived, reason }) => {
  const fallback = archived ? 'Santri gagal dipindahkan ke arsip.' : 'Santri gagal dipulihkan dari arsip.';
  try {
    if (archived) return await apiClient.post(`/api/santri/${santriId}/archive`, { reason });
    return await apiClient.post(`/api/santri/${santriId}/restore`);
  } catch (error) {
    throw new Error(await getFunctionErrorMessage(error, fallback));
  }
};

export const archiveSantriAccounts = async (santriIds, reason) => {
  for (const santriId of santriIds) await setSantriArchived({ santriId, archived: true, reason });
};
