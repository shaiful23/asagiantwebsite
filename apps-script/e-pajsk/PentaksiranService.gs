/* =========================================================================
 * PentaksiranService.gs — Data pentaksiran kelas, simpan pentaksiran seorang
 * murid, cadangan pencapaian daripada e-Kokurikulum dan kira semula.
 * Semua markah dikira di PELAYAN (Scoring.gs) — nilai yang dihantar klien
 * untuk skor/markah diabaikan sepenuhnya.
 * ========================================================================= */

// Medan pilihan (dropdown) pada rekod ASPEK -> jenis jadual REFERENSI yang mengesahkannya.
const PETA_PENGESAHAN_ASPEK = {
  Jawatan: 'JAWATAN', Libat1: 'PELIBATAN', Capai1: 'PENCAPAIAN', Libat2: 'PELIBATAN', Capai2: 'PENCAPAIAN',
  Komit1: 'KOMITMEN', Komit2: 'KOMITMEN', Komit3: 'KOMITMEN', Komit4: 'KOMITMEN', Khidmat: 'KHIDMAT_SUMBANGAN'
};
const PETA_PENGESAHAN_EKSTRA = {
  Perkhidmatan: 'PERKHIDMATAN', AnugerahKhas: 'ANUGERAH_KHAS', KhidmatMasyarakat: 'KHIDMAT_MASYARAKAT',
  Nilam: 'NILAM', TimmsPisa: 'TIMMS_PISA', TugasKhas: 'TUGAS_KHAS'
};

function labelSah(ref, jenis, label) {
  return label === '' || (ref.peta[jenis] && Object.prototype.hasOwnProperty.call(ref.peta[jenis], label));
}

function ringkasMurid(m, konteks) {
  const aspek = {};
  SEMUA_ASPEK.forEach(a => {
    aspek[a] = konteks.aspekMap[kunciAspek(m.NoKP, a)] || aspekKosong(m.NoKP, a, m[a + '_Unit']);
    if (!aspek[a].Unit) aspek[a].Unit = m[a + '_Unit'] || '';
  });
  return {
    nokp: m.NoKP, nama: m.Nama, jantina: m.Jantina, tingkatan: m.Tingkatan, kelas: m.Kelas, kunciKelas: m.KunciKelas,
    cgpaSebelum: m.CGPA_Sebelum, sejarah: m.SejarahCGPA, perluSemak: m.PerluSemak,
    unit: { PBB: m.PBB_Unit, KP: m.KP_Unit, SP: m.SP_Unit },
    aspek,
    ekstra: konteks.ekstraMap[m.NoKP] || ekstraKosong(m.NoKP),
    rumusan: konteks.rumusanMap[m.NoKP] || null,
    kelengkapan: (function () { const k = semakKelengkapan(m, konteks.aspekMap, konteks.ekstraMap); return { status: k.status, kurang: teksKurang(k) }; })()
  };
}

function apiDataKelas(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const kelas = String(p.kelas || '').trim();
  if (!sesiBolehKelas(sesi, kelas)) return ralat('Anda tidak mempunyai akses kepada kelas ini.');
  const k = muatKonteks(kelas);
  return jaya({
    kelas, namaKelas: paparKelas(kelas), tahun: tahunSemasa(),
    segerakTerakhir: dapatTetapan('SEGERAK_KOKO_TERAKHIR'),
    versi: versiData(),
    murid: k.murid.map(m => ringkasMurid(m, k))
  });
}

/* Unit murid bagi satu aspek (rekod ASPEK diutamakan, jika tiada guna unit dalam MURID). */
function unitMuridAspek(murid, aspek, rec) {
  return banding((rec && rec.Unit) || murid[aspek + '_Unit'] || '');
}

/* Simpan pentaksiran seorang murid.
   - Medan aspek (PBB/KP/SP): Admin, atau Ketua Guru Penasihat (KGP) unit murid bagi aspek itu.
   - Ekstra kurikulum, CGPA tahun sebelum & sejarah CGPA: Admin sahaja.
   - Guru Kelas: lihat sahaja (tiada hak menulis kecuali jika dia juga KGP unit berkenaan). */
function apiSimpanPentaksiran(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const nokp = normalKP(p.nokp);
  const ref = muatRujukan();
  const admin = sesi.peranan === ROLE_ADMIN;
  if (!admin && (p.ekstra || p.cgpaSebelum !== undefined || p.sejarah !== undefined)) {
    return ralat('Ekstra kurikulum dan CGPA tahun sebelum hanya boleh dikemas kini oleh Admin.');
  }

  return denganKunci(() => {
    const murid = bacaSheetSebagaiObjek(SHEET_MURID).find(m => normalKP(m.NoKP) === nokp && String(m.Status).toUpperCase() === 'AKTIF');
    if (!murid) return ralat('Murid tidak dijumpai.');
    murid.NoKP = nokp;

    const masa = sekarangTeks();
    const konteks = muatKonteks(murid.KunciKelas);
    const aspekUbah = [];
    const masukan = p.aspek || {};
    const aspekDihantar = SEMUA_ASPEK.filter(a => masukan[a]);
    if (!admin && !aspekDihantar.length) return ralat('Tiada data untuk disimpan.');
    for (let i = 0; i < aspekDihantar.length; i++) {
      const a = aspekDihantar[i];
      const sedia = konteks.aspekMap[kunciAspek(nokp, a)];
      if (!bolehIsiUnit(sesi, a, unitMuridAspek(murid, a, sedia))) {
        return ralat('Anda bukan Ketua Guru Penasihat bagi unit ' + NAMA_ASPEK[a] + ' murid ini — hanya KGP unit berkenaan (atau Admin) boleh mengisi.');
      }
    }

    for (let i = 0; i < aspekDihantar.length; i++) {
      const a = aspekDihantar[i];
      const d = masukan[a];
      const rec = konteks.aspekMap[kunciAspek(nokp, a)] || aspekKosong(nokp, a, murid[a + '_Unit']);
      const ralatMedan = isiMedanAspek(rec, d, ref, false);
      if (ralatMedan) return ralat(ralatMedan + ' (' + NAMA_ASPEK[a] + ')');
      rec.Dikemaskini = masa;
      rec.OlehKP = sesi.nokp;
      kiraSemulaAspek(rec, ref);
      konteks.aspekMap[kunciAspek(nokp, a)] = rec;
      aspekUbah.push(rec);
    }

    let ekstra = konteks.ekstraMap[nokp];
    if (p.ekstra) {
      ekstra = ekstra || ekstraKosong(nokp);
      const medan = Object.keys(PETA_PENGESAHAN_EKSTRA);
      for (let j = 0; j < medan.length; j++) {
        const asal = String(p.ekstra[medan[j]] === undefined ? ekstra[medan[j]] : p.ekstra[medan[j]]).trim();
        if (!labelSah(ref, PETA_PENGESAHAN_EKSTRA[medan[j]], asal)) return ralat('Pilihan tidak sah untuk ' + medan[j] + '.');
        ekstra[medan[j]] = asal;
      }
      ekstra.Dikemaskini = masa;
      ekstra.OlehKP = sesi.nokp;
      kiraSemulaEkstra(ekstra, ref);
      konteks.ekstraMap[nokp] = ekstra;
    }

    if (p.cgpaSebelum !== undefined) {
      const cg = String(p.cgpaSebelum).trim();
      if (cg !== '' && (isNaN(Number(cg)) || Number(cg) < 0 || Number(cg) > 100)) return ralat('CGPA tahun sebelum mesti antara 0 dan 100.');
      murid.CGPA_Sebelum = cg === '' ? '' : Number(cg);
    }
    if (p.sejarah !== undefined) murid.SejarahCGPA = String(p.sejarah).trim().substring(0, 300);
    if (p.cgpaSebelum !== undefined || p.sejarah !== undefined) kemaskiniBaris(SHEET_MURID, murid.__row, murid);

    upsertBanyak(SHEET_ASPEK, 'Kunci', aspekUbah);
    if (p.ekstra) upsertBanyak(SHEET_EKSTRA, 'NoKP', [ekstra]);
    const rum = binaRumusan(murid, konteks.aspekMap, konteks.ekstraMap, ref);
    upsertBanyak(SHEET_RUMUSAN, 'NoKP', [rum]);
    catatAudit(sesi, 'KEMASKINI', 'PENTAKSIRAN', nokp, murid.Nama + ' (' + murid.KunciKelas + ') — ' + (aspekDihantar.join(', ') || 'ekstra/CGPA') + '; CGPA ' + rum.CGPA + ', gred ' + rum.Gred);

    const rumMap = {}; rumMap[nokp] = rum;
    const ringkas = ringkasMurid(murid, { aspekMap: konteks.aspekMap, ekstraMap: konteks.ekstraMap, rumusanMap: rumMap });
    return jaya({ murid: ringkas, versi: versiData() });
  });
}

/* Salin medan masukan `d` ke rekod ASPEK `rec` (dengan pengesahan label). hanyaKosong: jangan timpa medan berisi.
   Pulangkan mesej ralat atau '' jika berjaya. */
function isiMedanAspek(rec, d, ref, hanyaKosong) {
  const medan = Object.keys(PETA_PENGESAHAN_ASPEK);
  for (let j = 0; j < medan.length; j++) {
    const f = medan[j];
    if (d[f] === undefined) continue;
    const asal = String(d[f] === null ? '' : d[f]).trim();
    if (!labelSah(ref, PETA_PENGESAHAN_ASPEK[f], asal)) return 'Pilihan tidak sah untuk ' + f;
    if (hanyaKosong && (asal === '' || String(rec[f] || '') !== '')) continue;
    rec[f] = asal;
  }
  if (d.Aktiviti2 !== undefined && !(hanyaKosong && rec.Aktiviti2)) rec.Aktiviti2 = String(d.Aktiviti2).trim().substring(0, 120);
  if (d.KehadiranManual !== undefined && !(hanyaKosong && String(rec.KehadiranManual) !== '')) {
    const km = String(d.KehadiranManual).trim();
    if (km !== '' && (isNaN(Number(km)) || Number(km) < 0 || Number(km) > KEHADIRAN_MAKSIMUM)) {
      return 'Kehadiran manual mesti antara 0 dan ' + KEHADIRAN_MAKSIMUM + ' atau dikosongkan';
    }
    if (!(hanyaKosong && km === '')) rec.KehadiranManual = km === '' ? '' : Math.floor(Number(km));
  }
  return '';
}

/* ------------------------- PENGISIAN MENGIKUT UNIT (KGP) ------------------------- */
/* Unit yang boleh diisi oleh sesi (Admin: semua unit yang ada murid aktif). */
function senaraiUnitBolehIsi(sesi) {
  const bil = {};
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (String(m.Status).toUpperCase() !== 'AKTIF') return;
    SEMUA_ASPEK.forEach(a => { const u = banding(m[a + '_Unit']); if (u) { const k = kunciUnit(a, u); bil[k] = (bil[k] || 0) + 1; } });
  });
  const kgp = petaKgpUnit();
  let kunci = sesi.peranan === ROLE_ADMIN ? Object.keys(bil) : (sesi.unit || []).slice();
  return kunci.map(k => { const x = pecahKunciUnit(k); return { kunci: k, aspek: x.aspek, unit: x.unit, bilMurid: bil[k] || 0, kgp: kgp[k] || [] }; })
    .sort(susunUnit);
}

function susunUnit(a, b) {
  return SEMUA_ASPEK.indexOf(a.aspek) - SEMUA_ASPEK.indexOf(b.aspek) || String(a.unit).localeCompare(String(b.unit));
}

/* {kunciUnit: [nama KGP, ...]} daripada PENGGUNA aktif. */
function petaKgpUnit() {
  const peta = {};
  bacaSheetSebagaiObjek(SHEET_PENGGUNA).forEach(u => {
    if (String(u.Status).toUpperCase() !== 'AKTIF') return;
    unitPengguna(u).forEach(k => { (peta[k] = peta[k] || []).push(u.NamaPenuh); });
  });
  return peta;
}

/* Status satu rekod aspek: medan wajib (MEDAN_WAJIB_ASPEK). */
function statusRekodAspek(rec) {
  const r = rec || {};
  const kurang = [];
  MEDAN_WAJIB_ASPEK.forEach(([medan, label]) => {
    const kosong = medan === 'KOMITMEN' ? [r.Komit1, r.Komit2, r.Komit3, r.Komit4].every(medanKosong) : medanKosong(r[medan]);
    if (kosong) kurang.push(label);
  });
  return { status: !kurang.length ? ST_LENGKAP : (r.OlehKP ? ST_PROSES : ST_BELUM), kurang };
}

/* Senarai murid bagi unit dipilih (atau semua unit KGP), disusun: unit -> tingkatan -> kelas -> nama. */
function apiDataUnit(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const unitSaya = senaraiUnitBolehIsi(sesi);
  if (!unitSaya.length) return jaya({ unitSaya, dipilih: '', baris: [], medanWajib: MEDAN_WAJIB_ASPEK, tahun: tahunSemasa(), versi: versiData() });
  const dibenar = {};
  unitSaya.forEach(u => { dibenar[u.kunci] = true; });
  let dipilih = String(p.unit || '').trim();
  if (dipilih && !dibenar[dipilih]) return ralat('Anda bukan Ketua Guru Penasihat bagi unit ini.');
  if (!dipilih && sesi.peranan === ROLE_ADMIN) dipilih = unitSaya[0].kunci;      // Admin: satu unit pada satu masa
  const sasaran = {};
  (dipilih ? [dipilih] : unitSaya.map(u => u.kunci)).forEach(k => { sasaran[k] = true; });

  const aspekMap = {};
  bacaSheetSebagaiObjek(SHEET_ASPEK).forEach(r => { aspekMap[r.Kunci] = r; });
  const baris = [];
  bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
    if (String(m.Status).toUpperCase() !== 'AKTIF') return;
    const nokp = normalKP(m.NoKP);
    SEMUA_ASPEK.forEach(a => {
      const rec = aspekMap[kunciAspek(nokp, a)];
      const unit = unitMuridAspek(m, a, rec);
      const ku = kunciUnit(a, unit);
      if (!unit || !sasaran[ku]) return;
      const r = rec || aspekKosong(nokp, a, unit);
      const st = statusRekodAspek(rec);
      baris.push({ nokp, nama: m.Nama, tingkatan: nomborTingkatan(m.Tingkatan), kelas: m.Kelas, kunciKelas: m.KunciKelas,
        aspek: a, unit, kunciUnit: ku, rec: r, status: st.status, kurang: st.kurang });
    });
  });
  baris.sort((x, y) => susunUnit(x, y) || x.tingkatan - y.tingkatan || String(x.kelas).localeCompare(String(y.kelas)) ||
    String(x.nama).localeCompare(String(y.nama)));
  return jaya({ unitSaya, dipilih, baris, medanWajib: MEDAN_WAJIB_ASPEK, tahun: tahunSemasa(), versi: versiData() });
}

/* Isi pukal: tetapkan medan yang sama bagi beberapa murid dalam SATU unit (cth. Jawatan "AHLI AKTIF").
   hanyaKosong=true (lalai) hanya mengisi medan yang masih kosong. */
function apiSimpanPukal(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const x = pecahKunciUnit(p.unit);
  if (!x || SEMUA_ASPEK.indexOf(x.aspek) === -1) return ralat('Unit tidak sah.');
  if (!bolehIsiUnit(sesi, x.aspek, x.unit)) return ralat('Anda bukan Ketua Guru Penasihat bagi unit ini.');
  const senaraiKp = (Array.isArray(p.nokp) ? p.nokp : []).map(normalKP).filter(Boolean);
  if (!senaraiKp.length) return ralat('Tiada murid dipilih.');
  const medan = p.medan || {};
  const hanyaKosong = p.hanyaKosong !== false;
  const ref = muatRujukan();

  return denganKunci(() => {
    const set = {};
    senaraiKp.forEach(k => { set[k] = true; });
    const k = muatKonteks(null);
    const masa = sekarangTeks();
    const aspekUbah = [], rumUbah = [];
    for (let i = 0; i < k.murid.length; i++) {
      const m = k.murid[i];
      if (!set[m.NoKP]) continue;
      const kunci = kunciAspek(m.NoKP, x.aspek);
      const sedia = k.aspekMap[kunci];
      if (kunciUnit(x.aspek, unitMuridAspek(m, x.aspek, sedia)) !== p.unit) continue;   // bukan ahli unit ini
      const rec = sedia || aspekKosong(m.NoKP, x.aspek, m[x.aspek + '_Unit']);
      const r = isiMedanAspek(rec, medan, ref, hanyaKosong);
      if (r) return ralat(r);
      rec.Dikemaskini = masa;
      rec.OlehKP = sesi.nokp;
      kiraSemulaAspek(rec, ref);
      k.aspekMap[kunci] = rec;
      aspekUbah.push(rec);
      rumUbah.push(binaRumusan(m, k.aspekMap, k.ekstraMap, ref));
    }
    upsertBanyak(SHEET_ASPEK, 'Kunci', aspekUbah);
    upsertBanyak(SHEET_RUMUSAN, 'NoKP', rumUbah);
    catatAudit(sesi, 'ISI_PUKAL', 'PENTAKSIRAN', p.unit, aspekUbah.length + ' murid; medan: ' + Object.keys(medan).join(', ') + (hanyaKosong ? ' (kosong sahaja)' : ''));
    return jaya({ dikemaskini: aspekUbah.length, versi: versiData() });
  });
}

/* Cadangan Pelibatan/Pencapaian daripada Sheet PENCAPAIAN e-Kokurikulum untuk seorang murid. */
function apiCadanganKoko(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const nokp = normalKP(p.nokp);
  const murid = bacaSheetSebagaiObjek(SHEET_MURID).find(m => normalKP(m.NoKP) === nokp);
  if (!murid) return ralat('Murid tidak dijumpai.');
  murid.NoKP = nokp;
  const kgpMurid = SEMUA_ASPEK.some(a => (sesi.unit || []).indexOf(kunciUnit(a, murid[a + '_Unit'])) !== -1);
  if (!sesiBolehKelas(sesi, murid.KunciKelas) && !kgpMurid) return ralat('Anda tidak mempunyai akses kepada murid ini.');
  try {
    return jaya({ senarai: bacaPencapaianKokoMurid(murid, tahunSemasa(), muatRujukan()) });
  } catch (e) {
    return ralat(e.message);
  }
}

/* Kira semula semua skor menggunakan jadual REFERENSI semasa (cth. selepas Admin menyunting skor).
   Admin: kelas tertentu atau semua; boleh dijalankan juga dari menu Sheet. */
function kiraSemulaSemua(kunciKelas) {
  kosongkanCacheRujukan();
  const ref = muatRujukan();
  const k = muatKonteks(kunciKelas || null);
  const aspekUbah = [], ekstraUbah = [], rumUbah = [];
  Object.keys(k.aspekMap).forEach(kunci => { aspekUbah.push(kiraSemulaAspek(k.aspekMap[kunci], ref)); });
  Object.keys(k.ekstraMap).forEach(kp => { ekstraUbah.push(kiraSemulaEkstra(k.ekstraMap[kp], ref)); });
  k.murid.forEach(m => { rumUbah.push(binaRumusan(m, k.aspekMap, k.ekstraMap, ref)); });
  upsertBanyak(SHEET_ASPEK, 'Kunci', aspekUbah);
  upsertBanyak(SHEET_EKSTRA, 'NoKP', ekstraUbah);
  upsertBanyak(SHEET_RUMUSAN, 'NoKP', rumUbah);
  return { murid: k.murid.length, aspek: aspekUbah.length };
}

function apiKiraSemula(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  return denganKunci(() => {
    const hasil = kiraSemulaSemua(String(p.kelas || '').trim() || null);
    catatAudit(sesi, 'KIRA_SEMULA', 'PENTAKSIRAN', p.kelas || 'SEMUA', hasil.murid + ' murid');
    return jaya(hasil);
  });
}
