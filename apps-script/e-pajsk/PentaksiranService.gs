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
    rumusan: konteks.rumusanMap[m.NoKP] || null
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

/* Simpan pentaksiran seorang murid: aspek (PBB/KP/SP), ekstra kurikulum dan CGPA tahun sebelum. */
function apiSimpanPentaksiran(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;
  const nokp = normalKP(p.nokp);
  const ref = muatRujukan();

  return denganKunci(() => {
    const murid = bacaSheetSebagaiObjek(SHEET_MURID).find(m => normalKP(m.NoKP) === nokp && String(m.Status).toUpperCase() === 'AKTIF');
    if (!murid) return ralat('Murid tidak dijumpai.');
    murid.NoKP = nokp;
    if (!sesiBolehKelas(sesi, murid.KunciKelas)) return ralat('Anda tidak mempunyai akses kepada murid ini.');

    const masa = sekarangTeks();
    const konteks = muatKonteks(murid.KunciKelas);
    const aspekUbah = [];

    const masukan = p.aspek || {};
    for (let i = 0; i < SEMUA_ASPEK.length; i++) {
      const a = SEMUA_ASPEK[i];
      const d = masukan[a];
      if (!d) continue;
      const rec = konteks.aspekMap[kunciAspek(nokp, a)] || aspekKosong(nokp, a, murid[a + '_Unit']);
      const medan = Object.keys(PETA_PENGESAHAN_ASPEK);
      for (let j = 0; j < medan.length; j++) {
        const jenis = PETA_PENGESAHAN_ASPEK[medan[j]];
        const asal = String(d[medan[j]] === undefined ? rec[medan[j]] : d[medan[j]]).trim();
        if (!labelSah(ref, jenis, asal)) return ralat('Pilihan tidak sah untuk ' + medan[j] + ' (' + NAMA_ASPEK[a] + ').');
        rec[medan[j]] = asal;
      }
      if (d.Aktiviti2 !== undefined) rec.Aktiviti2 = String(d.Aktiviti2).trim().substring(0, 120);
      if (d.Unit !== undefined && !rec.Unit) rec.Unit = String(d.Unit).trim().substring(0, 120);
      if (d.KehadiranManual !== undefined) {
        const km = String(d.KehadiranManual).trim();
        if (km !== '' && (isNaN(Number(km)) || Number(km) < 0 || Number(km) > KEHADIRAN_MAKSIMUM)) {
          return ralat('Kehadiran manual mesti antara 0 dan ' + KEHADIRAN_MAKSIMUM + ' atau dikosongkan.');
        }
        rec.KehadiranManual = km === '' ? '' : Math.floor(Number(km));
      }
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
    catatAudit(sesi, 'KEMASKINI', 'PENTAKSIRAN', nokp, murid.Nama + ' (' + murid.KunciKelas + ') — CGPA ' + rum.CGPA + ', gred ' + rum.Gred);

    const rumMap = {}; rumMap[nokp] = rum;
    return jaya({ murid: ringkasMurid(murid, { aspekMap: konteks.aspekMap, ekstraMap: konteks.ekstraMap, rumusanMap: rumMap }), versi: versiData() });
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
  if (!sesiBolehKelas(sesi, murid.KunciKelas)) return ralat('Anda tidak mempunyai akses kepada murid ini.');
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
