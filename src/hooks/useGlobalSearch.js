import { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/apiClient';
import { resolveAvatarRecords } from '@/lib/storageAdapters';

export const useGlobalSearch = (query, delay = 300) => {
  const [results, setResults] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const performSearch = useCallback(async (searchQuery) => {
    if (!searchQuery || searchQuery.trim() === '') {
      setResults({});
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const term = encodeURIComponent(searchQuery.trim());

    try {
      const [santriRes, guruRes, classesRes, paymentsRes] = await Promise.allSettled([
        apiClient.get(`/api/santri?search=${term}&limit=5`),
        apiClient.get(`/api/guru?search=${term}&limit=5`),
        apiClient.get(`/api/classes?search=${term}&limit=5`),
        apiClient.get(`/api/payments?search=${term}&limit=10`),
      ]);

      const newResults = {};

      const santriData = santriRes.status === 'fulfilled' ? santriRes.value || [] : [];
      const guruData = guruRes.status === 'fulfilled' ? guruRes.value || [] : [];
      const classesData = classesRes.status === 'fulfilled' ? classesRes.value || [] : [];
      const paymentsData = paymentsRes.status === 'fulfilled' ? paymentsRes.value || [] : [];

      const resolvedSantri = await resolveAvatarRecords(santriData, { ownerType: 'santri' });

      if (resolvedSantri.length > 0) newResults.santri = resolvedSantri;
      if (guruData.length > 0) newResults.guru = guruData;
      if (classesData.length > 0) newResults.kelas = classesData;

      const validPayments = paymentsData.filter((p) => p.santri && p.santri.nama_lengkap);
      if (validPayments.length > 0) newResults.pembayaran = validPayments.slice(0, 5);

      setResults(newResults);
    } catch (err) {
      setError('Gagal mengambil data pencarian. ' + err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { performSearch(query); }, delay);
    return () => clearTimeout(timer);
  }, [query, performSearch, delay]);

  return { results, isLoading, error, performSearch };
};
