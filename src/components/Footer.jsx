import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Mail, MapPin, Phone } from 'lucide-react';
import { SCHOOL } from '@/lib/schoolProfile';
import '@/styles/school-home.css';

const quickLinks = [
  { label: 'Informasi Pendaftaran', to: '/pendaftaran/informasi' },
  { label: 'Berita Sekolah', to: '/berita' },
  { label: 'Pengumuman', to: '/pengumuman' },
  { label: 'Tentang Sekolah', to: '/profil' },
  { label: 'Kontak Kami', to: '/kontak' },
];

const Footer = () => (
  <footer className="sh-footer">
    <div className="sh-footer__inner">
      <div>
        <span className="sh-footer__badge">Portal Sekolah</span>
        <h2>{SCHOOL.name}</h2>
        <p>
          Sekolah dasar negeri yang mendampingi anak belajar dengan tenang lewat kelas kecil,
          guru wali yang mengenal setiap murid, dan lingkungan yang aman.
        </p>
      </div>

      <nav aria-label="Tautan cepat footer">
        <h3>Tautan Cepat</h3>
        <ul>
          {quickLinks.map((item) => (
            <li key={item.to}>
              <Link to={item.to}>
                {item.label}
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <address className="not-italic" style={{ fontStyle: 'normal' }}>
        <h3>Kontak</h3>
        <ul>
          <li>
            <a href={SCHOOL.contact.mapUrl} target="_blank" rel="noopener noreferrer">
              <MapPin className="h-5 w-5" style={{ flexShrink: 0 }} aria-hidden="true" />
              {SCHOOL.contact.address}
            </a>
          </li>
          <li>
            <a href={SCHOOL.contact.phoneHref}>
              <Phone className="h-5 w-5" aria-hidden="true" />
              {SCHOOL.contact.phone}
            </a>
          </li>
          <li>
            <a href={SCHOOL.contact.emailHref}>
              <Mail className="h-5 w-5" aria-hidden="true" />
              {SCHOOL.contact.email}
            </a>
          </li>
        </ul>
      </address>
    </div>

    <div className="sh-footer__copy">
      <p>&copy; {new Date().getFullYear()} {SCHOOL.name}. Seluruh hak cipta dilindungi.</p>
    </div>
  </footer>
);

export default Footer;
