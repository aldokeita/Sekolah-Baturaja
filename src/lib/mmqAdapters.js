import apiClient from '@/lib/apiClient';
import { resolveAvatarRecord, resolveAvatarRecords } from '@/lib/storageAdapters';

const ALLOWED_ATTENDANCE_STATUSES = new Set(['Hadir', 'Terlambat', 'Tidak Hadir', 'Alpha', 'Izin', 'Sakit']);

const toDbTime = (value) => {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
};

export const getMmqErrorMessage = (error) => {
  if (!error) return 'Terjadi kesalahan pada fitur MMQ.';
  const message = error.message || '';
  if (error.code === '23505' || message.toLowerCase().includes('duplicate')) return 'Kehadiran MMQ untuk guru, jadwal, dan tanggal tersebut sudah tercatat.';
  if (error.code === '42501' || message.toLowerCase().includes('row-level security')) return 'Akses MMQ tidak diizinkan untuk akun ini.';
  if (message.includes('mmq_attendance_status_check')) return 'Status kehadiran MMQ tidak sesuai aturan database.';
  return message || 'Terjadi kesalahan pada fitur MMQ.';
};

const sanitizeSchedulePayload = (payload) => ({
  day_of_week: Number(payload.day_of_week),
  start_time: toDbTime(payload.start_time),
  end_time: toDbTime(payload.end_time),
  location: payload.location || null,
  is_active: payload.is_active ?? true,
});

const sanitizeAttendancePayload = (payload) => ({
  schedule_id: payload.schedule_id,
  guru_id: payload.guru_id,
  attendance_date: payload.attendance_date,
  check_in_timestamp: payload.check_in_timestamp || null,
  status: ALLOWED_ATTENDANCE_STATUSES.has(payload.status) ? payload.status : 'Hadir',
  notes: payload.notes || null,
});

export const fetchMmqSchedules = async () => apiClient.get('/api/mmq/schedules');

export const saveMmqSchedule = async (payload) => {
  const body = sanitizeSchedulePayload(payload);
  if (payload.id) return apiClient.put(`/api/mmq/schedules/${payload.id}`, body);
  return apiClient.post('/api/mmq/schedules', body);
};

export const deleteMmqSchedule = async (id) => apiClient.delete(`/api/mmq/schedules/${id}`);

export const fetchMmqAttendance = async ({ date } = {}) => {
  const params = date ? `?date=${date}` : '';
  const data = await apiClient.get(`/api/mmq/attendance${params}`);
  return Promise.all((data || []).map(async (record) => ({
    ...record,
    guru: await resolveAvatarRecord(record.guru, { ownerType: 'guru' }),
  })));
};

export const saveMmqAttendance = async (payload) => {
  const body = sanitizeAttendancePayload(payload);
  if (payload.id) return apiClient.put(`/api/mmq/attendance/${payload.id}`, body);
  return apiClient.post('/api/mmq/attendance', body);
};

export const createMmqAttendance = async (payload) => {
  return apiClient.post('/api/mmq/attendance', sanitizeAttendancePayload(payload));
};

export const deleteMmqAttendance = async (id) => apiClient.delete(`/api/mmq/attendance/${id}`);

export const fetchMmqNotulensi = async () => apiClient.get('/api/mmq/notulensi');

export const createMmqNotulensi = async ({ schedule_id, tanggal, judul, isi, notulen_id }) => {
  return apiClient.post('/api/mmq/notulensi', { schedule_id, tanggal, judul, isi, notulen_id });
};

export const updateMmqNotulensi = async (id, payload) => {
  return apiClient.put(`/api/mmq/notulensi/${id}`, {
    judul: payload.judul,
    isi: payload.isi,
    tanggal: payload.tanggal,
    schedule_id: payload.schedule_id,
  });
};

export const deleteMmqNotulensi = async (id) => apiClient.delete(`/api/mmq/notulensi/${id}`);

export const fetchGuruForMmq = async () => {
  const data = await apiClient.get('/api/guru');
  return resolveAvatarRecords(data, { ownerType: 'guru' });
};

export const findGuruByRfid = async (rfidTag) => {
  const data = await apiClient.get(`/api/guru/by-rfid/${encodeURIComponent(rfidTag)}`);
  return resolveAvatarRecord(data, { ownerType: 'guru' });
};

export const pickScheduleForToday = (schedules, date = new Date()) => {
  const activeSchedules = (schedules || []).filter((s) => s.is_active);
  if (activeSchedules.length === 0) return null;
  const todaySchedule = activeSchedules.find((s) => Number(s.day_of_week) === date.getDay());
  return todaySchedule || activeSchedules[0];
};
