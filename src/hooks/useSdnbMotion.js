import { useEffect } from 'react';

/**
 * Ported VERBATIM from the `componentDidMount()` + `countUp()` methods of the
 * Design Canvas logic class in "Beranda SMAN Baturaja.dc.html".
 *
 * Two behaviours, both driven by data attributes so the ported markup keeps the
 * exact same attributes the mockups use:
 *
 *  - `[data-reveal]`  — fade/slide a section in when it scrolls into view. The
 *                       attribute value is the delay in milliseconds.
 *  - `[data-count]`   — count a number up from 0 to the attribute value over
 *                       1.5s, formatted with Indonesian thousands separators.
 *
 * The retry loop (`tries`) is kept from the original: the mockup runtime mounts
 * markup asynchronously, and React's first paint can likewise land after this
 * effect, so both scans retry until nodes appear.
 *
 * @param {Array} deps - re-scan when these change (async content arriving).
 */
export default function useSdnbMotion(deps = []) {
  useEffect(() => {
    const kurangiGerak = Boolean(window.matchMedia)
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let io = null;
    let cio = null;
    const timers = [];

    const fmt = (n) => n.toLocaleString('id-ID');

    /**
     * Menulis angka akhir tanpa animasi.
     *
     * Dulu seluruh hook ini keluar lebih awal ketika pengunjung meminta lebih
     * sedikit gerakan. Masalahnya, angka pada markup ditulis sebagai
     * `<span data-count="624">0</span>` — nolnya adalah teks nyata, dan
     * animasinyalah yang menggantinya. Tanpa animasi, angka itu tinggal nol
     * selamanya: halaman depan mengaku punya "0 Siswa aktif" dan "0 Guru".
     *
     * Yang seharusnya dikurangi adalah GERAKANNYA, bukan informasinya.
     */
    const tulisLangsung = (tries) => {
      const nums = Array.from(document.querySelectorAll('[data-count]'));
      if (!nums.length) {
        if (tries < 20) timers.push(setTimeout(() => tulisLangsung(tries + 1), 120));
        return;
      }
      nums.forEach((el) => {
        const target = parseFloat(el.getAttribute('data-count'));
        if (!Number.isFinite(target)) return;
        el.style.fontVariantNumeric = 'tabular-nums';
        el.textContent = el.hasAttribute('data-plain') ? String(target) : fmt(target);
      });
    };

    if (kurangiGerak) {
      timers.push(setTimeout(() => tulisLangsung(0), 60));
      return () => timers.forEach(clearTimeout);
    }

    const setup = (tries) => {
      const els = Array.from(document.querySelectorAll('[data-reveal]'));
      if (!els.length) {
        if (tries < 20) timers.push(setTimeout(() => setup(tries + 1), 120));
        return;
      }
      els.forEach((el) => {
        if (el.__rv) return;
        el.__rv = 1;
        el.style.opacity = '0';
        el.style.transform = 'translate3d(0,42px,0) scale(.982)';
        el.style.transition = 'opacity .85s cubic-bezier(.22,.85,.28,1), transform 1s cubic-bezier(.22,.85,.28,1)';
        el.style.willChange = 'opacity, transform';
      });
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const d = parseInt(el.getAttribute('data-reveal') || '0', 10);
          timers.push(setTimeout(() => {
            el.style.opacity = '1';
            el.style.transform = 'none';
            // `Profil Sekolah.dc.html` extends the reveal: a `[data-grow]` child
            // (the timeline axis) animates its width once the section is in.
            const grow = el.querySelector('[data-grow]');
            if (grow) timers.push(setTimeout(() => { grow.style.width = '100%'; }, 220));
            timers.push(setTimeout(() => {
              el.style.willChange = 'auto';
              el.style.transform = '';
              el.style.transition = '';
            }, 1100));
          }, d));
          io.unobserve(el);
        });
      }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
      els.forEach((el) => io.observe(el));
    };

    const countUp = (tries) => {
      const nums = Array.from(document.querySelectorAll('[data-count]'));
      if (!nums.length) {
        if (tries < 20) timers.push(setTimeout(() => countUp(tries + 1), 120));
        return;
      }
      const run = (el) => {
        const target = parseFloat(el.getAttribute('data-count'));
        // `data-plain` (Profil Sekolah) prints the raw number, so a year like
        // 1966 is not rendered as "1.966".
        const plain = el.hasAttribute('data-plain');
        const dur = 1500;
        const t0 = performance.now();
        el.style.fontVariantNumeric = 'tabular-nums';
        const tick = (now) => {
          const p = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          const val = Math.round(target * e);
          el.textContent = plain ? String(val) : fmt(val);
          if (p < 1) requestAnimationFrame(tick);
        };
        el.textContent = '0';
        requestAnimationFrame(tick);
      };
      nums.forEach((el) => { el.textContent = '0'; el.style.fontVariantNumeric = 'tabular-nums'; });
      cio = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } });
      }, { threshold: 0.4 });
      nums.forEach((el) => cio.observe(el));
    };

    timers.push(setTimeout(() => setup(0), 60));
    timers.push(setTimeout(() => countUp(0), 60));

    return () => {
      timers.forEach(clearTimeout);
      if (io) io.disconnect();
      if (cio) cio.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
