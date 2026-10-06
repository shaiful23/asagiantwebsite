/* =========================================================================
 * AgihanService.gs — Alat membahagikan murid kepada rumah sukan.
 *
 * Kriteria (boleh diubah di UI, lalai dalam Config.gs KRITERIA_LALAI):
 *  1. ATLET diagih DAHULU, sama rata ke semua rumah mengikut kategori & jantina
 *     (pilihan: atlet bagi acara yang sama turut disebar ke semua rumah).
 *  2. Murid BUKAN atlet diagih sama rata mengikut kategori & jantina, dengan
 *     syarat setiap KELAS mempunyai bilangan ahli hampir sama bagi setiap rumah
 *     mengikut jantina (atlet dalam kelas itu turut dikira).
 *
 * Algoritma tamak (greedy) berprioriti: bagi setiap murid, rumah dipilih yang
 * mempunyai kiraan TERKECIL mengikut vektor keutamaan (dibanding leksikografi);
 * seri dipecahkan oleh susunan rawak berbiji (seed). Seed yang sama + data yang
 * sama = hasil yang sama, jadi Pratonton dan Simpan memberi agihan yang serupa.
 * ========================================================================= */

/* ------------------------- RAWAK BERBIJI ------------------------- */
function penjanaRawak(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return function () {   // mulberry32
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function kocok(arr, rawak) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rawak() * (i + 1));
    const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function normalKriteria(k) {
  const a = Object.assign({}, KRITERIA_LALAI, k || {});
  ['atletDahulu', 'atletIkutAcara', 'ikutKategori', 'ikutJantina', 'ikutKelas', 'hormatKunci'].forEach(x => { a[x] = !!a[x]; });
  a.skop = a.skop === 'BAHARU' ? 'BAHARU' : 'SEMUA';
  return a;
}

/* ------------------------- TERAS ALGORITMA ------------------------- */
/* Pulangkan { tugasan: {nokp: rumahId}, murid: [...], rumah: [...], bilDiagih, bilTetap } */
function jalankanAgihan(kriteria, seed) {
  const k = normalKriteria(kriteria);
  const rumah = senaraiRumah();
  if (rumah.length < 2) throw new Error('Tetapkan sekurang-kurangnya 2 rumah sukan dahulu (menu Tetapan Rumah Sukan).');
  const ada = {};
  rumah.forEach(r => { ada[r.id] = true; });
  const cfg = konfigKategori();
  const rawak = penjanaRawak(seed);

  const murid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => m.NoKP && aktif(m)).map(m => ({
    nokp: normalKP(m.NoKP), nama: m.NamaPenuh, jan: m.Jantina || jantinaDaripadaKP(m.NoKP),
    kat: kategoriMurid(m, cfg) || '?', kelas: kunciKelas(m), atlet: ya(m.Atlet),
    acara: senaraiDaripadaMedan(String(m.Acara || '').replace(/[;\/]/g, ',')).map(banding),
    asal: ada[m.RumahId] ? String(m.RumahId) : '', kunci: ya(m.KunciRumah)
  }));

  // kunci kiraan
  const kG = m => 'G|' + (k.ikutKategori ? m.kat : '*') + '|' + (k.ikutJantina ? m.jan : '*');
  const kA = m => 'A' + kG(m);
  const kC = m => 'C|' + m.kelas + '|' + (k.ikutJantina ? m.jan : '*');
  const kE = (m, acara) => 'E' + kG(m) + '|' + acara;
  const kira = {};   // kira[kunci][rumahId]
  const tambah = (kunci, id) => { const x = kira[kunci] = kira[kunci] || {}; x[id] = (x[id] || 0) + 1; };
  const nilai = (kunci, id) => (kira[kunci] && kira[kunci][id]) || 0;
  const daftar = (m, id) => {
    m.baru = id;
    tambah(kG(m), id); tambah(kC(m), id); tambah('T', id);
    if (m.atlet) { tambah(kA(m), id); m.acara.forEach(a => tambah(kE(m, a), id)); }
  };

  // murid yang KEKAL (dikunci, atau skop BAHARU dan sudah ada rumah) dikira dahulu
  const tetap = [], agih = [];
  murid.forEach(m => {
    const kekal = m.asal && ((k.hormatKunci && m.kunci) || k.skop === 'BAHARU');
    if (kekal) { daftar(m, m.asal); tetap.push(m); } else agih.push(m);
  });

  const vektor = (m, id, fasaAtlet) => {
    if (fasaAtlet) {
      let acara = 0;
      if (k.atletIkutAcara) m.acara.forEach(a => { acara += nilai(kE(m, a), id); });
      return [nilai(kA(m), id), acara, k.ikutKelas ? nilai(kC(m), id) : 0, nilai(kG(m), id), nilai('T', id)];
    }
    return [k.ikutKelas ? nilai(kC(m), id) : 0, nilai(kG(m), id), nilai('T', id)];
  };
  const pilihRumah = (m, fasaAtlet) => {
    const calon = kocok(rumah.map(r => r.id), rawak);
    let terbaik = null, vTerbaik = null;
    calon.forEach(id => {
      const v = vektor(m, id, fasaAtlet);
      let lebihBaik = vTerbaik === null;
      for (let i = 0; !lebihBaik && i < v.length; i++) {
        if (v[i] < vTerbaik[i]) lebihBaik = true;
        else if (v[i] > vTerbaik[i]) break;
      }
      if (lebihBaik) { terbaik = id; vTerbaik = v; }
    });
    return terbaik;
  };

  // FASA 1 — atlet: ikut kumpulan (kategori/jantina); atlet berbilang acara dahulu (paling sukar diimbangi)
  const atlet = k.atletDahulu ? agih.filter(m => m.atlet) : [];
  kocok(atlet, rawak).sort((a, b) => kG(a).localeCompare(kG(b)) || (b.acara.length - a.acara.length));
  atlet.forEach(m => daftar(m, pilihRumah(m, true)));

  // FASA 2 — bukan atlet (atau semua jika atlet tidak didahulukan): kelas demi kelas
  const baki = agih.filter(m => !(k.atletDahulu && m.atlet));
  const ikutKelas = {};
  baki.forEach(m => { (ikutKelas[m.kelas] = ikutKelas[m.kelas] || []).push(m); });
  kocok(Object.keys(ikutKelas), rawak).forEach(kl => {
    kocok(ikutKelas[kl], rawak).forEach(m => daftar(m, pilihRumah(m, false)));
  });

  const tugasan = {};
  murid.forEach(m => { tugasan[m.nokp] = m.baru; });
  return { tugasan, murid, rumah, cfg, kriteria: k, bilDiagih: agih.length, bilTetap: tetap.length };
}

/* ------------------------- RINGKASAN (pratonton / semasa) ------------------------- */
/* murid: [{nokp, jan, kat, kelas, atlet, asal, baru}] — 'baru' = rumah selepas agihan */
function binaRingkasan(murid, rumah, cfg) {
  const ids = rumah.map(r => r.id);
  const kosong = () => { const o = {}; ids.concat(['']).forEach(id => { o[id] = 0; }); return o; };
  const perRumah = {};
  ids.concat(['']).forEach(id => { perRumah[id] = { jumlah: 0, L: 0, P: 0, atlet: 0, atletL: 0, atletP: 0, kat: {} }; });
  const kelas = {};
  let dipindah = 0;
  murid.forEach(m => {
    const id = m.baru || '';
    const r = perRumah[id] || perRumah[''];
    const j = m.jan === 'PEREMPUAN' ? 'P' : 'L';
    r.jumlah++; r[j]++;
    if (m.atlet) { r.atlet++; r['atlet' + j]++; }
    const kk = m.kat + '|' + j;
    r.kat[kk] = r.kat[kk] || { semua: 0, atlet: 0 };
    r.kat[kk].semua++;
    if (m.atlet) r.kat[kk].atlet++;
    const c = kelas[m.kelas] = kelas[m.kelas] || { kelas: m.kelas, L: kosong(), P: kosong(), jumlah: 0 };
    c[j][id]++; c.jumlah++;
    if (m.asal && m.baru && m.asal !== m.baru) dipindah++;
  });
  const julat = (o) => { const v = ids.map(id => o[id]); return Math.max.apply(null, v) - Math.min.apply(null, v); };
  const senaraiKelas = Object.keys(kelas).sort((a, b) => a.localeCompare(b, 'ms', { numeric: true })).map(kl => {
    const c = kelas[kl];
    return { kelas: kl, jumlah: c.jumlah, L: c.L, P: c.P, julatL: julat(c.L), julatP: julat(c.P), tiadaRumah: c.L[''] + c.P[''] };
  });
  const katSenarai = cfg.senarai.map(x => ({ kod: x.kod, nama: x.nama })).concat([{ kod: '?', nama: 'Tidak dapat ditentukan' }]);
  return {
    rumah: rumah.map(r => Object.assign({ id: r.id, nama: r.nama, warna: r.warna }, perRumah[r.id])),
    tiadaRumah: perRumah[''].jumlah,
    kategori: katSenarai.filter(x => x.kod !== '?' || murid.some(m => m.kat === '?')),
    kelas: senaraiKelas,
    jumlahMurid: murid.length,
    dipindah,
    julatKelasMaks: senaraiKelas.reduce((mx, c) => Math.max(mx, c.julatL, c.julatP), 0),
    kelasTidakSeimbang: senaraiKelas.filter(c => c.julatL > 1 || c.julatP > 1).length
  };
}

/* Taburan SEMASA (tanpa mengubah apa-apa). */
function apiRingkasanAgihan(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const rumah = senaraiRumah();
  const ada = {};
  rumah.forEach(r => { ada[r.id] = true; });
  const cfg = konfigKategori();
  const murid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => m.NoKP && aktif(m)).map(m => {
    const id = ada[m.RumahId] ? String(m.RumahId) : '';
    return { jan: m.Jantina || jantinaDaripadaKP(m.NoKP), kat: kategoriMurid(m, cfg) || '?', kelas: kunciKelas(m), atlet: ya(m.Atlet), asal: id, baru: id };
  });
  const tet = bacaTetapan();
  return jaya({ ringkasan: binaRingkasan(murid, rumah, cfg), kriteria: kriteriaAgihan(tet), terakhir: tet[TET_AGIHAN_TERAKHIR] || '' });
}

/* Jalankan agihan TANPA menyimpan. Pulangkan seed supaya Simpan menghasilkan agihan yang sama. */
function apiPratontonAgihan(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  try {
    const seed = Number(p.seed) || (Math.floor(Math.random() * 2147483646) + 1);
    const h = jalankanAgihan(p.kriteria, seed);
    return jaya({ seed, bilDiagih: h.bilDiagih, bilTetap: h.bilTetap, ringkasan: binaRingkasan(h.murid, h.rumah, h.cfg) });
  } catch (e) {
    return ralat(e.message || String(e));
  }
}

/* Jalankan semula agihan dengan seed pratonton dan SIMPAN ke Sheet MURID. Kriteria turut disimpan sebagai lalai. */
function apiSimpanAgihan(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const seed = Number(p.seed);
  if (!seed) return ralat('Sila jalankan Pratonton dahulu.');
  return denganKunci(() => {
    const h = jalankanAgihan(p.kriteria, seed);
    const masa = sekarangTeks();
    const objek = h.murid.filter(m => m.baru && m.baru !== m.asal).map(m => ({ NoKP: m.nokp, RumahId: m.baru, Dikemaskini: masa }));
    upsertBanyak(SHEET_MURID, 'NoKP', objek);
    const ring = binaRingkasan(h.murid, h.rumah, h.cfg);
    const teks = masa + ' oleh ' + sesi.nama + ': ' + h.bilDiagih + ' murid diagih (' + objek.length + ' bertukar rumah), ' +
      h.bilTetap + ' kekal. ' + ring.rumah.map(r => r.nama + ' ' + r.jumlah).join(', ');
    const peta = {};
    peta[TET_KRITERIA] = JSON.stringify(h.kriteria);
    peta[TET_AGIHAN_TERAKHIR] = teks;
    simpanTetapan(peta);
    catatAudit(sesi, 'AGIHAN_MURID', 'MURID', String(seed), teks);
    return jaya({ bilDikemaskini: objek.length, ringkasan: ring });
  });
}

function apiSimpanKriteria(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  return denganKunci(() => {
    const peta = {};
    peta[TET_KRITERIA] = JSON.stringify(normalKriteria(p.kriteria));
    simpanTetapan(peta);
    catatAudit(sesi, 'SIMPAN_KRITERIA', 'TETAPAN', '', peta[TET_KRITERIA]);
    return jaya({});
  });
}
