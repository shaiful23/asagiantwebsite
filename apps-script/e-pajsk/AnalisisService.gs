/* =========================================================================
 * AnalisisService.gs — Statistik kelengkapan (Dashboard), Analisis Terperinci
 * mengikut kategori, dan alat pentadbiran yang dahulu memerlukan Google Sheet
 * (sunting jadual skor REFERENSI, kosongkan cache, baiki struktur Sheet).
 * ========================================================================= */

const KOMPONEN_SKOR = [
  ['SkorJawatan', 'Jawatan', 10], ['SkorLibat', 'Pelibatan', 20], ['SkorCapai', 'Pencapaian', 20],
  ['SkorKomit', 'Komitmen', 10], ['SkorKhidmat', 'Khidmat sumbangan', 10], ['SkorKehadiran', 'Kehadiran', 40]
];
const MEDAN_EKSTRA_LABEL = [
  ['Perkhidmatan', 'Perkhidmatan'], ['AnugerahKhas', 'Anugerah khas'], ['KhidmatMasyarakat', 'Khidmat masyarakat'],
  ['Nilam', 'NILAM'], ['TimmsPisa', 'TIMSS / PISA'], ['TugasKhas', 'Tugas khas']
];
const PERINGKAT_PENCAPAIAN = ['SEKOLAH', 'ZON', 'DAERAH', 'BAHAGIAN', 'NEGERI', 'KEBANGSAAN', 'ANTARABANGSA'];

function kiraanBaharu() { return { isi: 0, perlu: 0 }; }
function peratusDaripada(k) { return k.perlu ? Math.round(k.isi / k.perlu * 1000) / 10 : null; }

/* Statistik kelengkapan satu kumpulan murid, mengikut jenis data:
   - medan wajib aspek (Jawatan, Pelibatan, Komitmen) dikira ke atas setiap penyertaan aspek (murid × aspek beruntuk);
   - setiap aspek (PBB/KP/SP): rekod lengkap / murid beruntuk;
   - CGPA tahun sebelum: Tingkatan 2 ke atas sahaja;
   - ekstra kurikulum: maklumat (pilihan, tidak menjejaskan status lengkap);
   - keseluruhan: murid yang lengkap SEMUA bahagian (sama seperti semakKelengkapan). */
function statistikKumpulan(senaraiMurid, aspekMap, ekstraMap) {
  const s = { bil: senaraiMurid.length, lengkap: 0, proses: 0, belum: 0, medan: {}, aspek: {}, cgpa: kiraanBaharu(), ekstra: kiraanBaharu() };
  MEDAN_WAJIB_ASPEK.forEach(([, label]) => { s.medan[label] = kiraanBaharu(); });
  SEMUA_ASPEK.forEach(a => {
    s.aspek[a] = { lengkap: 0, perlu: 0, medan: {} };
    MEDAN_WAJIB_ASPEK.forEach(([, label]) => { s.aspek[a].medan[label] = kiraanBaharu(); });
  });
  senaraiMurid.forEach(m => {
    const nokp = normalKP(m.NoKP);
    const k = semakKelengkapan(m, aspekMap, ekstraMap);
    if (k.status === ST_LENGKAP) s.lengkap++; else if (k.status === ST_PROSES) s.proses++; else s.belum++;
    SEMUA_ASPEK.forEach(a => {
      const rec = aspekMap[kunciAspek(nokp, a)];
      if (!((rec && rec.Unit) || m[a + '_Unit'])) return;
      const r = rec || {};
      const sa = s.aspek[a];
      sa.perlu++;
      let semua = true;
      MEDAN_WAJIB_ASPEK.forEach(([medan, label]) => {
        const ada = medan === 'KOMITMEN' ? ![r.Komit1, r.Komit2, r.Komit3, r.Komit4].every(medanKosong) : !medanKosong(r[medan]);
        sa.medan[label].perlu++; s.medan[label].perlu++;
        if (ada) { sa.medan[label].isi++; s.medan[label].isi++; } else semua = false;
      });
      if (semua) sa.lengkap++;
    });
    if (WAJIB_CGPA_SEBELUM && nomborTingkatan(m.Tingkatan) >= 2) {
      s.cgpa.perlu++;
      if (!medanKosong(m.CGPA_Sebelum)) s.cgpa.isi++;
    }
    s.ekstra.perlu++;
    const ek = ekstraMap[nokp];
    if (ek && MEDAN_EKSTRA_LABEL.some(([f]) => !medanKosong(ek[f]))) s.ekstra.isi++;
  });
  return s;
}

/* Bentuk ringkas untuk klien (peratus siap dikira). */
function paparStatistik(s) {
  const medan = {}, aspek = {};
  Object.keys(s.medan).forEach(l => { medan[l] = { isi: s.medan[l].isi, perlu: s.medan[l].perlu, pc: peratusDaripada(s.medan[l]) }; });
  Object.keys(s.aspek).forEach(a => {
    const x = s.aspek[a], md = {};
    Object.keys(x.medan).forEach(l => { md[l] = { isi: x.medan[l].isi, perlu: x.medan[l].perlu, pc: peratusDaripada(x.medan[l]) }; });
    aspek[a] = { lengkap: x.lengkap, perlu: x.perlu, pc: x.perlu ? Math.round(x.lengkap / x.perlu * 1000) / 10 : null, medan: md };
  });
  return {
    bil: s.bil, lengkap: s.lengkap, proses: s.proses, belum: s.belum,
    pcLengkap: s.bil ? Math.round(s.lengkap / s.bil * 1000) / 10 : 0,
    medan, aspek,
    cgpa: { isi: s.cgpa.isi, perlu: s.cgpa.perlu, pc: peratusDaripada(s.cgpa) },
    ekstra: { isi: s.ekstra.isi, perlu: s.ekstra.perlu, pc: peratusDaripada(s.ekstra) }
  };
}

/* Kelengkapan setiap kelas dalam skop + jumlah keseluruhan (dipanggil oleh apiDashboard). */
function kelengkapanIkutKelas(skop) {
  const k = muatKonteks(null);
  const ikutKelas = {};
  const dalam = k.murid.filter(m => dalamSkop(skop, m.KunciKelas));
  dalam.forEach(m => { (ikutKelas[m.KunciKelas] = ikutKelas[m.KunciKelas] || []).push(m); });
  const kelas = {};
  Object.keys(ikutKelas).forEach(kunci => { kelas[kunci] = paparStatistik(statistikKumpulan(ikutKelas[kunci], k.aspekMap, k.ekstraMap)); });
  return { kelas, jumlah: paparStatistik(statistikKumpulan(dalam, k.aspekMap, k.ekstraMap)) };
}

/* ------------------------- ANALISIS TERPERINCI ------------------------- */
function taburanGredKosong() { return { A: 0, B: 0, C: 0, D: 0, E: 0 }; }

function pengumpul() { return { bil: 0, dinilai: 0, jumlahMarkah: 0, gred: taburanGredKosong() }; }
function tambahPengumpul(p, markah, gred) {
  p.bil++;
  if (markah > 0) { p.dinilai++; p.jumlahMarkah += markah; }
  if (p.gred[gred] !== undefined) p.gred[gred]++;
}
function siapPengumpul(p, label, kunci) {
  const bergred = p.gred.A + p.gred.B + p.gred.C + p.gred.D + p.gred.E;
  const gp = bergred ? bundar2((p.gred.A + p.gred.B * 2 + p.gred.C * 3 + p.gred.D * 4 + p.gred.E * 5) / bergred) : 0;
  return { kunci: kunci || label, label, bil: p.bil, dinilai: p.dinilai, purata: p.dinilai ? bundar2(p.jumlahMarkah / p.dinilai) : 0,
    gred: p.gred, gredPurata: gp, gps: gp ? bundar2((5 - gp) / 4 * 100) : 0 };
}

function peringkatDaripadaLabel(label) {
  const t = String(label || '').toUpperCase();
  if (!t) return '';
  for (let i = PERINGKAT_PENCAPAIAN.length - 1; i >= 0; i--) if (t.indexOf(PERINGKAT_PENCAPAIAN[i]) !== -1) return PERINGKAT_PENCAPAIAN[i];
  return 'LAIN';
}

/* Analisis terperinci bagi skop pengguna (Admin: semua; Guru Tingkatan: kelas sendiri), ditapis tingkatan/kelas. */
function apiAnalisis(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const skop = skopKelas(sesi);
  const tingkatan = Number(p.tingkatan) || 0;
  const kelasPilih = String(p.kelas || '').trim();
  if (kelasPilih && !sesiBolehKelas(sesi, kelasPilih)) return ralat('Anda tidak mempunyai akses kepada kelas ini.');

  const k = muatKonteks(null);
  const murid = k.murid.filter(m => dalamSkop(skop, m.KunciKelas) && (!kelasPilih || m.KunciKelas === kelasPilih) &&
    (!tingkatan || nomborTingkatan(m.Tingkatan) === tingkatan));

  const keseluruhan = pengumpul();
  const ikutAspek = {}, ikutUnit = {}, ikutTingkatan = {}, ikutKelas = {}, ikutJantina = {};
  const komponen = {};
  SEMUA_ASPEK.forEach(a => {
    ikutAspek[a] = pengumpul();
    komponen[a] = {};
    KOMPONEN_SKOR.forEach(([f]) => { komponen[a][f] = 0; });
  });
  const kehadiran = { '0': 0, '1-3': 0, '4-6': 0, '7-9': 0, '10-12': 0 };
  const peringkat = {};
  PERINGKAT_PENCAPAIAN.concat(['LAIN']).forEach(x => { peringkat[x] = 0; });
  const jawatan = {};
  const ekstra = {};
  MEDAN_EKSTRA_LABEL.forEach(([f, l]) => { ekstra[f] = { label: l, isi: 0, pilihan: {} }; });
  let jumlahCgpa = 0, bilCgpa = 0;

  murid.forEach(m => {
    const nokp = m.NoKP;
    const r = k.rumusanMap[nokp] || {};
    const cg = nombor(r.CGPA);
    const gred = String(r.Gred || '');
    tambahPengumpul(keseluruhan, cg, gred);
    if (cg > 0) { jumlahCgpa += cg; bilCgpa++; }
    const t = nomborTingkatan(m.Tingkatan) || 0;
    tambahPengumpul(ikutTingkatan[t] = ikutTingkatan[t] || pengumpul(), cg, gred);
    tambahPengumpul(ikutKelas[m.KunciKelas] = ikutKelas[m.KunciKelas] || pengumpul(), cg, gred);
    const jt = String(m.Jantina || '').toUpperCase();
    const j = jt.charAt(0) === 'L' ? 'L' : jt.charAt(0) === 'P' ? 'P' : '?';
    tambahPengumpul(ikutJantina[j] = ikutJantina[j] || pengumpul(), cg, gred);

    SEMUA_ASPEK.forEach(a => {
      const rec = k.aspekMap[kunciAspek(nokp, a)];
      const unit = banding((rec && rec.Unit) || m[a + '_Unit'] || '');
      if (!unit) return;
      const mk = nombor(rec && rec.Markah);
      const g = mk > 0 ? gredAspek(mk) : '';
      tambahPengumpul(ikutAspek[a], mk, g);
      const ku = kunciUnit(a, unit);
      const pu = ikutUnit[ku] = ikutUnit[ku] || Object.assign(pengumpul(), { aspek: a, unit, hadir: 0, lengkap: 0 });
      tambahPengumpul(pu, mk, g);
      if (!rec) return;
      KOMPONEN_SKOR.forEach(([f]) => { komponen[a][f] += nombor(rec[f]); });
      const h = nombor(rec.Kehadiran);
      pu.hadir += h;
      kehadiran[h <= 0 ? '0' : h <= 3 ? '1-3' : h <= 6 ? '4-6' : h <= 9 ? '7-9' : '10-12']++;
      if (statusRekodAspek(rec).status === ST_LENGKAP) pu.lengkap++;
      [rec.Capai1, rec.Capai2].forEach(c => { const pk = peringkatDaripadaLabel(c); if (pk) peringkat[pk]++; });
      if (rec.Jawatan) jawatan[rec.Jawatan] = (jawatan[rec.Jawatan] || 0) + 1;
    });

    const ek = k.ekstraMap[nokp];
    if (ek) MEDAN_EKSTRA_LABEL.forEach(([f]) => {
      if (medanKosong(ek[f])) return;
      ekstra[f].isi++;
      ekstra[f].pilihan[ek[f]] = (ekstra[f].pilihan[ek[f]] || 0) + 1;
    });
  });

  const aspek = SEMUA_ASPEK.map(a => {
    const x = siapPengumpul(ikutAspek[a], NAMA_ASPEK[a], a);
    const n = ikutAspek[a].bil || 1;
    x.komponen = KOMPONEN_SKOR.map(([f, label, maks]) => ({ kunci: f, label, maks, purata: bundar2(komponen[a][f] / n), pc: bundar2(komponen[a][f] / n / maks * 100) }));
    return x;
  });
  const unit = Object.keys(ikutUnit).map(ku => {
    const u = ikutUnit[ku];
    const x = siapPengumpul(u, u.unit, ku);
    x.aspek = u.aspek;
    x.purataHadir = u.bil ? bundar2(u.hadir / u.bil) : 0;
    x.pcLengkap = u.bil ? Math.round(u.lengkap / u.bil * 100) : 0;
    return x;
  }).sort((a, b) => SEMUA_ASPEK.indexOf(a.aspek) - SEMUA_ASPEK.indexOf(b.aspek) || b.purata - a.purata);
  const ting = Object.keys(ikutTingkatan).map(Number).sort().map(t => siapPengumpul(ikutTingkatan[t], t ? 'Tingkatan ' + t : 'Tiada tingkatan', String(t)));
  const kelas = Object.keys(ikutKelas).sort().map(kk => siapPengumpul(ikutKelas[kk], paparKelas(kk), kk));
  const jantina = ['L', 'P', '?'].filter(j => ikutJantina[j]).map(j => siapPengumpul(ikutJantina[j], j === 'L' ? 'Lelaki' : j === 'P' ? 'Perempuan' : 'Tidak dikenal pasti', j));
  const jawatanTeratas = Object.keys(jawatan).map(l => ({ label: l, bil: jawatan[l] })).sort((a, b) => b.bil - a.bil).slice(0, 12);
  const ekstraSenarai = MEDAN_EKSTRA_LABEL.map(([f]) => {
    const e = ekstra[f];
    return { kunci: f, label: e.label, isi: e.isi, teratas: Object.keys(e.pilihan).map(l => ({ label: l, bil: e.pilihan[l] })).sort((a, b) => b.bil - a.bil).slice(0, 5) };
  });
  const lengkap = paparStatistik(statistikKumpulan(murid, k.aspekMap, k.ekstraMap));

  return jaya({
    tahun: tahunSemasa(), bilMurid: murid.length, dinilai: bilCgpa, purataCgpa: bilCgpa ? bundar2(jumlahCgpa / bilCgpa) : 0,
    keseluruhan: siapPengumpul(keseluruhan, 'Keseluruhan'), aspek, unit, tingkatan: ting, kelas, jantina,
    kehadiran, peringkat, jawatan: jawatanTeratas, ekstra: ekstraSenarai, kelengkapan: lengkap
  });
}

/* ------------------------- ALAT PENTADBIRAN (tanpa buka Google Sheet) ------------------------- */
/* Senarai penuh REFERENSI dikumpulkan mengikut JENIS (untuk penyunting jadual skor). */
function apiJadualSkor(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const kumpulan = {};
  bacaSheetSebagaiObjek(SHEET_REFERENSI).forEach(r => {
    const j = String(r.JENIS || '').trim();
    if (!j) return;
    (kumpulan[j] = kumpulan[j] || []).push({ kod: String(r.KOD), nilai: r.NILAI, keterangan: String(r.KETERANGAN || '') });
  });
  return jaya({ jenis: Object.keys(kumpulan).sort(), kumpulan });
}

/* Tambah / kemas kini / padam satu baris REFERENSI. p: {asal:{jenis,kod}?, jenis, kod, nilai, keterangan, padam} */
function apiSimpanBarisSkor(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const jenis = String(p.jenis || '').trim().toUpperCase();
  const kod = String(p.kod || '').trim();
  const asal = p.asal ? { jenis: String(p.asal.jenis || '').trim(), kod: String(p.asal.kod || '').trim() } : null;
  if (!p.padam) {
    if (!/^[A-Z_]{3,40}$/.test(jenis)) return ralat('JENIS tidak sah (huruf besar dan _ sahaja).');
    if (!kod || kod.length > 120) return ralat('KOD (label pilihan) diperlukan, maksimum 120 aksara.');
    if (String(p.nilai).trim() === '' || isNaN(Number(p.nilai))) return ralat('NILAI mesti nombor.');
    if (Number(p.nilai) < 0 || Number(p.nilai) > 110) return ralat('NILAI mesti antara 0 dan 110.');
  }
  return denganKunci(() => {
    const semua = bacaSheetMentah(SHEET_REFERENSI);
    const cari = (j, kd) => semua.find(r => String(r.JENIS).trim() === j && String(r.KOD).trim() === kd);
    const sasaran = asal ? cari(asal.jenis, asal.kod) : null;
    if (asal && !sasaran) return ralat('Baris asal tidak dijumpai (mungkin telah diubah). Muat semula senarai.');
    if (p.padam) {
      padamBaris(SHEET_REFERENSI, sasaran.__row, sasaran.JENIS);
      catatAudit(sesi, 'PADAM', 'REFERENSI', asal.jenis, asal.kod);
    } else {
      const pendua = cari(jenis, kod);
      if (pendua && pendua !== sasaran) return ralat('Pilihan "' + kod + '" sudah wujud dalam ' + jenis + '.');
      const obj = { JENIS: jenis, KOD: kod, NILAI: Number(p.nilai), KETERANGAN: String(p.keterangan || '').trim().substring(0, 300) };
      if (sasaran) {
        dapatkanSheet(SHEET_REFERENSI).getRange(sasaran.__row, 1, 1, HEADER_REFERENSI.length).setValues([objekKeBaris(obj, HEADER_REFERENSI)]);
        tandaKotor(SHEET_REFERENSI);
      } else tambahBaris(SHEET_REFERENSI, obj);
      catatAudit(sesi, sasaran ? 'KEMASKINI' : 'TAMBAH', 'REFERENSI', jenis, kod + ' = ' + obj.NILAI);
    }
    kosongkanCacheRujukan();
    return jaya({ rujukan: muatRujukan() });
  });
}

function apiKosongkanCache(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  [SHEET_PENGGUNA, SHEET_MURID, SHEET_ASPEK, SHEET_EKSTRA, SHEET_RUMUSAN, SHEET_REFERENSI, SHEET_TETAPAN, SHEET_ARKIB, SHEET_PERMOHONAN].forEach(tandaKotor);
  kosongkanCacheRujukan();
  CacheService.getScriptCache().remove('struktur_epajsk_v6');
  catatAudit(sesi, 'KOSONGKAN_CACHE', 'SISTEM', '', 'Semua cache dikosongkan melalui UI');
  return jaya({});
}

/* Cipta Sheet/lajur yang hilang (sama seperti menu "Sediakan Sistem" tetapi tanpa dialog). */
function apiBaikiStruktur(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  return denganKunci(() => {
    const ss = spreadsheetAktif();
    const dicipta = [];
    [[SHEET_PENGGUNA, HEADER_PENGGUNA, ['NoKP', 'Password']], [SHEET_MURID, HEADER_MURID, ['NoKP']], [SHEET_ASPEK, HEADER_ASPEK, ['Kunci', 'NoKP']],
      [SHEET_EKSTRA, HEADER_EKSTRA, ['NoKP']], [SHEET_RUMUSAN, HEADER_RUMUSAN, ['NoKP']], [SHEET_REFERENSI, HEADER_REFERENSI, ['KOD']],
      [SHEET_TETAPAN, HEADER_TETAPAN, null], [SHEET_ARKIB, HEADER_ARKIB, null], [SHEET_AUDIT, HEADER_AUDIT, ['NoKP']],
      [SHEET_PERMOHONAN, HEADER_PERMOHONAN, ['NoKP', 'Tarikh', 'BukaHingga', 'TarikhProses']]
    ].forEach(([nama, header, teks]) => {
      if (ss.getSheetByName(nama)) return;
      const sh = ciptaSheetJikaTiada(ss, nama, header, teks);
      if (nama === SHEET_REFERENSI) { const isi = referensiLalai(); sh.getRange(2, 1, isi.length, header.length).setValues(isi); }
      if (nama === SHEET_TETAPAN) { const isi = tetapanLalai(); sh.getRange(2, 1, isi.length, header.length).setValues(isi); }
      dicipta.push(nama);
      tandaKotor(nama);
    });
    const lajur = LAJUR_PENGGUNA_UNIT.filter(l => tambahLajurJikaTiada(SHEET_PENGGUNA, l));
    if (tambahLajurJikaTiada(SHEET_ASPEK, 'JawatanKoko')) lajur.push('JawatanKoko');
    if (tambahLajurJikaTiada(SHEET_ASPEK, 'PencapaianKoko')) lajur.push('PencapaianKoko');
    kosongkanCacheRujukan();
    catatAudit(sesi, 'BAIKI_STRUKTUR', 'SISTEM', '', (dicipta.join(', ') || 'tiada Sheet baharu') + (lajur.length ? '; lajur: ' + lajur.join(', ') : ''));
    return jaya({ dicipta, lajur });
  });
}
