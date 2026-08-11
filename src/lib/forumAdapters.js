import apiClient from '@/lib/apiClient';

export const getForumErrorMessage = (error) => {
  const message = String(error?.message || '');
  if (error?.code === '42501' || message.toLowerCase().includes('row-level security')) return 'Anda tidak memiliki akses untuk aksi forum ini.';
  return message || 'Operasi forum gagal.';
};

const buildAuthorFields = (user) => ({
  author_id: user?.id,
  author_name: user?.nama_lengkap || user?.nama || 'Wali Murid',
  author_role: user?.role,
});

export const fetchForumTopics = async () => apiClient.get('/api/forum/topics');

export const fetchForumTopic = async (topicId) => apiClient.get(`/api/forum/topics/${topicId}`);

export const fetchForumReplies = async (topicId) => apiClient.get(`/api/forum/topics/${topicId}/replies`);

export const createForumTopic = async ({ title, content, user }) => {
  await apiClient.post('/api/forum/topics', { title, content, ...buildAuthorFields(user) });
};

export const createForumReply = async ({ topicId, content, user }) => {
  await apiClient.post(`/api/forum/topics/${topicId}/replies`, { content, ...buildAuthorFields(user) });
};

export const deleteForumEntry = async ({ type, id }) => {
  const path = type === 'topic' ? `/api/forum/topics/${id}` : `/api/forum/replies/${id}`;
  await apiClient.delete(path);
};
