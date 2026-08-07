import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { submitPublicFeedback, getPublicContentErrorMessage } from '@/lib/publicContentAdapters';
import useSchoolIdentity from '@/hooks/useSchoolIdentity';
import { tahunAjaranAwal } from '@/lib/schoolIdentity';
import '@/styles/sdnb.css';

/**
 * Ported VERBATIM from the footer that appears identically in all 8 content
 * pages of the mockups (`Beranda SMAN Baturaja.dc.html` lines 586–632).
 *
 * Necessary translations:
 *  - `href="./Xxx.dc.html"` → react-router links to the equivalent route.
 *    The mockup's "Sekolah" column pointed every entry at Profil Sekolah.dc.html;
 *    here each label links to its real page (matching the nav dropdown's intent)
 *    so none of them are dead ends.
 *  - `style-before` → a real absolutely-positioned child div (pixel-identical).
 *  - The newsletter field is wired to the existing public feedback endpoint so
 *    the form actually does something; its markup and styling are unchanged.
 */

const COL_SEKOLAH = [
  { label: 'Profil', to: '/profil' },
  { label: 'Guru & staf', to: '/profil' },
  { label: 'Fasilitas', to: '/fasilitas' },
  { label: 'Prestasi', to: '/prestasi' },
];

// Label PPDB mengikuti tahun ajaran di panel Identitas; tahunnya dulu ditanam
// di sini, jadi setiap sekolah pembeli selamanya menautkan "PPDB 2026".
const labelPpdb = (sekolah) => {
  const tahun = tahunAjaranAwal(sekolah.academicYear);
  return tahun ? `PPDB ${tahun}` : 'PPDB';
};

const kolomInformasi = (sekolah) => [
  { label: 'Berita', to: '/berita' },
  { label: 'Galeri', to: '/profil/galeri' },
  { label: labelPpdb(sekolah), to: '/pendaftaran' },
  // Orang tua yang sudah mendaftar butuh jalan kembali; tanpa tautan ini satu-satunya
  // cara mengetahui hasil adalah menelepon sekolah.
  { label: 'Cek pendaftaran', to: '/cek-pendaftaran' },
  { label: 'FAQ', to: '/#faq' },
];

const colLabel = { fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#8a8ea8' };
const colList = { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9, fontSize: 13.5 };
const colLink = { color: '#3f4468' };

// The mockups ship two footers: Beranda uses a four-column one with the
// newsletter box, every other content page uses this three-column
// "Halaman / Kontak" variant (ported from `Profil Sekolah.dc.html` 383–413).
const kolomHalaman = (sekolah) => [
  { label: 'Beranda', to: '/' },
  { label: 'Galeri', to: '/profil/galeri' },
  { label: 'Berita', to: '/berita' },
  { label: labelPpdb(sekolah), to: '/pendaftaran' },
];

export const SiteFooterRingkas = () => {
  const sekolah = useSchoolIdentity();
  return (
  <footer id="kontak" data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '92px 28px 40px' }}>
    <div style={{ position: 'relative', overflow: 'hidden', padding: '38px 40px', borderRadius: 28, background: 'rgba(255,255,255,.5)', backdropFilter: 'blur(26px) saturate(185%)', WebkitBackdropFilter: 'blur(26px) saturate(185%)', border: '1px solid rgba(255,255,255,.75)', boxShadow: '0 28px 60px -24px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
      <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(168deg,rgba(255,255,255,.55),rgba(255,255,255,0))', pointerEvents: 'none' }} />

      <div className="sdnb-footer-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr', gap: 36 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(140deg,#7d8bff,#c8a4f0 45%,#ffb3d1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.85)' }}>{sekolah.logoAbbr}</div>
            <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-.01em', color: '#1b1c28' }}>{sekolah.name}</div>
          </div>
          <p style={{ margin: '16px 0 0', maxWidth: 300, fontSize: 13, lineHeight: 1.65, color: '#5f6486' }}>
            {sekolah.address}
          </p>
        </div>

        <div>
          <div style={colLabel}>Halaman</div>
          <div style={colList}>
            {kolomHalaman(sekolah).map((l) => (
              <Link key={l.label} to={l.to} className="h-flink" style={colLink}>{l.label}</Link>
            ))}
          </div>
        </div>

        <div>
          <div style={colLabel}>Kontak</div>
          <div style={{ ...colList, color: '#3f4468' }}>
            <div>{sekolah.phone}</div>
            <div>{sekolah.email}</div>
            <div>{sekolah.officeHours}</div>
          </div>
        </div>
      </div>

      <div style={{ position: 'relative', marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.7)', fontSize: 12, color: '#70759a' }}>
        &copy; {new Date().getFullYear()} {sekolah.name}. Seluruh hak cipta dilindungi.
      </div>
    </div>
  </footer>
  );
};

const SiteFooter = () => {
  const sekolah = useSchoolIdentity();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      await submitPublicFeedback({
        nama: 'Buletin sekolah',
        email: email.trim(),
        pesan: `Permintaan berlangganan buletin sekolah dari ${email.trim()}.`,
      });
      toast({ title: 'Terkirim', description: 'Alamat email Anda sudah kami terima.' });
      setEmail('');
    } catch (error) {
      toast({ title: 'Gagal mengirim', description: getPublicContentErrorMessage(error), variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  return (
    <footer data-reveal="0" style={{ maxWidth: 1240, margin: '0 auto', padding: '64px 28px 40px' }}>
      <div style={{ position: 'relative', overflow: 'hidden', padding: '38px 40px', borderRadius: 28, background: 'rgba(255,255,255,.5)', backdropFilter: 'blur(26px) saturate(185%)', WebkitBackdropFilter: 'blur(26px) saturate(185%)', border: '1px solid rgba(255,255,255,.75)', boxShadow: '0 28px 60px -24px rgba(55,65,120,.55),inset 0 1px 0 rgba(255,255,255,.95)' }}>
        {/* style-before */}
        <div aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', background: 'linear-gradient(168deg,rgba(255,255,255,.55),rgba(255,255,255,0))', pointerEvents: 'none' }} />

        <div className="sdnb-footer-grid" style={{ position: 'relative', display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1.2fr', gap: 36 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: 'linear-gradient(140deg,#7d8bff,#c8a4f0 45%,#ffb3d1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 12, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.85)' }}>{sekolah.logoAbbr}</div>
              <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-.01em', color: '#1b1c28' }}>{sekolah.name}</div>
            </div>
            <p style={{ margin: '16px 0 0', maxWidth: 280, fontSize: 13, lineHeight: 1.65, color: '#5f6486' }}>
              {sekolah.address}
            </p>
          </div>

          <div>
            <div style={colLabel}>Sekolah</div>
            <div style={colList}>
              {COL_SEKOLAH.map((l) => (
                <Link key={l.label} to={l.to} className="h-flink" style={colLink}>{l.label}</Link>
              ))}
            </div>
          </div>

          <div>
            <div style={colLabel}>Informasi</div>
            <div style={colList}>
              {kolomInformasi(sekolah).map((l) => (
                <Link key={l.label} to={l.to} className="h-flink" style={colLink}>{l.label}</Link>
              ))}
            </div>
          </div>

          <div>
            <div style={colLabel}>Buletin sekolah</div>
            <p style={{ margin: '14px 0 0', fontSize: 13, lineHeight: 1.6, color: '#5f6486' }}>Ringkasan kegiatan dikirim setiap awal bulan.</p>
            <form onSubmit={handleSubscribe} style={{ marginTop: 14, display: 'flex', gap: 8 }}>
              <input
                type="email"
                placeholder="Alamat email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Alamat email buletin"
                style={{ flex: 1, minWidth: 0, padding: '11px 14px', borderRadius: 13, fontFamily: 'inherit', fontSize: 13, color: '#2b2e48', background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.9)', outline: 'none', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.95)' }}
              />
              <button type="submit" disabled={sending} className="shine h-bright" style={{ position: 'relative', overflow: 'hidden', padding: '11px 17px', borderRadius: 13, border: 0, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.45 : 1, fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#fff', background: 'linear-gradient(135deg,var(--sekolah-aksen),var(--sekolah-aksen-tengah) 55%,var(--sekolah-aksen-ujung))', boxShadow: '0 12px 26px -12px rgba(95,105,235,.95),inset 0 1px 0 rgba(255,255,255,.55)' }}>
                Kirim
              </button>
            </form>
          </div>
        </div>

        <div style={{ position: 'relative', marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,.7)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, fontSize: 12, color: '#70759a' }}>
          <div>&copy; {new Date().getFullYear()} {sekolah.name}. Seluruh hak cipta dilindungi.</div>
          <div style={{ display: 'flex', gap: 18 }}>
            <Link to="/" className="h-flink" style={{ color: '#70759a' }}>Kebijakan privasi</Link>
            <Link to="/" className="h-flink" style={{ color: '#70759a' }}>Peta situs</Link>
            <Link to="/kontak" className="h-flink" style={{ color: '#70759a' }}>Kontak</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default SiteFooter;
