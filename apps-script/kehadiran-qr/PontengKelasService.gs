/* =========================================================================
 * PontengKelasService.gs — analisis PONTENG KELAS.
 *
 * Ponteng kelas = murid hadir ke sekolah (tidak ditanda tidak hadir oleh GT)
 * tetapi tiada dalam kelas semasa waktu P&P guru mata pelajaran. Direkod oleh
 * guru melalui borang imbas QR (sebab "Ponteng kelas").
 *
 * Skop paparan:  ADMIN → semua kelas · GT/PGT → kelas tingkatan sendiri ·
 *                guru lain → kes daripada sesi yang dia rekod sendiri.
 * ========================================================================= */

function adalahPontengKelas(t) { return String(t.PontengKelas).toUpperCase() === 'YA' || String(t.KodSebab) === KOD_PONTENG_KELAS; }

/* Penapis skop untuk baris KETIDAKHADIRAN_SUBJEK / LOG_KEHADIRAN_SUBJEK. */
function penapisSkopPontengKelas(sesi, kelasDiminta) {
  if (adalahAdmin(sesi)) {
    const k = normalKelas(kelasDiminta || '');
    return { label: k || 'Semua kelas', lulus: r => !k || normalKelas(r.Kelas) === k };
  }
  const kelasSaya = adalahGuruKelas(sesi) ? sesi.kelasTingkatan : '';
  return {
    label: kelasSaya ? 'Kelas ' + kelasSaya + ' & sesi saya' : 'Sesi P&P saya',
    lulus: r => (kelasSaya && normalKelas(r.Kelas) === kelasSaya) || samaNoKP(r.NoKPGuru, sesi.nokp)
  };
}

function kiraIkut(senarai, fnKunci) {
  const o = {};
  senarai.forEach(x => { const k = fnKunci(x); if (k !== '' && k !== undefined && k !== null) o[k] = (o[k] || 0) + 1; });
  return Object.keys(o).map(k => ({ label: k, bil: o[k] })).sort((a, b) => b.bil - a.bil);
}

function apiPontengKelas(p) {
  const sesi = wajibSesi(p.token, { jenis: 'GURU' });
  if (gagal(sesi)) return sesi;
  const bulan = /^\d{4}-\d{2}$/.test(String(p.bulan || '')) ? p.bulan : tarikhHariIni().slice(0, 7);
  const tahun = bulan.slice(0, 4);
  const skop = penapisSkopPontengKelas(sesi, p.kelas);

  /* Lajur NoKPGuru ditambah kemudian — sandarkan pada log sesi jika kosong. */
  const log = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK);
  const petaLog = {}; log.forEach(l => { petaLog[l.IdLog] = l; });
  const semuaKes = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(adalahPontengKelas).map(t => {
    const l = petaLog[t.IdLog] || {};
    return { tarikh: keTarikh(t.Tarikh), hari: hariBagiTarikh(t.Tarikh), masa: keHHmm(t.Slot || l.Slot), kelas: normalKelas(t.Kelas), subjek: String(t.Subjek || l.Subjek || ''),
      nokp: digitSahaja(t.NoKPMurid), nama: t.NamaMurid, NoKPGuru: digitSahaja(t.NoKPGuru || l.NoKPGuru), guru: t.NamaGuru || l.NamaGuru || '', Kelas: t.Kelas, idLog: t.IdLog };
  }).filter(skop.lulus);

  const kesTahun = semuaKes.filter(k => k.tarikh.slice(0, 4) === tahun);
  const kes = kesTahun.filter(k => k.tarikh.slice(0, 7) === bulan).sort((a, b) => (b.tarikh + b.masa).localeCompare(a.tarikh + a.masa));
  const [y, m] = bulan.split('-').map(Number);
  const bulanLalu = m === 1 ? (y - 1) + '-12' : y + '-' + ('0' + (m - 1)).slice(-2);
  const kesBulanLalu = semuaKes.filter(k => k.tarikh.slice(0, 7) === bulanLalu).length;

  /* Kadar = kes ponteng kelas / jumlah kehadiran murid-sesi yang direkod dalam skop. */
  const logSkop = log.filter(l => keTarikh(l.Tarikh).slice(0, 7) === bulan && skop.lulus({ Kelas: l.Kelas, NoKPGuru: l.NoKPGuru }));
  const muridSesi = logSkop.reduce((s, l) => s + Number(l.JumlahMurid || 0), 0);

  const perMurid = {};
  kes.forEach(k => {
    const o = perMurid[k.nokp] = perMurid[k.nokp] || { nokp: k.nokp, nama: k.nama, kelas: k.kelas, bil: 0, subjek: {}, terkini: '' };
    o.bil++; o.subjek[k.subjek] = (o.subjek[k.subjek] || 0) + 1; if (k.tarikh > o.terkini) o.terkini = k.tarikh;
  });
  const ambang = AMBANG_PONTENG_KELAS_BERULANG;
  const murid = Object.keys(perMurid).map(n => perMurid[n]).map(o => Object.assign(o, {
    subjek: Object.keys(o.subjek).sort((a, b) => o.subjek[b] - o.subjek[a]).map(s => s + ' (' + o.subjek[s] + ')').join(', '),
    berulang: o.bil >= ambang })).sort((a, b) => b.bil - a.bil || a.nama.localeCompare(b.nama));
  const foto = petaThumbMurid();
  murid.forEach(o => { o.gambar = foto[o.nokp] || ''; });

  const hariSek = senaraiDaripadaMedan(tetapan('HARI_PERSEKOLAHAN'));
  const masaUnik = Array.from(new Set(kes.map(k => k.masa).filter(Boolean))).sort();
  const peta = {}; kes.forEach(k => { const kk = k.hari + '|' + k.masa; peta[kk] = (peta[kk] || 0) + 1; });

  const harian = {}; kes.forEach(k => { harian[k.tarikh] = (harian[k.tarikh] || 0) + 1; });
  const bilHari = new Date(y, m, 0).getDate();
  const trendHarian = [];
  for (let d = 1; d <= bilHari; d++) {
    const t = bulan + '-' + ('0' + d).slice(-2);
    if (hariSek.indexOf(hariBagiTarikh(t)) !== -1 || harian[t]) trendHarian.push({ tarikh: t, bil: harian[t] || 0 });
  }

  return jaya({
    bulan, labelBulan: BULAN_MS[m - 1] + ' ' + y, skop: skop.label, ambangBerulang: ambang,
    kad: { kes: kes.length, murid: murid.length, kelas: new Set(kes.map(k => k.kelas)).size, kesBulanLalu,
      kadar: muridSesi ? Math.round(kes.length / muridSesi * 10000) / 100 : 0, sesi: logSkop.length, berulang: murid.filter(o => o.berulang).length,
      kesTahun: kesTahun.length },
    trendHarian,
    trendBulanan: BULAN_MS.map((b, i) => ({ bulan: b.slice(0, 3), bil: kesTahun.filter(k => Number(k.tarikh.slice(5, 7)) === i + 1).length })),
    perSubjek: kiraIkut(kes, k => k.subjek), perKelas: kiraIkut(kes, k => k.kelas), perGuru: kiraIkut(kes, k => k.guru),
    perMasa: kiraIkut(kes, k => k.masa).sort((a, b) => a.label.localeCompare(b.label)),
    perHari: hariSek.map(h => ({ label: h, bil: kes.filter(k => k.hari === h).length })),
    petaHaba: { hari: hariSek, masa: masaUnik, nilai: hariSek.map(h => masaUnik.map(ms => peta[h + '|' + ms] || 0)) },
    murid, kes: kes.map(k => ({ tarikh: k.tarikh, hari: k.hari, masa: k.masa, kelas: k.kelas, subjek: k.subjek, nama: k.nama, nokp: k.nokp, guru: k.guru, idLog: k.idLog,
      bolehEdit: bolehEditSesi(sesi, { NoKPGuru: k.NoKPGuru, Tarikh: k.tarikh }) })),
    senaraiKelas: adalahAdmin(sesi) ? senaraiKelas().map(k => k.kelas) : [],
    lihatGuru: adalahAdmin(sesi) || adalahGuruKelas(sesi)
  });
}

/* Bilangan kes ponteng kelas seorang murid (tahun semasa / bulan tertentu). */
function kesPontengKelasMurid(nokp, awalan) {
  return bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK)
    .filter(t => adalahPontengKelas(t) && samaNoKP(t.NoKPMurid, nokp) && keTarikh(t.Tarikh).indexOf(awalan) === 0)
    .map(t => ({ tarikh: keTarikh(t.Tarikh), masa: keHHmm(t.Slot), subjek: t.Subjek, guru: t.NamaGuru || '' }))
    .sort((a, b) => (b.tarikh + b.masa).localeCompare(a.tarikh + a.masa));
}
