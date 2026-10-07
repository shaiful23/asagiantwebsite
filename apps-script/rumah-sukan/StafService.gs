/* =========================================================================
 * StafService.gs — Pengurusan guru & staf AKP: daftar/sunting, import pukal,
 * penetapan rumah sukan + peranan rumah (Ketua / Penolong Ketua / Guru Rumah),
 * hak Admin, dan agihan automatik guru ke rumah sukan.
 * ========================================================================= */

function normalJantina(nilai, nokp) {
  const s = banding(nilai);
  if (/^(L|LELAKI|M|MALE)$/.test(s)) return 'LELAKI';
  if (/^(P|PEREMPUAN|F|FEMALE|W)$/.test(s)) return 'PEREMPUAN';
  return jantinaDaripadaKP(nokp);
}

function normalPerananRumah(nilai, rumahId) {
  if (!rumahId) return '';
  const s = banding(nilai).replace(/\s+/g, '_');
  if (NAMA_PERANAN_RUMAH[s]) return s;
  if (/^KETUA/.test(s)) return PERANAN_RUMAH.KETUA;
  if (/^PENOLONG/.test(s)) return PERANAN_RUMAH.PENOLONG;
  return PERANAN_RUMAH.GURU;
}

function stafKeKlien(s, rumah, ajkMengikutKP) {
  const r = rumah[s.RumahId];
  return {
    nokp: normalKP(s.NoKP), nama: s.NamaPenuh, kategori: s.Kategori || 'GURU', jantina: s.Jantina || jantinaDaripadaKP(s.NoKP),
    jawatan: s.Jawatan || '', telefon: String(s.Telefon || ''), emel: s.Emel || '',
    admin: ya(s.Admin), rumahId: r ? r.id : '', rumah: r ? r.nama : '', warna: r ? r.warna : '',
    perananRumah: r ? (s.PerananRumah || PERANAN_RUMAH.GURU) : '', status: s.Status || 'AKTIF',
    mestiTukar: ya(s.MestiTukarPassword) || !String(s.Password || ''),
    ajk: (ajkMengikutKP && ajkMengikutKP[normalKP(s.NoKP)]) || []
  };
}

/* Semak had Ketua Guru Rumah bagi setiap rumah dalam keadaan akhir senarai staf. */
function semakHadKetua(senaraiStaf, rumah) {
  const bil = {};
  senaraiStaf.forEach(s => {
    if (aktif(s) && s.RumahId && s.PerananRumah === PERANAN_RUMAH.KETUA) bil[s.RumahId] = (bil[s.RumahId] || 0) + 1;
  });
  const lebih = Object.keys(bil).filter(id => bil[id] > HAD_KETUA_SETIAP_RUMAH);
  if (lebih.length) return 'Setiap rumah hanya boleh mempunyai ' + HAD_KETUA_SETIAP_RUMAH + ' Ketua Guru Rumah. Semak: ' +
    lebih.map(id => (rumah[id] ? rumah[id].nama : id)).join(', ') + '.';
  return '';
}

function apiSenaraiStaf(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const rumah = petaRumah();
  const ajk = ajkMengikutKP(tahunKejohanan());
  const senarai = bacaSheetSebagaiObjek(SHEET_STAF).filter(s => s.NoKP)
    .map(s => stafKeKlien(s, rumah, ajk))
    .sort((a, b) => a.nama.localeCompare(b.nama));
  return jaya({ senarai });
}

function apiSimpanStaf(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const d = p.data || {};
  const nokp = normalKP(d.nokp);
  if (nokp.length !== 12) return ralat('No. KP mesti 12 digit.');
  const nama = banding(d.nama);
  if (!nama) return ralat('Nama diperlukan.');
  const kategori = KATEGORI_STAF.indexOf(banding(d.kategori)) !== -1 ? banding(d.kategori) : 'GURU';
  const rumah = petaRumah();
  const rumahId = rumah[d.rumahId] ? d.rumahId : '';

  return denganKunci(() => {
    const semua = bacaSheetSebagaiObjek(SHEET_STAF);
    if (bacaSheetSebagaiObjek(SHEET_MURID).some(m => normalKP(m.NoKP) === nokp)) return ralat('No. KP ini sudah didaftarkan sebagai MURID.');
    const sedia = semua.find(s => normalKP(s.NoKP) === nokp);
    if (d.baharu && sedia) return ralat('No. KP ini sudah didaftarkan (' + sedia.NamaPenuh + ').');
    if (sedia && nokp === sesi.nokp && (!d.admin || banding(d.status) === 'TIDAK AKTIF')) {
      return ralat('Anda tidak boleh membuang hak Admin atau menyahaktifkan akaun sendiri.');
    }
    const objek = Object.assign({}, sedia || { Password: '', MestiTukarPassword: 'YA' }, {
      NoKP: nokp, NamaPenuh: nama, Kategori: kategori, Jantina: normalJantina(d.jantina, nokp),
      Jawatan: teksBersih(d.jawatan), Telefon: teksBersih(d.telefon), Emel: teksBersih(d.emel).toLowerCase(),
      Admin: d.admin ? 'YA' : 'TIDAK', RumahId: rumahId, PerananRumah: normalPerananRumah(d.perananRumah, rumahId),
      Status: banding(d.status) === 'TIDAK AKTIF' ? 'TIDAK AKTIF' : 'AKTIF', Dikemaskini: sekarangTeks()
    });
    const akhir = semua.filter(s => normalKP(s.NoKP) !== nokp).concat([objek]);
    const salah = semakHadKetua(akhir, rumah);
    if (salah) return ralat(salah);
    if (sedia) kemaskiniBaris(SHEET_STAF, sedia.__row, objek); else tambahBaris(SHEET_STAF, objek);
    catatAudit(sesi, sedia ? 'KEMASKINI_STAF' : 'TAMBAH_STAF', 'STAF', nokp, nama + ' | ' + kategori + ' | rumah ' + (rumah[rumahId] ? rumah[rumahId].nama : '-'));
    return jaya({});
  });
}

function apiPadamStaf(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const nokp = normalKP(p.nokp);
  if (nokp === sesi.nokp) return ralat('Anda tidak boleh memadam akaun sendiri.');
  return denganKunci(() => {
    const s = bacaSheetSebagaiObjek(SHEET_STAF).find(x => normalKP(x.NoKP) === nokp);
    if (!s) return ralat('Staf tidak dijumpai.');
    padamBaris(SHEET_STAF, s.__row, s.NoKP);
    // buang lantikan AJK staf ini (padam dari bawah supaya nombor baris kekal sah)
    bacaSheetSebagaiObjek(SHEET_AJK_AHLI).filter(a => normalKP(a.NoKP) === nokp)
      .sort((a, b) => b.__row - a.__row).forEach(a => padamBaris(SHEET_AJK_AHLI, a.__row, a.Id));
    catatAudit(sesi, 'PADAM_STAF', 'STAF', nokp, s.NamaPenuh);
    return jaya({});
  });
}

/* Import pukal guru/AKP. p.baris = [{nokp, nama, kategori, jantina, jawatan, telefon, emel}].
   Rekod sedia ada dikemaskini (kata laluan, admin, rumah & peranan TIDAK disentuh). */
function apiImportStaf(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const baris = p.baris || [];
  if (!baris.length) return ralat('Tiada data untuk diimport.');
  if (baris.length > 1000) return ralat('Maksimum 1000 baris bagi setiap import staf.');

  return denganKunci(() => {
    const kpMurid = {};
    bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => { kpMurid[normalKP(m.NoKP)] = true; });
    const sedia = {};
    bacaSheetSebagaiObjek(SHEET_STAF).forEach(s => { sedia[normalKP(s.NoKP)] = s; });
    const ralatBaris = [], objek = [];
    const masa = sekarangTeks();
    baris.forEach((b, i) => {
      const nokp = normalKP(b.nokp);
      const nama = banding(b.nama);
      if (nokp.length !== 12) { ralatBaris.push('Baris ' + (i + 1) + ': No. KP tidak sah (' + (b.nokp || '') + ')'); return; }
      if (!nama) { ralatBaris.push('Baris ' + (i + 1) + ': nama kosong'); return; }
      if (kpMurid[nokp]) { ralatBaris.push('Baris ' + (i + 1) + ': ' + nokp + ' sudah didaftarkan sebagai murid'); return; }
      const kategori = /AKP|ANGGOTA|STAF|PEMBANTU|PAR|PT|KERANI/.test(banding(b.kategori)) ? 'AKP' : 'GURU';
      const o = {
        NoKP: nokp, NamaPenuh: nama, Kategori: kategori, Jantina: normalJantina(b.jantina, nokp),
        Jawatan: teksBersih(b.jawatan), Telefon: teksBersih(b.telefon), Emel: teksBersih(b.emel).toLowerCase(), Dikemaskini: masa
      };
      if (!sedia[nokp]) Object.assign(o, { Password: '', Admin: 'TIDAK', RumahId: '', PerananRumah: '', MestiTukarPassword: 'YA', Status: 'AKTIF' });
      else ['Jawatan', 'Telefon', 'Emel'].forEach(k => { if (!o[k]) delete o[k]; });   // jangan kosongkan medan sedia ada
      objek.push(o);
    });
    const hasil = upsertBanyak(SHEET_STAF, 'NoKP', objek);
    catatAudit(sesi, 'IMPORT_STAF', 'STAF', '', hasil.ditambah + ' baharu, ' + hasil.dikemaskini + ' dikemaskini, ' + ralatBaris.length + ' ralat');
    return jaya({ ditambah: hasil.ditambah, dikemaskini: hasil.dikemaskini, ralat: ralatBaris.slice(0, 100), bilRalat: ralatBaris.length });
  });
}

/* Simpan perubahan rumah & peranan bagi ramai staf sekali gus (jadual penetapan guru).
   p.perubahan = [{nokp, rumahId, perananRumah}] */
function apiTetapkanRumahStaf(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const perubahan = p.perubahan || [];
  if (!perubahan.length) return ralat('Tiada perubahan untuk disimpan.');
  const rumah = petaRumah();
  return denganKunci(() => {
    const semua = bacaSheetSebagaiObjek(SHEET_STAF);
    const ikutKP = {};
    semua.forEach(s => { ikutKP[normalKP(s.NoKP)] = s; });
    const objek = [];
    const masa = sekarangTeks();
    for (const u of perubahan) {
      const s = ikutKP[normalKP(u.nokp)];
      if (!s) return ralat('Staf ' + u.nokp + ' tidak dijumpai.');
      const rumahId = rumah[u.rumahId] ? u.rumahId : '';
      s.RumahId = rumahId;
      s.PerananRumah = normalPerananRumah(u.perananRumah, rumahId);
      objek.push({ NoKP: s.NoKP, RumahId: s.RumahId, PerananRumah: s.PerananRumah, Dikemaskini: masa });
    }
    const salah = semakHadKetua(semua, rumah);
    if (salah) return ralat(salah);
    upsertBanyak(SHEET_STAF, 'NoKP', objek);
    catatAudit(sesi, 'TETAP_RUMAH_STAF', 'STAF', '', objek.length + ' staf dikemaskini');
    return jaya({ bil: objek.length });
  });
}

/* Agih automatik staf AKTIF yang BELUM mempunyai rumah ke rumah sukan secara sama rata
   (seimbang mengikut kategori GURU/AKP dan jantina). p.sertaAkp: sertakan staf AKP. */
function apiAgihStafAuto(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const rumah = senaraiRumah();
  if (rumah.length < 2) return ralat('Tetapkan sekurang-kurangnya 2 rumah sukan dahulu.');
  return denganKunci(() => {
    const semua = bacaSheetSebagaiObjek(SHEET_STAF).filter(aktif);
    const ada = {};
    rumah.forEach(r => { ada[r.id] = true; });
    const kira = {};      // kira[kumpulan][rumahId]
    const jumlah = {};
    rumah.forEach(r => { jumlah[r.id] = 0; });
    const kumpulan = s => (s.Kategori || 'GURU') + '|' + (s.Jantina || jantinaDaripadaKP(s.NoKP));
    semua.forEach(s => {
      if (!ada[s.RumahId]) return;
      const k = kumpulan(s);
      kira[k] = kira[k] || {};
      kira[k][s.RumahId] = (kira[k][s.RumahId] || 0) + 1;
      jumlah[s.RumahId]++;
    });
    const rawak = penjanaRawak(Date.now() % 2147483647);
    const belum = kocok(semua.filter(s => !ada[s.RumahId] && (p.sertaAkp || s.Kategori !== 'AKP')), rawak)
      .sort((a, b) => kumpulan(a).localeCompare(kumpulan(b)));
    const objek = [];
    const masa = sekarangTeks();
    belum.forEach(s => {
      const k = kumpulan(s);
      kira[k] = kira[k] || {};
      // seri dipecahkan oleh susunan rawak (sort V8 stabil)
      const pilih = kocok(rumah.slice(), rawak).sort((a, b) =>
        ((kira[k][a.id] || 0) - (kira[k][b.id] || 0)) || (jumlah[a.id] - jumlah[b.id]))[0];
      kira[k][pilih.id] = (kira[k][pilih.id] || 0) + 1;
      jumlah[pilih.id]++;
      objek.push({ NoKP: s.NoKP, RumahId: pilih.id, PerananRumah: PERANAN_RUMAH.GURU, Dikemaskini: masa });
    });
    upsertBanyak(SHEET_STAF, 'NoKP', objek);
    catatAudit(sesi, 'AGIH_STAF_AUTO', 'STAF', '', objek.length + ' staf diagih');
    return jaya({ bil: objek.length });
  });
}
