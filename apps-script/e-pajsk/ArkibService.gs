/* =========================================================================
 * ArkibService.gs — Arkib tahunan & Naik Tingkatan (ADMIN sahaja).
 *
 * Aliran akhir tahun (mesti ikut turutan):
 *   1. ARKIB TAHUN   — kira semula semua markah, simpan salinan penuh tahun
 *                      semasa (MURID, pentaksiran, rumusan, jadual skor) ke satu
 *                      Google Sheet baharu dalam Drive, dan catat dalam ARKIB_TAHUNAN.
 *   2. NAIK TINGKATAN — (hanya selepas arkib tahun itu wujud)
 *        - Markah akhir (CGPA) tahun ini menjadi "CGPA Tahun Sebelum" tahun hadapan
 *          dan ditambah pada sejarah CGPA murid;
 *        - Tingkatan 1-4 dinaikkan satu tingkatan (kelas ditanda PerluSemak sehingga
 *          e-Kokurikulum yang telah dinaikkan disegerakkan semula);
 *        - Tingkatan 5 ditanda TAMAT (data kekal dalam arkib);
 *        - Data pentaksiran tahun lepas dikosongkan; tahun pentaksiran dinaikkan;
 *        - (pilihan) penetapan kelas guru kelas dikosongkan.
 * ========================================================================= */

const HEADER_ARKIB = ['ID', 'TAHUN', 'TARIKH_ARKIB', 'OLEH_KP', 'OLEH_NAMA', 'ID_FAIL', 'URL_ARKIB',
  'JUMLAH_MURID', 'JUMLAH_REKOD_ASPEK', 'JUMLAH_RUMUSAN', 'NAIK_TINGKATAN', 'TARIKH_NAIK'];

function rekodArkibTahun(tahun) {
  return bacaSheetSebagaiObjek(SHEET_ARKIB).filter(a => Number(a.TAHUN) === Number(tahun)).pop() || null;
}

function apiStatusArkib(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const tahun = tahunSemasa();
  const murid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => String(m.Status).toUpperCase() === 'AKTIF');
  const bilTingkatan = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  murid.forEach(m => { const t = nomborTingkatan(m.Tingkatan); if (bilTingkatan[t] !== undefined) bilTingkatan[t]++; });
  const rumusan = {};
  bacaSheetSebagaiObjek(SHEET_RUMUSAN).forEach(r => { rumusan[normalKP(r.NoKP)] = r; });
  const tanpaMarkah = murid.filter(m => !rumusan[normalKP(m.NoKP)] || nombor(rumusan[normalKP(m.NoKP)].CGPA) <= 0).length;
  const arkib = bacaSheetSebagaiObjek(SHEET_ARKIB).sort((a, b) => Number(b.TAHUN) - Number(a.TAHUN)).map(a => ({
    id: a.ID, tahun: a.TAHUN, tarikh: a.TARIKH_ARKIB, oleh: a.OLEH_NAMA, idFail: a.ID_FAIL, url: a.URL_ARKIB,
    bilMurid: a.JUMLAH_MURID, bilAspek: a.JUMLAH_REKOD_ASPEK, bilRumusan: a.JUMLAH_RUMUSAN,
    naik: a.NAIK_TINGKATAN, tarikhNaik: a.TARIKH_NAIK
  }));
  const semasa = rekodArkibTahun(tahun);
  return jaya({
    tahun, bilMurid: murid.length, bilTingkatan, tanpaMarkah,
    arkibSemasa: semasa ? { tarikh: semasa.TARIKH_ARKIB, url: semasa.URL_ARKIB, naik: semasa.NAIK_TINGKATAN } : null,
    arkib
  });
}

function dapatkanFolderArkib() {
  const id = dapatTetapan(TET_ID_FOLDER_ARKIB);
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* dipadam? cipta semula */ } }
  const folder = DriveApp.createFolder(NAMA_FOLDER_ARKIB);
  tulisTetapan(TET_ID_FOLDER_ARKIB, folder.getId());
  return folder;
}

/* Langkah 1. */
function apiArkibTahun(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  if (String(p.pengesahan || '').trim().toUpperCase() !== 'ARKIB') return ralat('Taip ARKIB untuk mengesahkan.');
  const tahun = tahunSemasa();

  return denganKunci(() => {
    const sedia = rekodArkibTahun(tahun);
    if (sedia && sedia.NAIK_TINGKATAN === 'YA') return ralat('Tahun ' + tahun + ' sudah diarkib dan murid sudah dinaikkan tingkatan.');
    if (sedia && !p.ganti) return ralat('Arkib tahun ' + tahun + ' sudah wujud. Tandakan "Ganti arkib" jika mahu mencipta arkib baharu (fail lama kekal dalam Drive).');

    kiraSemulaSemua(null);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fail = SpreadsheetApp.create('ARKIB e-PAJSK SMK Asajaya ' + tahun + ' (' + formatTarikh(new Date()) + ')');
    const salin = (nama) => {
      const sh = ss.getSheetByName(nama);
      sh.copyTo(fail).setName(nama);
    };
    [SHEET_MURID, SHEET_ASPEK, SHEET_EKSTRA, SHEET_RUMUSAN, SHEET_REFERENSI].forEach(salin);
    const ringkasan = fail.insertSheet('MAKLUMAT_ARKIB', 0);
    ringkasan.getRange(1, 1, 5, 2).setValues([
      ['Sistem', 'e-PAJSK SMK Asajaya'],
      ['Tahun pentaksiran', tahun],
      ['Diarkibkan pada', sekarangTeks()],
      ['Diarkibkan oleh', sesi.nama + ' (' + sesi.nokp + ')'],
      ['Nota', 'Salinan data tahun ini sebelum Naik Tingkatan. Jangan sunting; rujukan sahaja.']
    ]);
    ringkasan.autoResizeColumns(1, 2);
    const asal = fail.getSheetByName('Sheet1') || fail.getSheetByName('Sheet 1');
    if (asal) fail.deleteSheet(asal);

    try { DriveApp.getFileById(fail.getId()).moveTo(dapatkanFolderArkib()); } catch (e) { /* kekal di akar Drive jika gagal */ }

    const jumlahMurid = bacaSheetSebagaiObjek(SHEET_MURID).filter(m => String(m.Status).toUpperCase() === 'AKTIF').length;
    const objek = {
      ID: janaId('ARK'), TAHUN: tahun, TARIKH_ARKIB: sekarangTeks(), OLEH_KP: sesi.nokp, OLEH_NAMA: sesi.nama,
      ID_FAIL: fail.getId(), URL_ARKIB: fail.getUrl(), JUMLAH_MURID: jumlahMurid,
      JUMLAH_REKOD_ASPEK: bacaSheetSebagaiObjek(SHEET_ASPEK).length, JUMLAH_RUMUSAN: bacaSheetSebagaiObjek(SHEET_RUMUSAN).length,
      NAIK_TINGKATAN: 'TIDAK', TARIKH_NAIK: ''
    };
    if (sedia) kemaskiniBaris(SHEET_ARKIB, sedia.__row, objek); else tambahBaris(SHEET_ARKIB, objek);
    catatAudit(sesi, 'ARKIB', 'ARKIB', objek.ID, 'Arkib tahun ' + tahun + ' (' + jumlahMurid + ' murid)');
    return jaya({ url: fail.getUrl(), tahun });
  });
}

/* Langkah 2. */
function apiNaikTingkatan(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  if (String(p.pengesahan || '').trim().toUpperCase() !== 'NAIK TINGKATAN') return ralat('Taip NAIK TINGKATAN untuk mengesahkan.');
  const tahun = tahunSemasa();
  const tahunBaharu = Number(p.tahunBaharu) || tahun + 1;
  if (tahunBaharu <= tahun) return ralat('Tahun pentaksiran baharu mesti lebih besar daripada ' + tahun + '.');

  return denganKunci(() => {
    const arkib = rekodArkibTahun(tahun);
    if (!arkib) return ralat('Sila ARKIB tahun ' + tahun + ' dahulu sebelum Naik Tingkatan.');
    if (arkib.NAIK_TINGKATAN === 'YA') return ralat('Naik tingkatan bagi tahun ' + tahun + ' sudah dilaksanakan.');

    const rumusan = {};
    bacaSheetSebagaiObjek(SHEET_RUMUSAN).forEach(r => { rumusan[normalKP(r.NoKP)] = r; });

    let naik = 0, tamat = 0;
    const ubah = [];
    bacaSheetSebagaiObjek(SHEET_MURID).forEach(m => {
      if (String(m.Status).toUpperCase() !== 'AKTIF') return;
      const ting = nomborTingkatan(m.Tingkatan);
      const r = rumusan[normalKP(m.NoKP)];
      const cgpa = r ? nombor(r.CGPA) : 0;
      const o = Object.assign({}, m);
      o.NoKP = normalKP(m.NoKP);
      if (cgpa > 0) {
        o.CGPA_Sebelum = cgpa;
        o.SejarahCGPA = (String(m.SejarahCGPA || '').trim() + '   TINGKATAN ' + ting + ' (' + tahun + '): ' + cgpa + '%').trim();
      }
      if (ting >= 5) {
        o.Status = 'TAMAT';
        o.TahunTamat = tahun;
        tamat++;
      } else {
        o.Tingkatan = ting + 1;
        o.KunciKelas = (ting + 1) + ' ' + banding(m.Kelas);
        o.PerluSemak = 'YA';
        naik++;
      }
      ubah.push(o);
    });
    upsertBanyak(SHEET_MURID, 'NoKP', ubah);

    kosongkanDataSheet(SHEET_ASPEK);
    kosongkanDataSheet(SHEET_EKSTRA);
    kosongkanDataSheet(SHEET_RUMUSAN);

    let guruDikosongkan = 0;
    if (p.kosongkanGuruKelas !== false && p.kosongkanGuruKelas !== 'false') {
      const guru = bacaSheetSebagaiObjek(SHEET_PENGGUNA).filter(u => u.Peranan === ROLE_GURU_KELAS && u.KelasDijaga);
      guru.forEach(u => { u.KelasDijaga = ''; });
      upsertBanyak(SHEET_PENGGUNA, 'NoKP', guru.map(u => Object.assign({}, u, { NoKP: normalKP(u.NoKP) })));
      guruDikosongkan = guru.length;
    }

    tulisTetapan(TET_TAHUN, String(tahunBaharu));
    arkib.NAIK_TINGKATAN = 'YA';
    arkib.TARIKH_NAIK = sekarangTeks();
    kemaskiniBaris(SHEET_ARKIB, arkib.__row, arkib);
    catatAudit(sesi, 'NAIK_TINGKATAN', 'ARKIB', arkib.ID, tahun + ' -> ' + tahunBaharu + ': naik ' + naik + ', tamat ' + tamat + ', guru kelas dikosongkan ' + guruDikosongkan);
    return jaya({ naik, tamat, guruDikosongkan, tahunBaharu });
  });
}

/* Semak arkib dalam aplikasi (Admin): rumusan setiap murid bagi satu tahun arkib. */
function apiLihatArkib(p) {
  const sesi = wajibPeranan(p.token, [ROLE_ADMIN]);
  if (sesi.success === false) return sesi;
  const a = bacaSheetSebagaiObjek(SHEET_ARKIB).find(x => x.ID === p.id);
  if (!a) return ralat('Arkib tidak dijumpai.');
  let ss;
  try { ss = SpreadsheetApp.openById(a.ID_FAIL); } catch (e) { return ralat('Fail arkib tidak dapat dibuka (mungkin dipadam atau akses dibatalkan).'); }
  const sh = ss.getSheetByName(SHEET_RUMUSAN);
  if (!sh || sh.getLastRow() < 2) return jaya({ tahun: a.TAHUN, kelas: [], senarai: [] });
  const nilai = sh.getDataRange().getValues();
  const h = nilai.shift();
  let senarai = nilai.map(b => { const o = {}; h.forEach((k, i) => { o[k] = nilaiSelSebagaiTeks(b[i]); }); return o; });
  const kelas = Array.from(new Set(senarai.map(r => r.KunciKelas))).sort();
  if (p.kelas) senarai = senarai.filter(r => r.KunciKelas === p.kelas);
  senarai = senarai.sort((x, y) => String(x.KunciKelas).localeCompare(String(y.KunciKelas)) || String(x.Nama).localeCompare(String(y.Nama)))
    .map(r => ({ nokp: normalKP(r.NoKP), nama: r.Nama, kunciKelas: r.KunciKelas, pbb: r.PBB, sp: r.SP, kp: r.KP, ekstra: r.Ekstra,
      gpa: r.GPA, cgpa: r.CGPA, gred: r.Gred, label: r.Label }));
  return jaya({ tahun: a.TAHUN, url: a.URL_ARKIB, kelas, senarai });
}
