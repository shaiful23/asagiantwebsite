/* =========================================================================
 * AjkService.gs — Jawatankuasa (AJK) Kejohanan Olahraga Tahunan.
 * Admin mencipta senarai AJK (cth. AJK Teknik, AJK Hadiah) dan melantik guru /
 * staf AKP sebagai KETUA_AJK atau AHLI_AJK bagi tahun kejohanan semasa.
 * Seorang staf boleh menganggotai lebih daripada satu AJK.
 * ========================================================================= */

function senaraiAjk() {
  return bacaSheetSebagaiObjek(SHEET_AJK).filter(a => a.AjkId)
    .map(a => ({ id: String(a.AjkId), nama: String(a.Nama || ''), tugas: String(a.Tugas || ''), susunan: nombor(a.Susunan, 99) }))
    .sort((a, b) => a.susunan - b.susunan || a.nama.localeCompare(b.nama));
}

/* { nokp: [{ajkId, ajk, peranan}] } bagi tahun tertentu. */
function ajkMengikutKP(tahun) {
  const ajk = {};
  senaraiAjk().forEach(a => { ajk[a.id] = a; });
  const hasil = {};
  bacaSheetSebagaiObjek(SHEET_AJK_AHLI).forEach(x => {
    if (String(x.Tahun) !== String(tahun) || !ajk[x.AjkId]) return;
    const kp = normalKP(x.NoKP);
    (hasil[kp] = hasil[kp] || []).push({ ajkId: x.AjkId, ajk: ajk[x.AjkId].nama, peranan: x.Peranan });
  });
  Object.keys(hasil).forEach(kp => hasil[kp].sort((a, b) => (a.peranan === PERANAN_AJK.KETUA ? 0 : 1) - (b.peranan === PERANAN_AJK.KETUA ? 0 : 1)));
  return hasil;
}

function apiSenaraiAjk(p) {
  const sesi = wajibStaf(p.token);
  if (sesi.success === false) return sesi;
  const tahun = Number(p.tahun) || tahunKejohanan();
  const staf = {};
  bacaSheetSebagaiObjek(SHEET_STAF).forEach(s => { staf[normalKP(s.NoKP)] = s; });
  const ahli = {};
  bacaSheetSebagaiObjek(SHEET_AJK_AHLI).forEach(x => {
    if (String(x.Tahun) !== String(tahun)) return;
    const s = staf[normalKP(x.NoKP)];
    (ahli[x.AjkId] = ahli[x.AjkId] || []).push({
      id: x.Id, nokp: normalKP(x.NoKP), nama: s ? s.NamaPenuh : '(tiada dalam senarai staf)',
      kategori: s ? s.Kategori : '', peranan: x.Peranan
    });
  });
  const senarai = senaraiAjk().map(a => Object.assign(a, {
    ahli: (ahli[a.id] || []).sort((x, y) => (x.peranan === PERANAN_AJK.KETUA ? 0 : 1) - (y.peranan === PERANAN_AJK.KETUA ? 0 : 1) || x.nama.localeCompare(y.nama))
  }));
  return jaya({ tahun, senarai });
}

/* Cipta/sunting satu AJK. p.data = {id?, nama, tugas} */
function apiSimpanAjk(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const d = p.data || {};
  const nama = banding(d.nama);
  if (!nama) return ralat('Nama AJK diperlukan.');
  return denganKunci(() => {
    const semua = senaraiAjk();
    if (semua.some(a => a.nama === nama && a.id !== d.id)) return ralat('AJK "' + nama + '" sudah wujud.');
    if (d.id) {
      const r = cariBarisMengikutId(SHEET_AJK, 'AjkId', d.id);
      if (!r) return ralat('AJK tidak dijumpai.');
      r.Nama = nama; r.Tugas = teksBersih(d.tugas);
      kemaskiniBaris(SHEET_AJK, r.__row, r);
    } else {
      tambahBaris(SHEET_AJK, { AjkId: janaId('AJK'), Nama: nama, Tugas: teksBersih(d.tugas), Susunan: semua.length + 1 });
    }
    catatAudit(sesi, d.id ? 'KEMASKINI_AJK' : 'TAMBAH_AJK', 'AJK', d.id || '', nama);
    return jaya({});
  });
}

function apiPadamAjk(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  return denganKunci(() => {
    const r = cariBarisMengikutId(SHEET_AJK, 'AjkId', p.id);
    if (!r) return ralat('AJK tidak dijumpai.');
    bacaSheetSebagaiObjek(SHEET_AJK_AHLI).filter(x => x.AjkId === p.id)
      .sort((a, b) => b.__row - a.__row).forEach(x => padamBaris(SHEET_AJK_AHLI, x.__row, x.Id));
    padamBaris(SHEET_AJK, r.__row, r.AjkId);
    catatAudit(sesi, 'PADAM_AJK', 'AJK', p.id, r.Nama);
    return jaya({});
  });
}

/* Ganti keseluruhan keahlian satu AJK bagi tahun semasa.
   p.ajkId, p.ketua = nokp|'' , p.ahli = [nokp] */
function apiSimpanAhliAjk(p) {
  const sesi = wajibAdmin(p.token);
  if (sesi.success === false) return sesi;
  const tahun = tahunKejohanan();
  return denganKunci(() => {
    const ajk = cariBarisMengikutId(SHEET_AJK, 'AjkId', p.ajkId);
    if (!ajk) return ralat('AJK tidak dijumpai.');
    const staf = {};
    bacaSheetSebagaiObjek(SHEET_STAF).filter(aktif).forEach(s => { staf[normalKP(s.NoKP)] = s; });
    const ketua = normalKP(p.ketua);
    if (ketua && !staf[ketua]) return ralat('Ketua AJK mesti staf aktif.');
    const ahli = [];
    (p.ahli || []).map(normalKP).forEach(kp => { if (kp && kp !== ketua && staf[kp] && ahli.indexOf(kp) === -1) ahli.push(kp); });

    bacaSheetSebagaiObjek(SHEET_AJK_AHLI).filter(x => x.AjkId === p.ajkId && String(x.Tahun) === String(tahun))
      .sort((a, b) => b.__row - a.__row).forEach(x => padamBaris(SHEET_AJK_AHLI, x.__row, x.Id));
    const baris = [];
    if (ketua) baris.push({ Id: janaId('AA'), AjkId: p.ajkId, NoKP: ketua, Peranan: PERANAN_AJK.KETUA, Tahun: tahun });
    ahli.forEach(kp => baris.push({ Id: janaId('AA'), AjkId: p.ajkId, NoKP: kp, Peranan: PERANAN_AJK.AHLI, Tahun: tahun }));
    if (baris.length) {
      const sh = dapatkanSheet(SHEET_AJK_AHLI);
      const header = headerSebenarSheet(sh);
      formatLajurTeks(sh, sh.getLastRow() + 1, baris.length);
      sh.getRange(sh.getLastRow() + 1, 1, baris.length, header.length).setValues(baris.map(b => objekKeBaris(b, header)));
      tandaKotor(SHEET_AJK_AHLI);
    }
    catatAudit(sesi, 'SIMPAN_AHLI_AJK', 'AJK', p.ajkId, ajk.Nama + ' ' + tahun + ': ketua ' + (ketua ? staf[ketua].NamaPenuh : '-') + ', ' + ahli.length + ' ahli');
    return jaya({});
  });
}
