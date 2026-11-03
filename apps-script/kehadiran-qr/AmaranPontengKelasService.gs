/* =========================================================================
 * AmaranPontengKelasService.gs — amaran, intervensi & surat bagi murid yang
 * BERULANG kali ponteng kelas (hadir ke sekolah tetapi tiada dalam kelas).
 *
 * Kiraan: kes ponteng kelas terkumpul dalam tahun semasa. Ambang peringkat
 * dari TETAPAN (PK_AMARAN_1, PK_AMARAN_2, PK_AMARAN_TERAKHIR,
 * PK_RUJUKAN_DISIPLIN — lalai 3 / 6 / 10 / 15 kes), boleh diubah admin di UI.
 * Akses: GT/PGT (kelas sendiri) & ADMIN — sama seperti Amaran Ponteng.
 * Surat & intervensi disimpan dalam Sheet SURAT_AMARAN / INTERVENSI dengan
 * Kategori = PONTENG_KELAS.
 * ========================================================================= */

function peringkatPK() {
  return PERINGKAT_AMARAN_PK.map(p => ({ kod: p.kod, label: p.label, hari: Number(tetapan(p.kunci)) || p.lalai }))
    .sort((a, b) => a.hari - b.hari);
}
function peringkatUntukPK(bil, senarai) {
  const s = senarai || peringkatPK();
  let indeks = -1;
  s.forEach((p, i) => { if (bil >= p.hari) indeks = i; });
  const seterusnya = s[indeks + 1] || null;
  return { indeks, kod: indeks >= 0 ? s[indeks].kod : '', label: indeks >= 0 ? s[indeks].label : 'Tiada',
    seterusnya: seterusnya ? { kod: seterusnya.kod, label: seterusnya.label, hari: seterusnya.hari, baki: seterusnya.hari - bil } : null };
}

/* { nokp: [kes ponteng kelas tahun ini] } */
function petaKesPontengKelas(tahun) {
  const peta = {};
  bacaSheetSebagaiObjek(SHEET.TIDAK_HADIR_SUBJEK).forEach(t => {
    if (!adalahPontengKelas(t) || keTarikh(t.Tarikh).slice(0, 4) !== String(tahun)) return;
    const n = digitSahaja(t.NoKPMurid);
    (peta[n] = peta[n] || []).push({ tarikh: keTarikh(t.Tarikh), masa: keHHmm(t.Slot), subjek: String(t.Subjek || ''), guru: t.NamaGuru || '', kelas: normalKelas(t.Kelas) });
  });
  Object.keys(peta).forEach(n => peta[n].sort((a, b) => (a.tarikh + a.masa).localeCompare(b.tarikh + b.masa)));
  return peta;
}

function suratPKDikeluarkan(nokp, semuaSurat, tahun, senaraiPeringkat) {
  const surat = semuaSurat.filter(s => samaNoKP(s.NoKPMurid, nokp) && s.Kategori === 'PONTENG_KELAS' && keTarikh(s.TarikhKeluar).slice(0, 4) === String(tahun));
  let indeks = -1;
  surat.forEach(s => { const i = senaraiPeringkat.findIndex(p => p.kod === s.Peringkat); if (i > indeks) indeks = i; });
  return { indeks, surat: surat.map(s => ({ noRujukan: s.NoRujukan, peringkat: s.Peringkat, tarikh: keTarikh(s.TarikhKeluar) })) };
}

function statusPKMurid(murid, kes, semuaSurat, tahun, senaraiPeringkat) {
  const bil = kes.length, pk = peringkatUntukPK(bil, senaraiPeringkat), s = suratPKDikeluarkan(murid.NoKP, semuaSurat, tahun, senaraiPeringkat);
  const bulanIni = tarikhHariIni().slice(0, 7);
  return { nokp: digitSahaja(murid.NoKP), nama: murid.Nama, kelas: murid.Kelas, gambar: murid.GambarUrl, bil, bulanIni: kes.filter(k => k.tarikh.slice(0, 7) === bulanIni).length,
    terkini: bil ? kes[bil - 1].tarikh : '', subjekKerap: kiraIkut(kes, k => k.subjek).slice(0, 3).map(x => x.label + ' (' + x.bil + ')').join(', '),
    peringkat: pk, indeksSurat: s.indeks, surat: s.surat, perluSurat: pk.indeks > s.indeks };
}

function apiAmaranPontengKelas(p) {
  const sesi = wajibAksesAmaran(p.token);
  if (gagal(sesi)) return sesi;
  const kelas = adalahAdmin(sesi) ? normalKelas(p.kelas || '') : sesi.kelasTingkatan;
  const tahun = tarikhHariIni().slice(0, 4), senaraiPeringkat = peringkatPK();
  const kes = petaKesPontengKelas(tahun), semuaSurat = bacaSheetSebagaiObjek(SHEET.SURAT);
  const intervensi = bacaSheetSebagaiObjek(SHEET.INTERVENSI).filter(i => i.Kategori === 'PONTENG_KELAS');
  const murid = kelas ? muridDalamKelas(kelas) : senaraiMurid();
  const senarai = murid.filter(m => kes[digitSahaja(m.NoKP)]).map(m => statusPKMurid(m, kes[digitSahaja(m.NoKP)], semuaSurat, tahun, senaraiPeringkat))
    .map(s => Object.assign(s, { bilIntervensi: intervensi.filter(i => samaNoKP(i.NoKPMurid, s.nokp)).length }))
    .sort((a, b) => b.peringkat.indeks - a.peringkat.indeks || b.bil - a.bil);
  const ringkasan = { perluTindakan: senarai.filter(s => s.perluSurat).length,
    hampir: senarai.filter(s => s.peringkat.seterusnya && s.peringkat.seterusnya.baki <= 1).length, peringkat: {} };
  senarai.forEach(s => { if (s.peringkat.kod) ringkasan.peringkat[s.peringkat.kod] = (ringkasan.peringkat[s.peringkat.kod] || 0) + 1; });
  return jaya({ kelas: kelas || 'SEMUA KELAS', tahun, senarai, ringkasan, peringkat: senaraiPeringkat, tindakan: SENARAI_TINDAKAN_INTERVENSI,
    senaraiKelas: adalahAdmin(sesi) ? senaraiKelas().map(k => k.kelas) : [] });
}

function apiButiranAmaranPK(p) {
  const sesi = wajibAksesAmaran(p.token);
  if (gagal(sesi)) return sesi;
  const murid = cariMurid(p.nokp);
  if (!murid || !bolehAksesMurid(sesi, murid)) return ralat('Murid tidak dijumpai atau di luar kelas anda.');
  const tahun = tarikhHariIni().slice(0, 4), senaraiPeringkat = peringkatPK();
  const kes = petaKesPontengKelas(tahun)[digitSahaja(murid.NoKP)] || [];
  return jaya({
    murid: profilMuridUntukKlien(murid), status: statusPKMurid(murid, kes, bacaSheetSebagaiObjek(SHEET.SURAT), tahun, senaraiPeringkat),
    kes: kes.slice().reverse(), peringkat: senaraiPeringkat,
    surat: bacaSheetSebagaiObjek(SHEET.SURAT).filter(s => samaNoKP(s.NoKPMurid, murid.NoKP) && s.Kategori === 'PONTENG_KELAS')
      .map(s => ({ noRujukan: s.NoRujukan, tarikh: keTarikh(s.TarikhKeluar), peringkat: s.Peringkat, bilHari: s.BilHari, oleh: s.NamaGuru })).reverse(),
    intervensi: bacaSheetSebagaiObjek(SHEET.INTERVENSI).filter(i => samaNoKP(i.NoKPMurid, murid.NoKP) && i.Kategori === 'PONTENG_KELAS')
      .map(i => ({ id: i.IdIntervensi, tarikh: keTarikh(i.Tarikh), tindakan: i.Tindakan, catatan: i.Catatan, oleh: i.NamaGuru, nokpGuru: digitSahaja(i.NoKPGuru) })).reverse(),
    tindakan: SENARAI_TINDAKAN_INTERVENSI, nokpSaya: sesi.nokp, admin: adalahAdmin(sesi)
  });
}

function apiJanaSuratPK(p) {
  const sesi = wajibAksesAmaran(p.token);
  if (gagal(sesi)) return sesi;
  const murid = cariMurid(p.nokp);
  if (!murid || !bolehAksesMurid(sesi, murid)) return ralat('Murid tidak dijumpai atau di luar kelas anda.');
  return denganKunci(() => {
    const tahun = tarikhHariIni().slice(0, 4), senaraiPeringkat = peringkatPK();
    const kes = petaKesPontengKelas(tahun)[digitSahaja(murid.NoKP)] || [];
    const pk = peringkatUntukPK(kes.length, senaraiPeringkat);
    if (pk.indeks < 0) return ralat('Murid ini belum mencapai peringkat amaran ponteng kelas (' + senaraiPeringkat[0].hari + ' kes).');
    const semuaSurat = bacaSheetSebagaiObjek(SHEET.SURAT);
    const kod = p.peringkat && senaraiPeringkat.findIndex(x => x.kod === p.peringkat) <= pk.indeks && senaraiPeringkat.findIndex(x => x.kod === p.peringkat) >= 0 ? p.peringkat : pk.kod;
    const sedia = suratPKDikeluarkan(murid.NoKP, semuaSurat, tahun, senaraiPeringkat).surat.find(s => s.peringkat === kod);
    let noRujukan, tarikhKeluar;
    if (sedia) { noRujukan = sedia.noRujukan; tarikhKeluar = sedia.tarikh; }
    else {
      noRujukan = noRujukanBaharu(semuaSurat, tahun);
      tarikhKeluar = tarikhHariIni();
      tambahBaris(SHEET.SURAT, { NoRujukan: noRujukan, TarikhKeluar: tarikhKeluar, NoKPMurid: "'" + digitSahaja(murid.NoKP), NamaMurid: murid.Nama, Kelas: murid.Kelas,
        Kategori: 'PONTENG_KELAS', Peringkat: kod, BilHari: kes.length, MulaEpisod: '', NoKPGuru: "'" + sesi.nokp, NamaGuru: sesi.nama, Masa: formatTarikhMasa(sekarang()) });
      catatAudit(sesi, 'JANA_SURAT_PONTENG_KELAS', noRujukan + ' ' + murid.Nama + ' ' + kod);
    }
    const te = tetapanEData();
    const gt = senaraiGuru().filter(g => normalKelas(g.KelasTingkatan) === murid.Kelas && perananGuru(g).indexOf('GT') !== -1)[0];
    return jaya({ surat: {
      noRujukan, tarikhKeluar, kategori: 'PONTENG_KELAS', labelKategori: 'Ponteng Kelas', peringkat: kod,
      labelPeringkat: senaraiPeringkat.find(x => x.kod === kod).label, bilHari: kes.length, kes,
      tarikhPonteng: kes.map(k => k.tarikh), murid: profilMuridUntukKlien(murid),
      sekolah: { nama: tetapan('NAMA_SEKOLAH') || te.NAMA_SEKOLAH, alamat: tetapan('ALAMAT_SEKOLAH') || te.ALAMAT_SEKOLAH, telefon: tetapan('TELEFON_SEKOLAH'),
        emel: tetapan('EMEL_SEKOLAH'), kod: tetapan('KOD_SEKOLAH') || te.KOD_SEKOLAH, pengetua: tetapan('NAMA_PENGETUA') || te.PENGETUA },
      guruTingkatan: gt ? gt.Nama : (adalahGuruKelas(sesi) ? sesi.nama : ''), ambang: senaraiPeringkat
    } });
  });
}
