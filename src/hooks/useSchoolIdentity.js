import { useEffect, useState } from 'react';
import { getSchoolIdentity, subscribeSchoolIdentity } from '@/lib/schoolIdentity';

/**
 * Membaca identitas sekolah dan ikut menyegar saat admin menyimpan perubahan.
 *
 * Nilai awalnya diambil dari singgahan agar tidak ada kedipan teks bawaan
 * sebelum data dari basis data tiba.
 */
const useSchoolIdentity = () => {
  const [identity, setIdentity] = useState(getSchoolIdentity);

  useEffect(() => subscribeSchoolIdentity(setIdentity), []);

  return identity;
};

export default useSchoolIdentity;
