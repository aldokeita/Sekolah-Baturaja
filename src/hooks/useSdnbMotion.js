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
    let jaga = null;

    const fmt = (n) => n.toLocaleString('id-ID');

    /** Teks akhir yang seharusnya terbaca pada satu elemen `[data-count]`. */
    const nilaiAkhir = (el) => {
      const target = parseFloat(el.getAttribute('data-count'));
      if (!Number.isFinite(target)) return null;
      return el.hasAttribute('data-plain') ? String(target) : fmt(target);
    };

    /**
     * Penjaga: memindai ulang secara berkala selama beberapa detik pertama.
     *
     * Perlu karena hook ini menulis angka langsung ke DOM, sementara React bebas
     * mengganti simpul yang sama ketika data susulan tiba. Saat halaman dibuka
     * lewat klik menu (bukan reload), penggantian itu terjadi tepat setelah
     * IntersectionObserver mulai memantau: yang dipantau jadi simpul buangan, dan
     * simpul barunya tinggal berisi "0" bawaan markup. Akibatnya seluruh situs
     * mengaku "0 program berjalan", "0 Tahun berdiri", "0 ruang kelas".
     *
     * Simpul baru tidak membawa penanda __dc, jadi pemindaian ulang menemukannya
     * dan memprosesnya lagi. Dihentikan setelah BATAS_JAGA supaya tidak ada timer
     * yang hidup selamanya.
     */
    const BATAS_JAGA = 8000;
    const JEDA_JAGA = 350;
    const pasangJaga = (pindai) => {
      if (jaga) return;
      jaga = setInterval(pindai, JEDA_JAGA);
      timers.push(setTimeout(() => { clearInterval(jaga); jaga = null; }, BATAS_JAGA));
    };

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
        const akhir = nilaiAkhir(el);
        if (akhir === null || el.textContent === akhir) return;
        el.style.fontVariantNumeric = 'tabular-nums';
        el.textContent = akhir;
      });
    };

    if (kurangiGerak) {
      timers.push(setTimeout(() => tulisLangsung(0), 60));
      pasangJaga(() => tulisLangsung(20));
      return () => {
        timers.forEach(clearTimeout);
        if (jaga) clearInterval(jaga);
      };
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
      if (!cio) {
        cio = new IntersectionObserver((entries) => {
          entries.forEach((e) => { if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); } });
        }, { threshold: 0.4 });
      }
      // __dc menandai simpul yang sudah dipantau. Simpul pengganti dari React
      // tidak membawanya, jadi pemindaian berikutnya mengambilnya sebagai baru.
      nums.forEach((el) => {
        if (el.__dc) return;
        el.__dc = 1;
        el.textContent = '0';
        el.style.fontVariantNumeric = 'tabular-nums';
        cio.observe(el);
      });
      pasangJaga(() => countUp(20));
    };

    timers.push(setTimeout(() => setup(0), 60));
    timers.push(setTimeout(() => countUp(0), 60));

    return () => {
      timers.forEach(clearTimeout);
      if (jaga) clearInterval(jaga);
      if (io) io.disconnect();
      if (cio) cio.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
