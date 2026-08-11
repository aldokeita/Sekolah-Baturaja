import apiClient from '@/lib/apiClient';

// Session management is handled automatically by apiClient (auto-refresh on 401).
// This hook is kept for backward compatibility.
export const validateAndRefreshSession = async () => {
  const token = apiClient.getToken();
  if (!token) return null;
  try {
    const user = await apiClient.get('/api/auth/me');
    return { access_token: token, user };
  } catch {
    return null;
  }
};

export const useAuthSession = () => ({ validateAndRefreshSession });
