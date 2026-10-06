/* =========================================================================
 * MuridService.gs — Pengurusan murid: senarai, sunting, import pukal,
 * penandaan ATLET (+ acara) dan penetapan rumah secara manual (dikunci).
 * ========================================================================= */

function kunciKelas(m) {
  return (String(m.Tingkatan || '').trim().toUpperCase() + ' ' + String(m.Kelas || '').trim().toUpperCase()).trim();
}

function muridKeKlien(m, rumah, cfg) {
  const r = rumah[m.RumahId];
  return {
    nokp: normalKP(m.NoKP), nama: m.NamaPenuh, jantina: m.Jantina || jantinaDaripadaKP(m.NoKP),
    tingkatan: String(m.Tingkatan || ''), kelas: String(m.Kelas || ''), kunciKelas: kunciKelas(m),
    kaum: m.Kaum || '', agama: m.Agama || '', tarikhLahir: String(m.TarikhLahir || ''), noTelPenjaga: String(m.NoTelPenjaga || ''),
    atlet: ya(m.Atlet), acara: m.Acara || '', kategori: kategoriMurid(m, cfg),
    rumahId: r ? r.id : '', kunciRumah: ya(m.KunciRumah), status: m.Status || 'AKTIF',
    mestiTukar: ya(m.MestiTukarPassword) || !String(m.Password || '')
  };
}

/* Senarai penuh murid (dipadatkan) — penapisan & penomboran dibuat di pelayar. */
function apiSenaraiMurid(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const rumah = petaRumah();
  const cfg = konfigKategori();
  const senarai = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => m.NoKP)
    .map(m => muridKeKlien(m, rumah, cfg))
    .sort((a, b) => a.kunciKelas.localeCompare(b.kunciKelas, 'ms', { numeric: true }) || a.nama.localeCompare(b.nama));
  return jaya({ senarai });
}

function apiSimpanMurid(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const d = p.data || {};
  const nokp = normalKP(d.nokp);
  if (nokp.length !== 12) return ralat('No. KP mesti 12 digit.');
  const nama = banding(d.nama);
  if (!nama) return ralat('Nama diperlukan.');
  if (!teksBersih(d.tingkatan) || !teksBersih(d.kelas)) return ralat('Tingkatan dan kelas diperlukan.');
  const rumah = petaRumah();

  return denganKunci(() => {
    if (bacaSheetSebagaiObjek(SHEET_STAF).some(s => normalKP(s.NoKP) === nokp)) return ralat('No. KP ini sudah didaftarkan sebagai guru/staf.');
    const sedia = bacaSheetSebagaiObjek(SHEET_MURID).find(m => normalKP(m.NoKP) === nokp);
    if (d.baharu && sedia) return ralat('No. KP ini sudah didaftarkan (' + sedia.NamaPenuh + ').');
    const rumahId = rumah[d.rumahId] ? d.rumahId : '';
    // rumah yang diubah secara manual dikunci supaya agihan automatik tidak memindahkannya
    const rumahBerubah = rumahId !== String((sedia && sedia.RumahId) || '');
    const objek = Object.assign({}, sedia || { Password: '', MestiTukarPassword: 'YA' }, {
      NoKP: nokp, NamaPenuh: nama, Jantina: normalJantina(d.jantina, nokp),
      Tingkatan: teksBersih(d.tingkatan).toUpperCase(), Kelas: banding(d.kelas),
      Kaum: banding(d.kaum), Agama: banding(d.agama), TarikhLahir: teksBersih(d.tarikhLahir), NoTelPenjaga: teksBersih(d.noTelPenjaga),
      Atlet: d.atlet ? 'YA' : 'TIDAK', Acara: d.atlet ? banding(d.acara) : '',
      RumahId: rumahId, KunciRumah: rumahId && (d.kunciRumah || rumahBerubah) ? 'YA' : '',
      Status: banding(d.status) === 'TIDAK AKTIF' ? 'TIDAK AKTIF' : 'AKTIF', Dikemaskini: sekarangTeks()
    });
    if (sedia) kemaskiniBaris(SHEET_MURID, sedia.__row, objek); else tambahBaris(SHEET_MURID, objek);
    catatAudit(sesi, sedia ? 'KEMASKINI_MURID' : 'TAMBAH_MURID', 'MURID', nokp, nama + ' | ' + objek.Tingkatan + ' ' + objek.Kelas +
      ' | rumah ' + (rumah[rumahId] ? rumah[rumahId].nama : '-'));
    return jaya({});
  });
}

function apiPadamMurid(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const nokp = normalKP(p.nokp);
  return denganKunci(() => {
    const m = bacaSheetSebagaiObjek(SHEET_MURID).find(x => normalKP(x.NoKP) === nokp);
    if (!m) return ralat('Murid tidak dijumpai.');
    padamBaris(SHEET_MURID, m.__row, m.NoKP);
    catatAudit(sesi, 'PADAM_MURID', 'MURID', nokp, m.NamaPenuh);
    return jaya({});
  });
}

/* Import pukal murid. p.baris = [{nokp, nama, jantina, tingkatan, kelas, kaum, agama, tarikhLahir, noTelPenjaga, atlet, acara}]
   - Murid baharu: kata laluan lalai (6 digit akhir No. KP), wajib tukar semasa log masuk pertama.
   - Murid sedia ada: maklumat dikemaskini; kata laluan & rumah sukan TIDAK disentuh. Medan atlet hanya
     dikemaskini jika lajur ATLET wujud dalam fail (p.adaLajurAtlet).
   - p.nyahaktifLain: murid AKTIF yang tiada dalam fail ditanda TIDAK AKTIF (cth. murid berpindah). */
function apiImportMurid(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const baris = p.baris || [];
  if (!baris.length) return ralat('Tiada data untuk diimport.');
  if (baris.length > 5000) return ralat('Maksimum 5000 baris bagi setiap import.');

  return denganKunci(() => {
    const kpStaf = {};
    bacaSheetSebagaiObjek(SHEET_STAF).forEach(s => { kpStaf[normalKP(s.NoKP)] = true; });
    const semua = bacaSheetSebagaiObjek(SHEET_MURID);
    const sedia = {};
    semua.forEach(m => { sedia[normalKP(m.NoKP)] = m; });
    const ralatBaris = [], objek = [], dalamFail = {};
    const masa = sekarangTeks();
    baris.forEach((b, i) => {
      const nokp = normalKP(b.nokp);
      const nama = banding(b.nama);
      const no = 'Baris ' + (i + 2) + ': ';
      if (nokp.length !== 12) { ralatBaris.push(no + 'No. KP tidak sah (' + (b.nokp || '') + ')'); return; }
      if (!nama) { ralatBaris.push(no + 'nama kosong'); return; }
      if (!teksBersih(b.tingkatan) || !teksBersih(b.kelas)) { ralatBaris.push(no + nama + ' — tingkatan/kelas kosong'); return; }
      if (kpStaf[nokp]) { ralatBaris.push(no + nokp + ' sudah didaftarkan sebagai guru/staf'); return; }
      if (dalamFail[nokp]) { ralatBaris.push(no + nokp + ' berulang dalam fail (baris terakhir digunakan)'); }
      dalamFail[nokp] = true;
      const o = {
        NoKP: nokp, NamaPenuh: nama, Jantina: normalJantina(b.jantina, nokp),
        Tingkatan: teksBersih(b.tingkatan).toUpperCase().replace(/^(TINGKATAN|TING\.?|T)\s*/, ''), Kelas: banding(b.kelas),
        Kaum: banding(b.kaum), Agama: banding(b.agama), TarikhLahir: teksBersih(b.tarikhLahir), NoTelPenjaga: teksBersih(b.noTelPenjaga),
        Status: 'AKTIF', Dikemaskini: masa
      };
      if (p.adaLajurAtlet) {
        o.Atlet = /^(YA|Y|YES|1|TRUE|\/|✓|ATLET)$/i.test(teksBersih(b.atlet)) ? 'YA' : 'TIDAK';
        o.Acara = o.Atlet === 'YA' ? banding(b.acara) : '';
      }
      if (!sedia[nokp]) Object.assign(o, { Password: '', MestiTukarPassword: 'YA', RumahId: '', KunciRumah: '', Atlet: o.Atlet || 'TIDAK', Acara: o.Acara || '' });
      else ['Kaum', 'Agama', 'TarikhLahir', 'NoTelPenjaga'].forEach(k => { if (!o[k]) delete o[k]; });
      objek.push(o);
    });
    let dinyahaktif = 0;
    if (p.nyahaktifLain && objek.length) {
      semua.forEach(m => {
        const kp = normalKP(m.NoKP);
        if (kp && !dalamFail[kp] && aktif(m)) { objek.push({ NoKP: m.NoKP, Status: 'TIDAK AKTIF', Dikemaskini: masa }); dinyahaktif++; }
      });
    }
    const hasil = upsertBanyak(SHEET_MURID, 'NoKP', objek);
    catatAudit(sesi, 'IMPORT_MURID', 'MURID', '', (hasil.ditambah) + ' baharu, ' + (hasil.dikemaskini - dinyahaktif) + ' dikemaskini, ' +
      dinyahaktif + ' dinyahaktif, ' + ralatBaris.length + ' ralat');
    return jaya({ ditambah: hasil.ditambah, dikemaskini: hasil.dikemaskini - dinyahaktif, dinyahaktif, ralat: ralatBaris.slice(0, 150), bilRalat: ralatBaris.length });
  });
}

/* Simpan penandaan atlet secara pukal. p.perubahan = [{nokp, atlet: bool, acara}] */
function apiSimpanAtlet(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const perubahan = p.perubahan || [];
  if (!perubahan.length) return ralat('Tiada perubahan untuk disimpan.');
  return denganKunci(() => {
    const sedia = {};
    bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => { sedia[normalKP(m.NoKP)] = m; });
    const masa = sekarangTeks();
    const objek = perubahan.filter(u => sedia[normalKP(u.nokp)]).map(u => ({
      NoKP: sedia[normalKP(u.nokp)].NoKP, Atlet: u.atlet ? 'YA' : 'TIDAK', Acara: u.atlet ? banding(u.acara) : '', Dikemaskini: masa
    }));
    upsertBanyak(SHEET_MURID, 'NoKP', objek);
    const bilAtlet = objek.filter(o => o.Atlet === 'YA').length;
    catatAudit(sesi, 'TANDA_ATLET', 'MURID', '', objek.length + ' murid dikemaskini (' + bilAtlet + ' ditanda atlet)');
    return jaya({ bil: objek.length });
  });
}

/* Tetapkan / buang kunci rumah bagi ramai murid. p.nokp = [..], p.kunci = bool */
function apiKunciRumahMurid(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const set = {};
  (p.nokp || []).forEach(k => { set[normalKP(k)] = true; });
  return denganKunci(() => {
    const objek = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => set[normalKP(m.NoKP)])
      .map(m => ({ NoKP: m.NoKP, KunciRumah: p.kunci && m.RumahId ? 'YA' : '' }));
    upsertBanyak(SHEET_MURID, 'NoKP', objek);
    catatAudit(sesi, p.kunci ? 'KUNCI_RUMAH' : 'BUKA_KUNCI_RUMAH', 'MURID', '', objek.length + ' murid');
    return jaya({ bil: objek.length });
  });
}
