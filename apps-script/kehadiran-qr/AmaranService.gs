/* =========================================================================
 * AmaranService.gs — amaran ponteng, intervensi & surat amaran.
 *
 * Asas kiraan: hari persekolahan = hari kelas murid ada rekod kehadiran
 * harian (REKOD_KELAS_HARIAN). Hari tidak hadir dikira PONTENG jika sebabnya
 * ditanda DikiraPonteng = YA dalam senarai sebab (IDME).
 *
 *  BERTURUT-TURUT  : bilangan hari ponteng berturut-turut terkini (episod).
 *                    Hadir, atau tidak hadir dengan sebab sah, menamatkan episod.
 *                    Amaran 1: hari ke-3 · Amaran 2: +7 (10) · Terakhir: +7 (17) · Buang: +14 (31)
 *  TIDAK BERTURUT  : jumlah hari ponteng terkumpul dalam tahun semasa.
 *                    Amaran 1: hari ke-10 · Amaran 2: +10 (20) · Terakhir: +20 (40) · Buang: +20 (60)
 * ========================================================================= */

function konteksKehadiranTahun(tahun) {
  const hariKelas = {};
  bacaSheetSebagaiObjek(SHEET.REKOD_KELAS).forEach(r => {
    const t = keTarikh(r.Tarikh); if (t.slice(0, 4) !== String(tahun)) return;
    const k = normalKelas(r.Kelas); (hariKelas[k] = hariKelas[k] || []).push(t);
  });
  Object.keys(hariKelas).forEach(k => { hariKelas[k] = Array.from(new Set(hariKelas[k])).sort(); });
  const tidakHadir = {};
  bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR).forEach(t => {
    const tk = keTarikh(t.Tarikh); if (tk.slice(0, 4) !== String(tahun)) return;
    const n = digitSahaja(t.NoKPMurid);
    (tidakHadir[n] = tidakHadir[n] || {})[tk] = { kod: String(t.KodSebab), sebab: String(t.Sebab), ponteng: String(t.DikiraPonteng).toUpperCase() === 'YA' };
  });
  return { hariKelas, tidakHadir, tahun: String(tahun) };
}

function sejarahHarianMurid(murid, ctx) {
  const hari = ctx.hariKelas[normalKelas(murid.Kelas)] || [];
  const th = ctx.tidakHadir[digitSahaja(murid.NoKP)] || {};
  return hari.map(t => th[t] ? { tarikh: t, hadir: false, kod: th[t].kod, sebab: th[t].sebab, ponteng: th[t].ponteng }
                             : { tarikh: t, hadir: true });
}

function peringkatUntuk(kategori, hari) {
  const senarai = PERINGKAT_AMARAN[kategori];
  let indeks = -1;
  senarai.forEach((p, i) => { if (hari >= p.hari) indeks = i; });
  const seterusnya = senarai[indeks + 1] || null;
  return { indeks, kod: indeks >= 0 ? senarai[indeks].kod : '', label: indeks >= 0 ? senarai[indeks].label : 'Tiada',
    seterusnya: seterusnya ? { kod: seterusnya.kod, label: seterusnya.label, hari: seterusnya.hari, baki: seterusnya.hari - hari } : null };
}

function analisisPonteng(sejarah) {
  let berturut = 0, mula = '';
  for (let i = sejarah.length - 1; i >= 0; i--) {
    const h = sejarah[i];
    if (!h.hadir && h.ponteng) { berturut++; mula = h.tarikh; } else break;
  }
  const tarikhPonteng = sejarah.filter(h => !h.hadir && h.ponteng).map(h => h.tarikh);
  const tidakHadirSah = sejarah.filter(h => !h.hadir && !h.ponteng).length;
  return {
    hariSekolah: sejarah.length, hadir: sejarah.filter(h => h.hadir).length, tidakHadirSah,
    BERTURUT: { hari: berturut, mulaEpisod: mula, peringkat: peringkatUntuk('BERTURUT', berturut) },
    TIDAK_BERTURUT: { hari: tarikhPonteng.length, peringkat: peringkatUntuk('TIDAK_BERTURUT', tarikhPonteng.length) },
    tarikhPonteng
  };
}

/* Surat yang sudah dikeluarkan bagi episod/tahun semasa → indeks peringkat tertinggi. */
function suratDikeluarkan(nokp, kategori, analisis, semuaSurat) {
  const senarai = semuaSurat.filter(s => samaNoKP(s.NoKPMurid, nokp) && s.Kategori === kategori && (
    kategori === 'BERTURUT' ? keTarikh(s.MulaEpisod) === analisis.BERTURUT.mulaEpisod && !!analisis.BERTURUT.mulaEpisod
                            : keTarikh(s.TarikhKeluar).slice(0, 4) === tarikhHariIni().slice(0, 4)));
  let indeks = -1;
  senarai.forEach(s => { const i = PERINGKAT_AMARAN[kategori].findIndex(p => p.kod === s.Peringkat); if (i > indeks) indeks = i; });
  return { indeks, surat: senarai.map(s => ({ noRujukan: s.NoRujukan, peringkat: s.Peringkat, tarikh: keTarikh(s.TarikhKeluar) })) };
}

function wajibAksesAmaran(token) {
  const sesi = wajibSesi(token, { peranan: KUMPULAN_GURU_KELAS.concat([PERANAN.ADMIN]) });
  if (gagal(sesi)) return sesi;
  if (!adalahAdmin(sesi) && !sesi.kelasTingkatan) return ralat('Kelas tingkatan anda belum ditetapkan. Sila hubungi admin.');
  return sesi;
}
function bolehAksesMurid(sesi, murid) { return adalahAdmin(sesi) || (murid && murid.Kelas === sesi.kelasTingkatan); }

function statusAmaranMurid(murid, ctx, semuaSurat) {
  const a = analisisPonteng(sejarahHarianMurid(murid, ctx));
  const o = { nokp: digitSahaja(murid.NoKP), nama: murid.Nama, kelas: murid.Kelas, gambar: murid.GambarUrl,
    hariSekolah: a.hariSekolah, hadir: a.hadir, peratusHadir: bulatPeratus(a.hadir, a.hariSekolah), jumlahPonteng: a.TIDAK_BERTURUT.hari };
  ['BERTURUT', 'TIDAK_BERTURUT'].forEach(k => {
    const s = suratDikeluarkan(murid.NoKP, k, a, semuaSurat);
    o[k] = Object.assign({}, a[k], { indeksSurat: s.indeks, surat: s.surat, perluSurat: a[k].peringkat.indeks > s.indeks });
  });
  return o;
}

function apiAmaranPonteng(p) {
  const sesi = wajibAksesAmaran(p.token);
  if (gagal(sesi)) return sesi;
  const kelas = adalahAdmin(sesi) ? normalKelas(p.kelas || '') : sesi.kelasTingkatan;
  const ctx = konteksKehadiranTahun(tarikhHariIni().slice(0, 4));
  const semuaSurat = bacaSheetSebagaiObjek(SHEET.SURAT);
  const intervensi = bacaSheetSebagaiObjek(SHEET.INTERVENSI);
  const murid = kelas ? muridDalamKelas(kelas) : senaraiMurid();
  const senarai = murid.map(m => statusAmaranMurid(m, ctx, semuaSurat))
    .filter(s => s.BERTURUT.hari >= 1 || s.TIDAK_BERTURUT.hari >= 1)
    .map(s => Object.assign(s, { bilIntervensi: intervensi.filter(i => samaNoKP(i.NoKPMurid, s.nokp)).length }))
    .sort((a, b) => (b.BERTURUT.peringkat.indeks + b.TIDAK_BERTURUT.peringkat.indeks) - (a.BERTURUT.peringkat.indeks + a.TIDAK_BERTURUT.peringkat.indeks)
      || b.jumlahPonteng - a.jumlahPonteng);

  const ringkasan = { BERTURUT: {}, TIDAK_BERTURUT: {}, perluTindakan: 0, hampir: 0 };
  senarai.forEach(s => {
    ['BERTURUT', 'TIDAK_BERTURUT'].forEach(k => {
      if (s[k].peringkat.kod) ringkasan[k][s[k].peringkat.kod] = (ringkasan[k][s[k].peringkat.kod] || 0) + 1;
    });
    if (s.BERTURUT.perluSurat || s.TIDAK_BERTURUT.perluSurat) ringkasan.perluTindakan++;
    const hampir = ['BERTURUT', 'TIDAK_BERTURUT'].some(k => s[k].peringkat.seterusnya && s[k].peringkat.seterusnya.baki <= 2 && s[k].hari > 0);
    if (hampir) ringkasan.hampir++;
  });
  return jaya({ kelas: kelas || 'SEMUA KELAS', senarai, ringkasan, peringkat: PERINGKAT_AMARAN, labelKategori: LABEL_KATEGORI_AMARAN,
    tindakan: SENARAI_TINDAKAN_INTERVENSI, senaraiKelas: adalahAdmin(sesi) ? senaraiKelas().map(k => k.kelas) : [] });
}

function apiButiranAmaranMurid(p) {
  const sesi = wajibAksesAmaran(p.token);
  if (gagal(sesi)) return sesi;
  const murid = cariMurid(p.nokp);
  if (!murid || !bolehAksesMurid(sesi, murid)) return ralat('Murid tidak dijumpai atau di luar kelas anda.');
  const ctx = konteksKehadiranTahun(tarikhHariIni().slice(0, 4));
  const sejarah = sejarahHarianMurid(murid, ctx);
  const status = statusAmaranMurid(murid, ctx, bacaSheetSebagaiObjek(SHEET.SURAT));
  return jaya({
    murid: profilMuridUntukKlien(murid), status,
    tidakHadir: sejarah.filter(h => !h.hadir).reverse(),
    surat: bacaSheetSebagaiObjek(SHEET.SURAT).filter(s => samaNoKP(s.NoKPMurid, murid.NoKP))
      .map(s => ({ noRujukan: s.NoRujukan, tarikh: keTarikh(s.TarikhKeluar), kategori: s.Kategori, peringkat: s.Peringkat, bilHari: s.BilHari, oleh: s.NamaGuru }))
      .reverse(),
    intervensi: bacaSheetSebagaiObjek(SHEET.INTERVENSI).filter(i => samaNoKP(i.NoKPMurid, murid.NoKP))
      .map(i => ({ id: i.IdIntervensi, tarikh: keTarikh(i.Tarikh), kategori: i.Kategori, tindakan: i.Tindakan, catatan: i.Catatan, oleh: i.NamaGuru }))
      .reverse(),
    tindakan: SENARAI_TINDAKAN_INTERVENSI
  });
}

function apiRekodIntervensi(p) {
  const sesi = wajibAksesAmaran(p.token);
  if (gagal(sesi)) return sesi;
  const murid = cariMurid(p.nokp);
  if (!murid || !bolehAksesMurid(sesi, murid)) return ralat('Murid tidak dijumpai atau di luar kelas anda.');
  const tindakan = String(p.tindakan || '').trim();
  if (!tindakan) return ralat('Sila pilih tindakan/intervensi.');
  const tarikh = tarikhSah(p.tarikh) && p.tarikh <= tarikhHariIni() ? p.tarikh : tarikhHariIni();
  return denganKunci(() => {
    tambahBaris(SHEET.INTERVENSI, { IdIntervensi: janaId('IV'), Tarikh: tarikh, NoKPMurid: "'" + digitSahaja(murid.NoKP), NamaMurid: murid.Nama,
      Kelas: murid.Kelas, Kategori: p.kategori === 'BERTURUT' || p.kategori === 'TIDAK_BERTURUT' ? p.kategori : 'UMUM',
      Tindakan: tindakan, Catatan: String(p.catatan || '').slice(0, 1000), NoKPGuru: "'" + sesi.nokp, NamaGuru: sesi.nama,
      Masa: formatTarikhMasa(sekarang()) });
    catatAudit(sesi, 'REKOD_INTERVENSI', murid.Nama + ': ' + tindakan);
    return jaya({});
  });
}

/* Jana surat amaran bagi peringkat semasa yang sudah dicapai. Jika surat
   peringkat itu sudah dikeluarkan bagi episod ini, pulangkan surat sedia ada
   (cetak semula) — tiada nombor rujukan berganda. */
function apiJanaSurat(p) {
  const sesi = wajibAksesAmaran(p.token);
  if (gagal(sesi)) return sesi;
  const kategori = p.kategori === 'BERTURUT' ? 'BERTURUT' : 'TIDAK_BERTURUT';
  const murid = cariMurid(p.nokp);
  if (!murid || !bolehAksesMurid(sesi, murid)) return ralat('Murid tidak dijumpai atau di luar kelas anda.');

  return denganKunci(() => {
    const ctx = konteksKehadiranTahun(tarikhHariIni().slice(0, 4));
    const sejarah = sejarahHarianMurid(murid, ctx);
    const a = analisisPonteng(sejarah);
    const pk = a[kategori].peringkat;
    if (pk.indeks < 0) return ralat('Murid ini belum mencapai peringkat amaran bagi kategori ' + LABEL_KATEGORI_AMARAN[kategori] + '.');
    const semuaSurat = bacaSheetSebagaiObjek(SHEET.SURAT);
    const kodPeringkat = p.peringkat && PERINGKAT_AMARAN[kategori].findIndex(x => x.kod === p.peringkat) <= pk.indeks ? p.peringkat : pk.kod;
    const dikeluarkan = suratDikeluarkan(murid.NoKP, kategori, a, semuaSurat).surat.find(s => s.peringkat === kodPeringkat);

    let noRujukan, tarikhKeluar;
    if (dikeluarkan) { noRujukan = dikeluarkan.noRujukan; tarikhKeluar = dikeluarkan.tarikh; }
    else {
      const tahun = tarikhHariIni().slice(0, 4);
      const bil = semuaSurat.filter(s => String(s.NoRujukan).indexOf('/' + tahun + '/') !== -1).length + 1;
      noRujukan = (tetapan('PREFIKS_RUJUKAN_SURAT') || 'SMKA/HEM/KHD') + '/' + tahun + '/' + ('000' + bil).slice(-4);
      tarikhKeluar = tarikhHariIni();
      tambahBaris(SHEET.SURAT, { NoRujukan: noRujukan, TarikhKeluar: tarikhKeluar, NoKPMurid: "'" + digitSahaja(murid.NoKP), NamaMurid: murid.Nama,
        Kelas: murid.Kelas, Kategori: kategori, Peringkat: kodPeringkat, BilHari: a[kategori].hari,
        MulaEpisod: kategori === 'BERTURUT' ? a.BERTURUT.mulaEpisod : '', NoKPGuru: "'" + sesi.nokp, NamaGuru: sesi.nama,
        Masa: formatTarikhMasa(sekarang()) });
      catatAudit(sesi, 'JANA_SURAT_AMARAN', noRujukan + ' ' + murid.Nama + ' ' + kodPeringkat);
    }
    const tarikhRujukan = kategori === 'BERTURUT' ? a.tarikhPonteng.filter(t => t >= a.BERTURUT.mulaEpisod) : a.tarikhPonteng;
    const guruKelas = bacaSheetSebagaiObjek(SHEET.GURU).filter(g => normalKelas(g.KelasTingkatan) === murid.Kelas && perananGuru(g).indexOf('GT') !== -1)[0];
    return jaya({ surat: {
      noRujukan, tarikhKeluar, kategori, labelKategori: LABEL_KATEGORI_AMARAN[kategori], peringkat: kodPeringkat,
      labelPeringkat: PERINGKAT_AMARAN[kategori].find(x => x.kod === kodPeringkat).label, bilHari: a[kategori].hari,
      tarikhPonteng: tarikhRujukan, murid: profilMuridUntukKlien(murid),
      sekolah: { nama: tetapan('NAMA_SEKOLAH'), alamat: tetapan('ALAMAT_SEKOLAH'), telefon: tetapan('TELEFON_SEKOLAH'),
        emel: tetapan('EMEL_SEKOLAH'), kod: tetapan('KOD_SEKOLAH'), pengetua: tetapan('NAMA_PENGETUA') },
      guruTingkatan: guruKelas ? guruKelas.Nama : (adalahGuruKelas(sesi) ? sesi.nama : ''),
      ambang: PERINGKAT_AMARAN[kategori]
    } });
  });
}
