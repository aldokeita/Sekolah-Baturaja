import { fetchWebsiteContentMap, saveWebsiteContentItem } from '@/lib/publicContentAdapters';

export const WHATSAPP_TEMPLATE_KEY = 'whatsapp_message_templates';

export const DEFAULT_WHATSAPP_TEMPLATES = Object.freeze({
  jilidPromotion: `Assalamualaikum Warahmatullahi Wabarakatuh,

Alhamdulillah, Barakallahu fikum Ayah/Bunda.

Kami sampaikan kabar baik bahwa berdasarkan hasil evaluasi pembelajaran, ananda *{{nama_santri}}* dinyatakan *LULUS* dan berhak melanjutkan pembelajaran dari *{{jilid_lama}}* ke *{{jilid_baru}}*.

Silakan bergabung ke Grup WhatsApp jenjang terbaru:
{{link_grup}}

Semoga Allah senantiasa memberkahi langkah ananda dalam belajar Al-Qur'an dan menjadikannya istiqomah dalam menuntut ilmu.

Wassalamualaikum Warahmatullahi Wabarakatuh,
*Admin {{nama_lembaga}}*`,
  jilidDemotion: `Assalamualaikum Warahmatullahi Wabarakatuh,

Ayah/Bunda yang kami hormati,

Berdasarkan hasil evaluasi pembelajaran, ananda *{{nama_santri}}* perlu melanjutkan penguatan pembelajaran dari *{{jilid_lama}}* ke *{{jilid_baru}}* agar bacaan semakin lancar, tepat makhraj, dan lebih mutqin.

Silakan bergabung ke Grup WhatsApp jenjang terkait:
{{link_grup}}

Kami mohon dukungan Ayah/Bunda untuk terus memotivasi ananda. Insya Allah, ketekunan akan membawa hasil terbaik.

Wassalamualaikum Warahmatullahi Wabarakatuh,
*Admin {{nama_lembaga}}*`,
  paymentReceipt: `Assalamualaikum Warahmatullahi Wabarakatuh.

Ayah/Bunda dari *{{nama_santri}}*, terima kasih. Pembayaran berikut telah kami terima:

📋 *Rincian:* {{rincian}}
💰 *Nominal:* {{nominal}}
📅 *Tanggal:* {{tanggal}}
🗓️ *Periode:* {{periode}}
💳 *Metode:* {{metode}}
🧾 *ID Transaksi:* {{transaction_id}}
✅ *Status:* {{status}}

Terima kasih atas kepercayaannya. Semoga menjadi amal jariyah dan keberkahan bagi keluarga.

Wassalamualaikum Warahmatullahi Wabarakatuh,
*Admin {{nama_lembaga}}*`,

  /* Pemberitahuan hasil PPDB.
   *
   * Bahasanya sengaja netral, tanpa salam keagamaan seperti ketiga template di
   * atas: aplikasi ini template untuk sekolah dasar NEGERI, dan tiga template lama
   * itu peninggalan sekolah Al-Qur'an. Sekolah yang menginginkannya tinggal
   * menambahkan sendiri — semuanya disunting pembeli di Konfigurasi → Pesan
   * WhatsApp.
   *
   * Pengirimannya TIDAK otomatis. Tidak ada gerbang WhatsApp maupun SMTP di
   * aplikasi ini; petugas menekan tombol dan WhatsApp terbuka dengan pesan yang
   * sudah terisi, pola yang sama dipakai bukti pembayaran dan kenaikan jilid. */
  ppdbDiterima: `Selamat, {{nama_ortu}}.

Berdasarkan hasil seleksi penerimaan murid baru {{tahun_ajaran}}, ananda *{{nama_santri}}* dinyatakan *DITERIMA* di {{nama_lembaga}}.

Nomor pendaftaran: *{{nomor_pendaftaran}}*
Jalur: {{jalur}}

Langkah berikutnya adalah daftar ulang di ruang tata usaha. Mohon membawa berkas asli beserta fotokopinya: kartu keluarga, akta kelahiran, dan pas foto.

Bila ada yang ingin ditanyakan, silakan hubungi kami di {{telepon}}.

Terima kasih,
*Panitia SPMB {{nama_lembaga}}*`,

  ppdbDitolak: `{{nama_ortu}}, terima kasih telah mendaftarkan ananda *{{nama_santri}}* di {{nama_lembaga}}.

Setelah melalui proses seleksi penerimaan murid baru {{tahun_ajaran}}, kami menyampaikan bahwa ananda *belum dapat kami terima* pada tahun ajaran ini.

Nomor pendaftaran: *{{nomor_pendaftaran}}*

Keputusan ini bukan penilaian atas kemampuan ananda, melainkan karena keterbatasan daya tampung. Kami mendoakan ananda mendapatkan sekolah terbaik.

Bila ada yang ingin ditanyakan, silakan hubungi kami di {{telepon}}.

Terima kasih,
*Panitia SPMB {{nama_lembaga}}*`,

  ppdbDiverifikasi: `{{nama_ortu}}, terima kasih telah mendaftarkan ananda *{{nama_santri}}* di {{nama_lembaga}}.

Pendaftaran dengan nomor *{{nomor_pendaftaran}}* sudah kami terima dan berkasnya sudah kami periksa.

Hasil seleksi akan kami sampaikan sesuai jadwal yang tertera di halaman pendaftaran. Nomor pendaftaran di atas dapat Anda pakai untuk memeriksa status kapan saja.

Bila ada yang ingin ditanyakan, silakan hubungi kami di {{telepon}}.

Terima kasih,
*Panitia SPMB {{nama_lembaga}}*`,
});

export const normalizeWhatsAppTemplates = (content) => {
  let parsed = content;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      parsed = {};
    }
  }
  const value = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return Object.fromEntries(Object.entries(DEFAULT_WHATSAPP_TEMPLATES).map(([key, fallback]) => [
    key,
    typeof value[key] === 'string' && value[key].trim() ? value[key] : fallback,
  ]));
};

export const fetchWhatsAppTemplates = async () => {
  try {
    const content = await fetchWebsiteContentMap({ keys: [WHATSAPP_TEMPLATE_KEY], publicOnly: false });
    return normalizeWhatsAppTemplates(content[WHATSAPP_TEMPLATE_KEY]);
  } catch {
    return { ...DEFAULT_WHATSAPP_TEMPLATES };
  }
};

export const saveWhatsAppTemplates = async (templates) => {
  const normalized = normalizeWhatsAppTemplates(templates);
  const saved = await saveWebsiteContentItem({
    key: WHATSAPP_TEMPLATE_KEY,
    content: normalized,
    isPublic: false,
  });
  return normalizeWhatsAppTemplates(saved?.content);
};

export const renderWhatsAppTemplate = (template, variables = {}) => String(template || '')
  .replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_match, key) => String(variables[key] ?? '-'))
  .trim();
