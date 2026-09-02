
// Dua shift masuk sekolah dasar. Nilai angka lama (1='Pagi 2', 3='Sore',
// 4='Malam') berasal dari produk madrasah sebelumnya dan tidak dipakai lagi;
// baris lama yang masih menyimpannya dipetakan lewat LEGACY_SESSION_ALIASES di
// AttendanceStatusLogic agar tetap terbaca.
export const SESSION_MAP = {
  0: 'Pagi',
  1: 'Siang',
};

export const getSessionName = (sessionValue) => {
  if (sessionValue === null || sessionValue === undefined) return '';
  const strVal = String(sessionValue);
  return SESSION_MAP[strVal] || strVal;
};

export const getSessionNumber = (sessionName) => {
  if (!sessionName) return null;
  const strName = String(sessionName).toLowerCase();
  for (const [key, value] of Object.entries(SESSION_MAP)) {
    if (value.toLowerCase() === strName) {
      return key;
    }
  }
  return sessionName;
};

export const getAllSessions = () => {
  return Object.keys(SESSION_MAP).map(key => ({
    id: key,
    name: SESSION_MAP[key]
  }));
};
