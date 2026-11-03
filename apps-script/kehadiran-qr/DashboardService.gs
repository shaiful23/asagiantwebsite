/* =========================================================================
 * DashboardService.gs — papan pemuka (tarikh semasa), rekod kehadiran lepas &
 * analisis bulanan, kelas diajar / teach-in, dan profil ringkas pelajar.
 * Semua data dikira di pelayan mengikut peranan pengguna.
 * ========================================================================= */

function profilMuridUntukKlien(m) {
  return { nokp: digitSahaja(m.NoKP), nama: m.Nama, kelas: m.Kelas, tingkatan: m.Tingkatan, jantina: m.Jantina,
    tarikhLahir: keTarikh(m.TarikhLahir), alamat: m.Alamat, namaPenjaga: m.NamaPenjaga, telefonPenjaga: m.TelefonPenjaga, gambar: m.GambarUrl };
}

/* Peratus kehadiran mengikut bulan bagi satu senarai sejarah harian. */
function trendBulanan(sejarah) {
  const peta = {};
  sejarah.forEach(h => { const b = h.tarikh.slice(0, 7); (peta[b] = peta[b] || { hari: 0, hadir: 0 }); peta[b].hari++; if (h.hadir) peta[b].hadir++; });
  return Object.keys(peta).sort().map(b => ({ bulan: b, label: BULAN_MS[Number(b.slice(5, 7)) - 1].slice(0, 3), hari: peta[b].hari, hadir: peta[b].hadir,
    peratus: bulatPeratus(peta[b].hadir, peta[b].hari) }));
}

function slotJadualHariIni(sesi, tarikh) {
  const hari = hariBagiTarikh(tarikh);
  const log = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).filter(l => samaNoKP(l.NoKPGuru, sesi.nokp) && keTarikh(l.Tarikh) === tarikh);
  const sudah = (kelas, s) => log.find(l => normalKelas(l.Kelas) === kelas && String(l.Slot) === String(s));
  const senarai = jadualGuru(sesi).filter(j => j.Hari === hari).map(j => ({ jenis: 'JADUAL', slot: j.Slot, mula: j.MasaMula, tamat: j.MasaTamat, kelas: j.Kelas, subjek: j.Subjek }))
    .concat(teachInGuru(sesi).filter(t => t.Tarikh === tarikh).map(t => ({ jenis: 'TEACH-IN', slot: t.Slot, mula: t.MasaMula, tamat: t.MasaTamat, kelas: t.Kelas, subjek: t.Subjek, guruAsal: t.NamaGuruAsal })));
  return senarai.map(x => {
    const l = sudah(x.kelas, x.slot);
    return Object.assign(x, { direkod: !!l, hadir: l ? Number(l.Hadir) : null, jumlah: l ? Number(l.JumlahMurid) : null, statusMasa: l ? l.StatusMasa : '' });
  }).sort((a, b) => String(a.mula).localeCompare(String(b.mula)));
}

function ringkasanKelasHariIni(kelas, tarikh) {
  const rekod = rekodKelasPada(tarikh, kelas);
  const jumlah = muridDalamKelas(kelas).length;
  if (!rekod) return { kelas, direkod: false, jumlah, hadir: 0, tidakHadir: 0, peratus: 0 };
  const th = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).filter(t => t.IdRekod === rekod.IdRekod);
  return { kelas, direkod: true, jumlah: Number(rekod.JumlahMurid), hadir: Number(rekod.Hadir), tidakHadir: Number(rekod.TidakHadir),
    peratus: bulatPeratus(Number(rekod.Hadir), Number(rekod.JumlahMurid)), oleh: rekod.NamaGuru, masa: rekod.MasaRekod,
    senaraiTidakHadir: th.map(t => ({ nama: t.NamaMurid, sebab: t.Sebab, ponteng: String(t.DikiraPonteng) === 'YA' })) };
}

function trendKelas(kelas, bilHari) {
  return bacaSheetSebagaiObjek(SHEET.REKOD_KELAS).filter(r => normalKelas(r.Kelas) === kelas)
    .sort((a, b) => keTarikh(a.Tarikh).localeCompare(keTarikh(b.Tarikh))).slice(-bilHari)
    .map(r => ({ tarikh: keTarikh(r.Tarikh), peratus: bulatPeratus(Number(r.Hadir), Number(r.JumlahMurid)), hadir: Number(r.Hadir), tidakHadir: Number(r.TidakHadir) }));
}

/* ============================== DASHBOARD ============================== */
function apiDashboard(p) {
  const sesi = wajibSesi(p.token);
  if (gagal(sesi)) return sesi;
  const tarikh = tarikhHariIni();
  const hasil = { tarikh, hari: hariBagiTarikh(tarikh), masa: masaSekarang(), masaKunci: keHHmm(tetapan('MASA_KUNCI_KEHADIRAN')) };

  if (sesi.jenis === 'MURID') {
    const murid = cariMurid(sesi.nokp);
    if (!murid) return ralat('Rekod murid tidak dijumpai dalam e-Data & Enrolmen.');
    const ctx = konteksKehadiranTahun(tarikh.slice(0, 4));
    const sejarah = sejarahHarianMurid(murid, ctx);
    const a = analisisPonteng(sejarah);
    const hariIni = sejarah.find(h => h.tarikh === tarikh);
    const bulanIni = sejarah.filter(h => h.tarikh.slice(0, 7) === tarikh.slice(0, 7));
    const logHariIni = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).filter(l => keTarikh(l.Tarikh) === tarikh && normalKelas(l.Kelas) === murid.Kelas);
    const thSubjek = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(t => keTarikh(t.Tarikh) === tarikh && samaNoKP(t.NoKPMurid, murid.NoKP));
    hasil.murid = {
      profil: profilMuridUntukKlien(murid),
      hariIni: hariIni ? { direkod: true, hadir: hariIni.hadir, sebab: hariIni.sebab || '' } : { direkod: false },
      bulanIni: { hari: bulanIni.length, hadir: bulanIni.filter(h => h.hadir).length, peratus: bulatPeratus(bulanIni.filter(h => h.hadir).length, bulanIni.length) },
      tahunIni: { hari: a.hariSekolah, hadir: a.hadir, peratus: bulatPeratus(a.hadir, a.hariSekolah), tidakHadirSah: a.tidakHadirSah, ponteng: a.TIDAK_BERTURUT.hari,
        pontengKelas: kesPontengKelasMurid(murid.NoKP, tarikh.slice(0, 4)).length },
      sesiHariIni: logHariIni.sort((x, y) => String(x.Slot).localeCompare(String(y.Slot), undefined, { numeric: true })).map(l => ({
        slot: l.Slot, subjek: l.Subjek, guru: l.NamaGuru, jenis: l.Jenis,
        hadir: !thSubjek.some(t => t.IdLog === l.IdLog), sebab: (thSubjek.find(t => t.IdLog === l.IdLog) || {}).Sebab || '',
        pontengKelas: thSubjek.some(t => t.IdLog === l.IdLog && adalahPontengKelas(t)) })),
      trend: trendBulanan(sejarah),
      terkini: sejarah.slice(-20),
      amaran: { BERTURUT: a.BERTURUT, TIDAK_BERTURUT: a.TIDAK_BERTURUT }
    };
    return jaya(hasil);
  }

  /* ---------- GURU ---------- */
  const jadual = slotJadualHariIni(sesi, tarikh);
  const sesiDirekod = jadual.filter(j => j.direkod);
  const jumHadir = sesiDirekod.reduce((s, j) => s + j.hadir, 0), jumMurid = sesiDirekod.reduce((s, j) => s + j.jumlah, 0);
  hasil.guru = {
    jadual,
    kad: { kelasHariIni: jadual.filter(j => j.jenis === 'JADUAL').length, teachInHariIni: jadual.filter(j => j.jenis === 'TEACH-IN').length,
      sesiDirekod: sesiDirekod.length, peratusSesi: bulatPeratus(jumHadir, jumMurid) },
    sesiHariIni: bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).filter(l => samaNoKP(l.NoKPGuru, sesi.nokp) && keTarikh(l.Tarikh) === tarikh)
      .map(l => ({ slot: l.Slot, kelas: l.Kelas, subjek: l.Subjek, jenis: l.Jenis, statusMasa: l.StatusMasa, hadir: Number(l.Hadir), jumlah: Number(l.JumlahMurid) }))
  };

  if (adalahGuruKelas(sesi)) {
    const ctx = konteksKehadiranTahun(tarikh.slice(0, 4));
    const surat = bacaSheetSebagaiObjek(SHEET.SURAT);
    const amaran = muridDalamKelas(sesi.kelasTingkatan).map(m => statusAmaranMurid(m, ctx, surat));
    const kSaya = senaraiKelas().find(k => k.kelas === sesi.kelasTingkatan);
    hasil.kelasSaya = Object.assign(ringkasanKelasHariIni(sesi.kelasTingkatan, tarikh), {
      cuti: kSaya ? (tingkatanCutiPada(tarikh)[kSaya.tingkatan] || '') : '',
      kunci: statusKunci(tarikh, sesi.kelasTingkatan), trend: trendKelas(sesi.kelasTingkatan, 15),
      perluTindakan: amaran.filter(s => s.BERTURUT.perluSurat || s.TIDAK_BERTURUT.perluSurat).length,
      dalamAmaran: amaran.filter(s => s.BERTURUT.peringkat.indeks >= 0 || s.TIDAK_BERTURUT.peringkat.indeks >= 0).length,
      pontengKelasHariIni: bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(t => adalahPontengKelas(t) && keTarikh(t.Tarikh) === tarikh && normalKelas(t.Kelas) === sesi.kelasTingkatan)
        .map(t => ({ nama: t.NamaMurid, subjek: t.Subjek, masa: keHHmm(t.Slot), guru: t.NamaGuru || '' }))
    });
  }
  if (adalahAdmin(sesi)) hasil.sekolah = ringkasanSekolah(tarikh);
  return jaya(hasil);
}

function ringkasanSekolah(tarikh) {
  const kelas = senaraiKelas();
  const rekod = bacaSheetSebagaiObjek(SHEET.REKOD_KELAS).filter(r => keTarikh(r.Tarikh) === tarikh);
  const th = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).filter(t => keTarikh(t.Tarikh) === tarikh);
  const kiraMurid = {}; senaraiMurid().forEach(m => { kiraMurid[m.Kelas] = (kiraMurid[m.Kelas] || 0) + 1; });
  const cuti = tingkatanCutiPada(tarikh);
  const perKelas = kelas.map(k => {
    const r = rekod.find(x => normalKelas(x.Kelas) === k.kelas);
    return { kelas: k.kelas, tingkatan: k.tingkatan, direkod: !!r, cuti: !r && cuti[k.tingkatan] ? cuti[k.tingkatan] : '', jumlah: r ? Number(r.JumlahMurid) : (kiraMurid[k.kelas] || 0),
      hadir: r ? Number(r.Hadir) : 0, tidakHadir: r ? Number(r.TidakHadir) : 0, peratus: r ? bulatPeratus(Number(r.Hadir), Number(r.JumlahMurid)) : null,
      oleh: r ? r.NamaGuru : '', selepasKunci: r ? r.SelepasKunci === 'YA' : false };
  });
  const tingkatan = {};
  perKelas.filter(k => k.direkod).forEach(k => { const t = k.tingkatan || '-'; (tingkatan[t] = tingkatan[t] || { hadir: 0, jumlah: 0 }); tingkatan[t].hadir += k.hadir; tingkatan[t].jumlah += k.jumlah; });
  const sebab = {}; th.forEach(t => { sebab[t.Sebab] = (sebab[t.Sebab] || 0) + 1; });
  const direkod = perKelas.filter(k => k.direkod);
  const jumHadir = direkod.reduce((s, k) => s + k.hadir, 0), jumMurid = direkod.reduce((s, k) => s + k.jumlah, 0);
  return {
    kad: { kelas: kelas.length, kelasDirekod: direkod.length, peratusHadir: bulatPeratus(jumHadir, jumMurid), tidakHadir: th.length,
      ponteng: th.filter(t => String(t.DikiraPonteng) === 'YA').length,
      permohonanMenunggu: bacaSheetSebagaiObjek(SHEET.PERMOHONAN).filter(x => x.Status === 'MENUNGGU').length,
      pontengKelas: bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(t => adalahPontengKelas(t) && keTarikh(t.Tarikh) === tarikh).length },
    perKelas, perTingkatan: Object.keys(tingkatan).sort().map(t => ({ tingkatan: t, peratus: bulatPeratus(tingkatan[t].hadir, tingkatan[t].jumlah), hadir: tingkatan[t].hadir, jumlah: tingkatan[t].jumlah })),
    sebab: Object.keys(sebab).map(s => ({ sebab: s, bil: sebab[s] })).sort((a, b) => b.bil - a.bil),
    belumDirekod: perKelas.filter(k => !k.direkod && !k.cuti).map(k => k.kelas),
    kelasCuti: perKelas.filter(k => k.cuti).length
  };
}

/* ============================== REKOD LEPAS & ANALISIS BULANAN ============================== */
function analisisBulananKelas(kelas, bulan) {
  const rekod = bacaSheetSebagaiObjek(SHEET.REKOD_KELAS).filter(r => normalKelas(r.Kelas) === kelas && keTarikh(r.Tarikh).slice(0, 7) === bulan)
    .sort((a, b) => keTarikh(a.Tarikh).localeCompare(keTarikh(b.Tarikh)));
  const ids = {}; rekod.forEach(r => { ids[r.IdRekod] = true; });
  const th = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).filter(t => ids[t.IdRekod]);
  const harian = rekod.map(r => ({ tarikh: keTarikh(r.Tarikh), hari: hariBagiTarikh(r.Tarikh), jumlah: Number(r.JumlahMurid), hadir: Number(r.Hadir),
    tidakHadir: Number(r.TidakHadir), peratus: bulatPeratus(Number(r.Hadir), Number(r.JumlahMurid)), oleh: r.NamaGuru, selepasKunci: r.SelepasKunci === 'YA' }));
  const murid = muridDalamKelas(kelas).map(m => {
    const milik = th.filter(t => samaNoKP(t.NoKPMurid, m.NoKP));
    const hadir = rekod.length - milik.length;
    return { nokp: digitSahaja(m.NoKP), nama: m.Nama, hari: rekod.length, hadir, tidakHadir: milik.length,
      ponteng: milik.filter(t => String(t.DikiraPonteng) === 'YA').length, peratus: bulatPeratus(hadir, rekod.length),
      tarikhTidakHadir: milik.map(t => keTarikh(t.Tarikh) + ' (' + t.Sebab + ')') };
  });
  const sebab = {}; th.forEach(t => { sebab[t.Sebab] = (sebab[t.Sebab] || 0) + 1; });
  const jumHadir = harian.reduce((s, h) => s + h.hadir, 0), jum = harian.reduce((s, h) => s + h.jumlah, 0);
  return { kelas, bulan, harian, murid, sebab: Object.keys(sebab).map(s => ({ sebab: s, bil: sebab[s] })).sort((a, b) => b.bil - a.bil),
    ringkasan: { hariDirekod: rekod.length, peratus: bulatPeratus(jumHadir, jum), tidakHadir: th.length, ponteng: th.filter(t => String(t.DikiraPonteng) === 'YA').length,
      muridSempurna: murid.filter(m => m.tidakHadir === 0 && m.hari > 0).length } };
}

function analisisBulananSubjekGuru(sesi, bulan) {
  const log = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).filter(l => samaNoKP(l.NoKPGuru, sesi.nokp) && keTarikh(l.Tarikh).slice(0, 7) === bulan)
    .sort((a, b) => (keTarikh(a.Tarikh) + String(a.Slot)).localeCompare(keTarikh(b.Tarikh) + String(b.Slot)));
  const perKelas = {}, statusMasa = {}, jenis = {};
  log.forEach(l => {
    const k = l.Kelas + ' · ' + l.Subjek; (perKelas[k] = perKelas[k] || { sesi: 0, hadir: 0, jumlah: 0 });
    perKelas[k].sesi++; perKelas[k].hadir += Number(l.Hadir); perKelas[k].jumlah += Number(l.JumlahMurid);
    statusMasa[l.StatusMasa] = (statusMasa[l.StatusMasa] || 0) + 1; jenis[l.Jenis] = (jenis[l.Jenis] || 0) + 1;
  });
  return {
    sesi: log.map(l => ({ idLog: l.IdLog, bolehEdit: bolehEditSesi(sesi, l), tarikh: keTarikh(l.Tarikh), hari: l.Hari, slot: l.Slot, kelas: l.Kelas, subjek: l.Subjek, jenis: l.Jenis, statusMasa: l.StatusMasa,
      hadir: Number(l.Hadir), jumlah: Number(l.JumlahMurid), peratus: bulatPeratus(Number(l.Hadir), Number(l.JumlahMurid)) })),
    perKelas: Object.keys(perKelas).map(k => ({ kelas: k, sesi: perKelas[k].sesi, peratus: bulatPeratus(perKelas[k].hadir, perKelas[k].jumlah) })),
    statusMasa: Object.keys(statusMasa).map(k => ({ label: k, bil: statusMasa[k] })), jenis: Object.keys(jenis).map(k => ({ label: k, bil: jenis[k] })),
    ringkasan: { sesi: log.length, teachIn: log.filter(l => l.Jenis === 'GURU TEACH-IN').length, lewat: log.filter(l => l.StatusMasa === 'LEWAT').length,
      peratus: bulatPeratus(log.reduce((s, l) => s + Number(l.Hadir), 0), log.reduce((s, l) => s + Number(l.JumlahMurid), 0)) }
  };
}

function analisisMurid(murid, bulan) {
  const ctx = konteksKehadiranTahun(bulan.slice(0, 4));
  const sejarah = sejarahHarianMurid(murid, ctx);
  const a = analisisPonteng(sejarah);
  const harian = sejarah.filter(h => h.tarikh.slice(0, 7) === bulan).map(h => Object.assign({ hari: hariBagiTarikh(h.tarikh) }, h));
  const thSubjek = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).filter(t => samaNoKP(t.NoKPMurid, murid.NoKP) && keTarikh(t.Tarikh).slice(0, 7) === bulan)
    .map(t => ({ tarikh: keTarikh(t.Tarikh), slot: t.Slot, subjek: t.Subjek, sebab: t.Sebab }));
  const logKelas = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).filter(l => normalKelas(l.Kelas) === murid.Kelas && keTarikh(l.Tarikh).slice(0, 7) === bulan);
  const perSubjek = {};
  logKelas.forEach(l => { (perSubjek[l.Subjek] = perSubjek[l.Subjek] || { sesi: 0, tidakHadir: 0 }); perSubjek[l.Subjek].sesi++; });
  thSubjek.forEach(t => { if (perSubjek[t.subjek]) perSubjek[t.subjek].tidakHadir++; });
  const sebab = {}; harian.filter(h => !h.hadir).forEach(h => { sebab[h.sebab] = (sebab[h.sebab] || 0) + 1; });
  const hadirBulan = harian.filter(h => h.hadir).length;
  return { profil: profilMuridUntukKlien(murid), bulan, harian, subjekTidakHadir: thSubjek,
    perSubjek: Object.keys(perSubjek).map(s => ({ subjek: s, sesi: perSubjek[s].sesi, hadir: perSubjek[s].sesi - perSubjek[s].tidakHadir,
      peratus: bulatPeratus(perSubjek[s].sesi - perSubjek[s].tidakHadir, perSubjek[s].sesi) })),
    sebab: Object.keys(sebab).map(s => ({ sebab: s, bil: sebab[s] })),
    trend: trendBulanan(sejarah),
    pontengKelas: kesPontengKelasMurid(murid.NoKP, bulan),
    ringkasan: { hari: harian.length, hadir: hadirBulan, tidakHadir: harian.length - hadirBulan, peratus: bulatPeratus(hadirBulan, harian.length),
      pontengKelas: kesPontengKelasMurid(murid.NoKP, bulan).length, pontengKelasTahun: kesPontengKelasMurid(murid.NoKP, bulan.slice(0, 4)).length,
      peratusTahun: bulatPeratus(a.hadir, a.hariSekolah), pontengTahun: a.TIDAK_BERTURUT.hari } };
}

function analisisBulananSekolah(bulan) {
  const rekod = bacaSheetSebagaiObjek(SHEET.REKOD_KELAS).filter(r => keTarikh(r.Tarikh).slice(0, 7) === bulan);
  const perKelas = {}, perTarikh = {};
  rekod.forEach(r => {
    const k = normalKelas(r.Kelas), t = keTarikh(r.Tarikh);
    (perKelas[k] = perKelas[k] || { hari: 0, hadir: 0, jumlah: 0, selepasKunci: 0 });
    perKelas[k].hari++; perKelas[k].hadir += Number(r.Hadir); perKelas[k].jumlah += Number(r.JumlahMurid); if (r.SelepasKunci === 'YA') perKelas[k].selepasKunci++;
    (perTarikh[t] = perTarikh[t] || { hadir: 0, jumlah: 0 }); perTarikh[t].hadir += Number(r.Hadir); perTarikh[t].jumlah += Number(r.JumlahMurid);
  });
  const th = bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).filter(t => keTarikh(t.Tarikh).slice(0, 7) === bulan);
  const sebab = {}; th.forEach(t => { sebab[t.Sebab] = (sebab[t.Sebab] || 0) + 1; });
  return {
    perKelas: Object.keys(perKelas).sort().map(k => ({ kelas: k, hari: perKelas[k].hari, peratus: bulatPeratus(perKelas[k].hadir, perKelas[k].jumlah), selepasKunci: perKelas[k].selepasKunci })),
    harian: Object.keys(perTarikh).sort().map(t => ({ tarikh: t, peratus: bulatPeratus(perTarikh[t].hadir, perTarikh[t].jumlah) })),
    sebab: Object.keys(sebab).map(s => ({ sebab: s, bil: sebab[s] })).sort((a, b) => b.bil - a.bil),
    ringkasan: { rekod: rekod.length, tidakHadir: th.length, ponteng: th.filter(t => String(t.DikiraPonteng) === 'YA').length,
      peratus: bulatPeratus(rekod.reduce((s, r) => s + Number(r.Hadir), 0), rekod.reduce((s, r) => s + Number(r.JumlahMurid), 0)) }
  };
}

function apiRekodKehadiran(p) {
  const sesi = wajibSesi(p.token);
  if (gagal(sesi)) return sesi;
  const bulan = /^\d{4}-\d{2}$/.test(String(p.bulan || '')) ? p.bulan : tarikhHariIni().slice(0, 7);
  const hasil = { bulan, labelBulan: BULAN_MS[Number(bulan.slice(5, 7)) - 1] + ' ' + bulan.slice(0, 4) };
  if (sesi.jenis === 'MURID') {
    const murid = cariMurid(sesi.nokp);
    if (!murid) return ralat('Rekod murid tidak dijumpai.');
    hasil.murid = analisisMurid(murid, bulan);
    return jaya(hasil);
  }
  if (adalahAdmin(sesi)) {
    hasil.sekolah = analisisBulananSekolah(bulan);
    hasil.senaraiKelas = senaraiKelas().map(k => k.kelas);
  }
  const kelas = adalahAdmin(sesi) && p.kelas ? normalKelas(p.kelas) : (adalahGuruKelas(sesi) ? sesi.kelasTingkatan : '');
  if (kelas) hasil.kelas = analisisBulananKelas(kelas, bulan);
  hasil.subjek = analisisBulananSubjekGuru(sesi, bulan);
  return jaya(hasil);
}

/* ============================== KELAS DIAJAR & TEACH-IN ============================== */
function apiKelasDiajar(p) {
  const sesi = wajibSesi(p.token, { jenis: 'GURU' });
  if (gagal(sesi)) return sesi;
  const tarikh = tarikhHariIni();
  const jadual = jadualGuru(sesi);
  const kiraMurid = {}; senaraiMurid().forEach(m => { kiraMurid[m.Kelas] = (kiraMurid[m.Kelas] || 0) + 1; });
  const kelasUnik = {};
  jadual.forEach(j => { const k = j.Kelas + '|' + j.Subjek; (kelasUnik[k] = kelasUnik[k] || { kelas: j.Kelas, subjek: j.Subjek, waktu: 0 }); kelasUnik[k].waktu++; });
  const log = bacaSheetSebagaiObjek(SHEET.LOG_SUBJEK).filter(l => samaNoKP(l.NoKPGuru, sesi.nokp));
  const teachIn = teachInGuru(sesi).filter(t => t.Tarikh >= tambahHari(tarikh, -60)).sort((a, b) => (b.Tarikh + b.Slot).localeCompare(a.Tarikh + a.Slot))
    .map(t => {
      const l = log.find(x => keTarikh(x.Tarikh) === t.Tarikh && normalKelas(x.Kelas) === t.Kelas && String(x.Slot) === String(t.Slot));
      return { tarikh: t.Tarikh, hari: hariBagiTarikh(t.Tarikh), slot: t.Slot, kelas: t.Kelas, subjek: t.Subjek, guruAsal: t.NamaGuruAsal,
        status: t.Tarikh > tarikh ? 'AKAN DATANG' : (l ? 'DIREKOD' : (t.Tarikh === tarikh ? 'HARI INI' : 'TIDAK DIREKOD')),
        hadir: l ? Number(l.Hadir) : null, jumlah: l ? Number(l.JumlahMurid) : null };
    });
  return jaya({
    slot: slotJadual(jadual), hariSekolah: senaraiDaripadaMedan(tetapan('HARI_PERSEKOLAHAN')),
    jadual: jadual.map(j => ({ hari: j.Hari, slot: j.Slot, kelas: j.Kelas, subjek: j.Subjek })),
    kelas: Object.keys(kelasUnik).map(k => Object.assign(kelasUnik[k], { bilMurid: kiraMurid[kelasUnik[k].kelas] || 0,
      sesiDirekod: log.filter(l => normalKelas(l.Kelas) === kelasUnik[k].kelas && l.Subjek === kelasUnik[k].subjek).length })),
    teachIn, ringkasanTeachIn: { jumlah: teachIn.length, direkod: teachIn.filter(t => t.status === 'DIREKOD').length,
      akanDatang: teachIn.filter(t => t.status === 'AKAN DATANG').length, tidakDirekod: teachIn.filter(t => t.status === 'TIDAK DIREKOD').length },
    sumber: tetapan('TEACHIN_SPREADSHEET_ID') ? 'e-Teach-In' : 'Sheet tempatan (e-Teach-In belum disambung)'
  });
}

/* Lajur grid jadual mingguan = blok unik dalam jadual guru (Perdana & T6 berbeza waktu). */
function slotJadual(jadual) {
  const peta = {};
  jadual.forEach(j => { if (j.MasaMula && !peta[j.MasaMula]) peta[j.MasaMula] = { slot: j.Slot, mula: j.MasaMula, tamat: j.MasaTamat }; });
  const senarai = Object.keys(peta).sort().map(k => peta[k]);
  return senarai.length ? senarai : senaraiSlot();
}

/* ============================== PROFIL PELAJAR ============================== */
function kelasDalamSkopGuru(sesi) {
  if (adalahAdmin(sesi)) return null; // semua
  const s = {};
  if (sesi.kelasTingkatan) s[sesi.kelasTingkatan] = true;
  jadualGuru(sesi).forEach(j => { s[j.Kelas] = true; });
  teachInGuru(sesi).forEach(t => { s[t.Kelas] = true; });
  return s;
}

function apiCariPelajar(p) {
  const sesi = wajibSesi(p.token, { jenis: 'GURU' });
  if (gagal(sesi)) return sesi;
  const skop = kelasDalamSkopGuru(sesi);
  const q = normalNama(p.q || ''), qd = digitSahaja(p.q || '');
  const kelas = normalKelas(p.kelas || '');
  const senarai = senaraiMurid().filter(m => (!skop || skop[m.Kelas]) && (!kelas || m.Kelas === kelas)
    && (!q || normalNama(m.Nama).indexOf(q) !== -1 || (qd.length >= 4 && digitSahaja(m.NoKP).indexOf(qd) !== -1)))
    .sort((a, b) => (a.Kelas + a.Nama).localeCompare(b.Kelas + b.Nama)).slice(0, 300)
    .map(m => ({ nokp: digitSahaja(m.NoKP), nama: m.Nama, kelas: m.Kelas, jantina: m.Jantina, gambar: m.GambarUrl }));
  return jaya({ senarai, senaraiKelas: skop ? Object.keys(skop).sort() : senaraiKelas().map(k => k.kelas) });
}

function apiProfilPelajar(p) {
  const sesi = wajibSesi(p.token);
  if (gagal(sesi)) return sesi;
  const nokp = sesi.jenis === 'MURID' ? sesi.nokp : p.nokp;
  const murid = cariMurid(nokp);
  if (!murid) return ralat('Rekod murid tidak dijumpai dalam e-Data & Enrolmen.');
  if (sesi.jenis === 'GURU') { const skop = kelasDalamSkopGuru(sesi); if (skop && !skop[murid.Kelas]) return ralat('Murid ini di luar kelas yang anda ajar.'); }
  const ctx = konteksKehadiranTahun(tarikhHariIni().slice(0, 4));
  const sejarah = sejarahHarianMurid(murid, ctx);
  const a = analisisPonteng(sejarah);
  const gt = senaraiGuru().filter(g => normalKelas(g.KelasTingkatan) === murid.Kelas);
  return jaya({
    profil: profilMuridUntukKlien(murid),
    guruTingkatan: gt.filter(g => perananGuru(g).indexOf('GT') !== -1).map(g => g.Nama),
    penolongGT: gt.filter(g => perananGuru(g).indexOf('PGT') !== -1).map(g => g.Nama),
    kehadiran: { hari: a.hariSekolah, hadir: a.hadir, peratus: bulatPeratus(a.hadir, a.hariSekolah), tidakHadirSah: a.tidakHadirSah, ponteng: a.TIDAK_BERTURUT.hari,
      pontengKelas: kesPontengKelasMurid(murid.NoKP, tarikhHariIni().slice(0, 4)).length,
      berturut: a.BERTURUT.hari, peringkatBerturut: a.BERTURUT.peringkat.label, peringkatTidakBerturut: a.TIDAK_BERTURUT.peringkat.label },
    trend: trendBulanan(sejarah),
    tidakHadirTerkini: sejarah.filter(h => !h.hadir).slice(-10).reverse(),
    sumber: tetapan('EDATA_SPREADSHEET_ID') ? 'e-Data & Enrolmen' : 'Sheet tempatan (e-Data belum disambung)'
  });
}
