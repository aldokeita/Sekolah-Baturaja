import apiClient from '@/lib/apiClient';

// Edge functions replaced by Go backend handlers.
// This wrapper is kept for backward compatibility with any remaining callers.
export const invokeAuthenticatedEdgeFunction = async (functionName, body) => {
  const endpointMap = {
    'manage-user':               '/api/auth/manage-user',
    'reset-user-password':       '/api/auth/reset-password',
    'record-login-attempt':      '/api/auth/login-attempt',
    'generate-signed-upload-url': '/api/files/signed-upload',
  };
  const path = endpointMap[functionName];
  if (!path) throw new Error(`Fungsi "${functionName}" tidak tersedia di backend baru.`);
  return apiClient.post(path, body);
};
