import apiClient from '@/lib/apiClient';
import { getTingkatLevels } from '@/lib/tahfizhLevels';

export const WHATSAPP_JILID_OPTIONS = Object.freeze(getTingkatLevels());

const WHATSAPP_INVITE_PATTERN = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+$/;

export const isValidWhatsAppGroupLink = (link) => WHATSAPP_INVITE_PATTERN.test(String(link || '').trim());

export const normalizeWhatsAppGroupLinks = (rows = []) => Object.fromEntries(
  rows
    .filter((row) => row?.jilid && row?.is_active !== false)
    .map((row) => [row.jilid, row.whatsapp_link || '']),
);

export const validateWhatsAppGroupLinks = (links = {}) => {
  for (const [jilid, rawLink] of Object.entries(links)) {
    const link = String(rawLink || '').trim();
    if (link && !isValidWhatsAppGroupLink(link)) {
      throw new Error(`Link grup ${jilid} harus menggunakan format https://chat.whatsapp.com/...`);
    }
  }
};

export const fetchWhatsAppGroupLinks = async () => {
  const data = await apiClient.get('/api/whatsapp/groups');
  return normalizeWhatsAppGroupLinks(data || []);
};

export const fetchWhatsAppGroupLink = async (jilid) => {
  if (!jilid) return '';
  const data = await apiClient.get(`/api/whatsapp/groups?jilid=${encodeURIComponent(jilid)}`);
  return (data?.[0])?.whatsapp_link || '';
};

export const saveWhatsAppGroupLinks = async (links = {}) => {
  validateWhatsAppGroupLinks(links);
  const normalizedEntries = Object.entries(links).map(([jilid, rawLink]) => [jilid, String(rawLink || '').trim()]);
  const activeRows = normalizedEntries
    .filter(([, link]) => Boolean(link))
    .map(([jilid, whatsappLink]) => ({ jilid, group_name: `Grup ${jilid}`, whatsapp_link: whatsappLink, is_active: true }));
  const inactiveJilid = normalizedEntries.filter(([, link]) => !link).map(([jilid]) => jilid);

  if (activeRows.length) await apiClient.post('/api/whatsapp/groups/bulk-upsert', { rows: activeRows });
  if (inactiveJilid.length) await apiClient.post('/api/whatsapp/groups/bulk-deactivate', { jilid_list: inactiveJilid });

  return fetchWhatsAppGroupLinks();
};
