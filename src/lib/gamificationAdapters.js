import apiClient from '@/lib/apiClient';

export const getGamificationErrorMessage = (error) => {
  const message = String(error?.message || '');
  if (error?.code === '42501' || message.toLowerCase().includes('row-level security')) {
    return 'Anda tidak memiliki akses untuk aksi gamifikasi ini.';
  }
  return message || 'Operasi gamifikasi gagal.';
};

export const incrementSantriPoints = async (santriId, amount = 1) => {
  await apiClient.post('/api/gamification/points', { santri_id: santriId, amount });
};
