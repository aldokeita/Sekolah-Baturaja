import apiClient from '@/lib/apiClient';

export const LOGIN_SECURITY_CONSENT_KEY = 'school_login_security_notice_v1';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export const fetchLoginLogs = async ({ page = 0, pageSize = 15, searchTerm = '' } = {}) => {
  const params = new URLSearchParams({ page, limit: pageSize });
  if (searchTerm) params.set('search', searchTerm);
  return apiClient.get(`/api/login-logs?${params}`);
};

export const deleteLoginLog = async (id) => {
  await apiClient.delete(`/api/login-logs/${id}`);
};

// Kategori kasar, bukan user-agent mentah. Tabel login_logs sengaja menyimpan
// user_agent sebagai NULL (lihat komentar di backend/internal/handler/loginlogs.go),
// jadi yang dikirim cukup satu kata yang bisa dibaca admin.
export const detectDevice = () => {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent || '';
  if (/iPad|Tablet/i.test(ua)) return 'Tablet';
  if (/Mobi|Android|iPhone/i.test(ua)) return 'Mobile';
  return 'Desktop';
};

export const recordLoginAttempt = async ({ username, status, device = detectDevice() }) => {
  if (!username) return false;
  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = apiClient.getToken();
    if (status === 'success' && token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/api/auth/login-attempt`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        username_attempt: String(username).trim().slice(0, 160),
        status,
        device,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
};
