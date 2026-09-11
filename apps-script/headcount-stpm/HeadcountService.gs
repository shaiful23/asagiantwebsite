/* =========================================================================
 * HeadcountService.gs — MODUL 5 (HEADCOUNT SEMESTER), MODUL 6 (UJIAN DALAMAN),
 * MODUL 14 (PROFIL AKADEMIK PELAJAR — bahagian headcount+trend+intervensi).
 * Setiap rekod = Pelajar x MataPelajaran x Semester, menyimpan TOV, OTR1,
 * AR1, OTR2, AR2, ETR, SEBENAR (bukan sekadar gred akhir — rujuk MODUL 5).
 * ========================================================================= */

/* Setiap medan (TOV/OTR1/AR1/OTR2/AR2/ETR/SEBENAR) simpan SEPASANG lajur: Markah
   (sumber, ditaip guru/admin) + Gred (terbitan, dikira backend daripada BLD subjek
   berkenaan — rujuk GradeBoundaryService.gs & AnalysisService.gs). */
const HEADER_HEADCOUNT = ['ID_Pelajar', 'KodSubjek', 'TahunSTPM',
  'TOV_Markah', 'TOV_Gred', 'OTR1_Markah', 'OTR1_Gred', 'AR1_Markah', 'AR1_Gred',
  'OTR2_Markah', 'OTR2_Gred', 'AR2_Markah', 'AR2_Gred', 'ETR_Markah', 'ETR_Gred',
  'SEBENAR_Markah', 'SEBENAR_Gred', 'Catatan', 'KemaskiniOleh', 'KemaskiniPada'];

function kunciRekod(idPelajar, kodSubjek, tahunSTPM) {
  return idPelajar + '|' + kodSubjek + '|' + tahunSTPM;
}

/* Pulangkan senarai rekod headcount (dengan analisis gap/trend/risiko terbenam)
   bagi satu semester, ditapis mengikut peranan/skop pengguna. */
function apiDapatkanHeadcount(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const namaSheet = sheetHeadcount(p.semester);
  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();
  const pelajarMap = {};
  bacaSheetSebagaiObjek(SHEET_STUDENTS).forEach(s => { pelajarMap[s.ID_Pelajar] = s; });

  let senarai = bacaSheetSebagaiObjek(namaSheet);

  if (p.idPelajar) senarai = senarai.filter(r => r.ID_Pelajar === p.idPelajar);
  if (p.kodSubjek) senarai = senarai.filter(r => String(r.KodSubjek) === String(p.kodSubjek));
  if (p.tahunSTPM) senarai = senarai.filter(r => String(r.TahunSTPM) === String(p.tahunSTPM));
  if (p.kelas) senarai = senarai.filter(r => pelajarMap[r.ID_Pelajar] && String(pelajarMap[r.ID_Pelajar].Kelas).toUpperCase() === String(p.kelas).toUpperCase());
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan)) {
    senarai = senarai.filter(r => sesi.skopSubjek.includes(String(r.KodSubjek)));
  }

  const hasil = senarai.map(r => {
    const analisis = analisisRekodHeadcount(mapGred, konfig, r);
    const pelajar = pelajarMap[r.ID_Pelajar] || {};
    return Object.assign({}, r, analisis, { namaPelajar: pelajar.Nama || '', kelas: pelajar.Kelas || '' });
  });

  return jaya({ senarai: hasil });
}

/* Roster PELAJAR bagi SATU (Subjek x Kelas x Tahun STPM), digabung dengan rekod
   headcount semester berkenaan (kosong jika belum ada) + analisis — sumber data
   sepunya untuk panel "Isi ETR" (Headcount) dan tab "Markah Ujian" (AR1/AR2/SEBENAR).
   Pelajar yang belum ada rekod headcount TETAP dipaparkan (medan kosong) supaya
   guru boleh mula isi terus. */
function apiRosterHeadcount(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const semester = String(p.semester || '').trim();
  const kodSubjek = String(p.kodSubjek || '').trim();
  const kelas = String(p.kelas || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  if (!semester || !kodSubjek || !kelas || !tahunSTPM) return ralat('Semester, Kod Subjek, Kelas dan Tahun STPM wajib diisi.');
  if (SEMESTER_HEADCOUNT.indexOf(semester) === -1) return ralat('Semester tidak sah.');
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) && sesi.skopSubjek.indexOf(kodSubjek) === -1) {
    return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');
  }

  const idBerdaftar = new Set(bacaSheetSebagaiObjek(SHEET_ENROLLMENTS)
    .filter(e => String(e.KodSubjek) === kodSubjek && String(e.TahunSTPM) === tahunSTPM).map(e => e.ID_Pelajar));
  const pelajarLayak = bacaSheetSebagaiObjek(SHEET_STUDENTS).filter(s =>
    idBerdaftar.has(s.ID_Pelajar) && String(s.Status).toUpperCase() === 'AKTIF' &&
    String(s.Kelas).toUpperCase() === kelas.toUpperCase() && String(s.TahunSTPM) === tahunSTPM);

  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();
  const headcountSediaAda = {};
  bacaSheetSebagaiObjek(sheetHeadcount(semester))
    .filter(r => String(r.KodSubjek) === kodSubjek && String(r.TahunSTPM) === tahunSTPM)
    .forEach(r => { headcountSediaAda[r.ID_Pelajar] = r; });

  const medanKosong = {};
  MEDAN_HEADCOUNT.forEach(m => { medanKosong[m + '_Markah'] = ''; medanKosong[m + '_Gred'] = ''; });

  const senarai = pelajarLayak
    .sort((a, b) => String(a.Nama).localeCompare(String(b.Nama)))
    .map(s => {
      const rekod = headcountSediaAda[s.ID_Pelajar] ||
        Object.assign({ ID_Pelajar: s.ID_Pelajar, KodSubjek: kodSubjek, TahunSTPM: tahunSTPM }, medanKosong);
      const analisis = analisisRekodHeadcount(mapGred, konfig, rekod);
      return Object.assign({}, rekod, analisis, { namaPelajar: s.Nama, kelas: s.Kelas });
    });

  return jaya({ senarai });
}

/* Isi ETR (markah) bagi SATU pelajar/subjek/semester. TOV, OTR1 dan OTR2
   DITERBITKAN SECARA AUTOMATIK daripada ETR (bukan rolling antara semester —
   setiap semester berdiri sendiri, rujuk permintaan):
     TOV  = OTR1 = 2 gred bawah ETR (sasaran awal semester)
     OTR2 = 1 gred bawah ETR (sasaran hampir akhir semester, sebelum ETR)
   Markah bagi TOV/OTR1/OTR2 diambil daripada Markah Minimum gred berkenaan
   dalam BLD subjek+semester itu (anggaran, sebab bukan keputusan ujian sebenar). */
function apiSimpanETR(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const idPelajar = String(p.idPelajar || '').trim();
  const kodSubjek = String(p.kodSubjek || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const semester = String(p.semester || '').trim();
  const markahETRMentah = p.markahETR === undefined || p.markahETR === null ? '' : String(p.markahETR).trim();

  if (!idPelajar || !kodSubjek || !tahunSTPM || !semester) return ralat('Data tidak lengkap.');
  if (SEMESTER_HEADCOUNT.indexOf(semester) === -1) return ralat('Semester tidak sah.');
  if (!PERANAN_AKSES_PENUH.includes(sesi.peranan) && sesi.skopSubjek.indexOf(kodSubjek) === -1) {
    return ralat('Anda tiada kebenaran untuk mata pelajaran ini.');
  }
  if (!cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', idPelajar)) return ralat('Pelajar tidak dijumpai.');
  const enrol = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS).find(e => e.ID_Pelajar === idPelajar && String(e.KodSubjek) === kodSubjek);
  if (!enrol) return ralat('Pelajar tidak berdaftar untuk mata pelajaran ini (MODUL 26: validasi).');

  let markahETR = '', gredETR = '', markahTOV = '', gredTOV = '', markahOTR1 = '', gredOTR1 = '', markahOTR2 = '', gredOTR2 = '';

  if (markahETRMentah !== '') {
    const nombor = Number(markahETRMentah);
    if (isNaN(nombor) || nombor < 0 || nombor > 100) return ralat('Markah ETR mesti nombor antara 0-100.');
    markahETR = nombor;

    const mapGred = dapatkanGred();
    const bldMap = dapatkanBLD();
    gredETR = gredDaripadaMarkah(bldMap, kodSubjek, semester, markahETR);
    if (!gredETR) {
      return ralat('BLD (skema markah→gred) belum lengkap untuk subjek "' + kodSubjek + '" pada ' + semester + ', atau markah ' +
        markahETR + ' tiada dalam mana-mana julat gred yang ditetapkan. Sila lengkapkan di menu "Skema Gred (BLD)" dahulu.');
    }

    gredTOV = gredTurun(mapGred, gredETR, 2);
    gredOTR1 = gredTurun(mapGred, gredETR, 2);
    gredOTR2 = gredTurun(mapGred, gredETR, 1);

    const senaraiBLDSubjekSemester = bldMap[kunciBLD(kodSubjek, semester)] || [];
    const markahMinBagiGred = gred => {
      const e = senaraiBLDSubjekSemester.find(b => b.gred === gred);
      return e ? e.min : '';
    };
    markahTOV = markahMinBagiGred(gredTOV);
    markahOTR1 = markahMinBagiGred(gredOTR1);
    markahOTR2 = markahMinBagiGred(gredOTR2);
  }

  const namaSheet = sheetHeadcount(semester);
  const semua = bacaSheetSebagaiObjek(namaSheet);
  const sediaAda = semua.find(r => r.ID_Pelajar === idPelajar && String(r.KodSubjek) === kodSubjek && String(r.TahunSTPM) === tahunSTPM);

  const objek = sediaAda ? Object.assign({}, sediaAda) : { ID_Pelajar: idPelajar, KodSubjek: kodSubjek, TahunSTPM: tahunSTPM, Catatan: '' };
  MEDAN_HEADCOUNT.forEach(m => {
    if (objek[m + '_Markah'] === undefined) objek[m + '_Markah'] = '';
    if (objek[m + '_Gred'] === undefined) objek[m + '_Gred'] = '';
  });
  objek.ETR_Markah = markahETR; objek.ETR_Gred = gredETR;
  objek.TOV_Markah = markahTOV; objek.TOV_Gred = gredTOV;
  objek.OTR1_Markah = markahOTR1; objek.OTR1_Gred = gredOTR1;
  objek.OTR2_Markah = markahOTR2; objek.OTR2_Gred = gredOTR2;
  objek.KemaskiniOleh = sesi.nama;
  objek.KemaskiniPada = formatTarikhMasa(new Date());

  if (sediaAda) {
    kemaskiniBaris(namaSheet, sediaAda.__row, objek, HEADER_HEADCOUNT);
  } else {
    tambahBaris(namaSheet, objek, HEADER_HEADCOUNT);
  }

  catatAudit(sesi, sediaAda ? 'KEMASKINI' : 'TAMBAH', 'ETR_' + semester, kunciRekod(idPelajar, kodSubjek, tahunSTPM),
    '', 'ETR=' + markahETR + '(' + gredETR + ') -> auto TOV=' + gredTOV + ' OTR1=' + gredOTR1 + ' OTR2=' + gredOTR2,
    p.sebab || 'Isi ETR (TOV/OTR1/OTR2 dikira automatik)');

  return jaya({ gredETR, gredTOV, gredOTR1, gredOTR2 });
}

/* Simpan/kemaskini satu medan headcount (TOV/OTR1/AR1/OTR2/AR2/ETR/SEBENAR).
   Pengguna taip MARKAH (0-100); Gred DITERBITKAN secara automatik daripada BLD
   khusus subjek berkenaan (GradeBoundaryService.gs) — tiada Gred ditaip terus.
   Guru hanya dibenarkan kemaskini AR1/AR2 (MODUL 16); peranan pengurusan boleh semua medan. */
function apiSimpanHeadcount(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const idPelajar = String(p.idPelajar || '').trim();
  const kodSubjek = String(p.kodSubjek || '').trim();
  const tahunSTPM = String(p.tahunSTPM || '').trim();
  const medan = String(p.medan || '').trim(); // TOV|OTR1|AR1|OTR2|AR2|ETR|SEBENAR
  const markahMentah = p.markah === undefined || p.markah === null ? '' : String(p.markah).trim();

  if (!idPelajar || !kodSubjek || !tahunSTPM || !medan) return ralat('Data tidak lengkap.');
  if (MEDAN_HEADCOUNT.indexOf(medan) === -1) return ralat('Medan tidak sah: ' + medan);
  if (medan === 'ETR') return ralat('Sila guna fungsi "Isi ETR" (Headcount) supaya TOV & OTR turut dikira automatik.');
  if (sesi.peranan === ROLE_GURU && MEDAN_BOLEH_GURU.indexOf(medan) === -1) {
    return ralat('Guru hanya dibenarkan memasukkan AR1, AR2 dan SEBENAR (di tab Markah Ujian).');
  }
  if (!cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', idPelajar)) return ralat('Pelajar tidak dijumpai.');

  const enrol = bacaSheetSebagaiObjek(SHEET_ENROLLMENTS).find(e => e.ID_Pelajar === idPelajar && String(e.KodSubjek) === kodSubjek);
  if (!enrol) return ralat('Pelajar tidak berdaftar untuk mata pelajaran ini (MODUL 26: validasi).');

  let markahBaru = '';
  let gredBaru = '';
  if (markahMentah !== '') {
    const nombor = Number(markahMentah);
    if (isNaN(nombor) || nombor < 0 || nombor > 100) return ralat('Markah mesti nombor antara 0-100.');
    markahBaru = nombor;

    const bldMap = dapatkanBLD();
    gredBaru = gredDaripadaMarkah(bldMap, kodSubjek, p.semester, markahBaru);
    if (!gredBaru) {
      return ralat('BLD (skema markah→gred) belum lengkap untuk subjek "' + kodSubjek + '" pada ' + p.semester + ', atau markah ' +
        markahBaru + ' tiada dalam mana-mana julat gred yang ditetapkan. Sila lengkapkan di menu "Skema Gred (BLD)" dahulu.');
    }
  }

  const namaSheet = sheetHeadcount(p.semester);
  const semua = bacaSheetSebagaiObjek(namaSheet);
  const sediaAda = semua.find(r => r.ID_Pelajar === idPelajar && String(r.KodSubjek) === kodSubjek && String(r.TahunSTPM) === tahunSTPM);

  const markahLama = sediaAda ? sediaAda[medan + '_Markah'] : '';
  const gredLama = sediaAda ? sediaAda[medan + '_Gred'] : '';

  const objek = sediaAda ? Object.assign({}, sediaAda) : { ID_Pelajar: idPelajar, KodSubjek: kodSubjek, TahunSTPM: tahunSTPM, Catatan: '' };
  MEDAN_HEADCOUNT.forEach(m => {
    if (objek[m + '_Markah'] === undefined) objek[m + '_Markah'] = '';
    if (objek[m + '_Gred'] === undefined) objek[m + '_Gred'] = '';
  });
  objek[medan + '_Markah'] = markahBaru;
  objek[medan + '_Gred'] = gredBaru;
  objek.KemaskiniOleh = sesi.nama;
  objek.KemaskiniPada = formatTarikhMasa(new Date());
  if (p.catatan !== undefined) objek.Catatan = String(p.catatan).trim();

  if (sediaAda) {
    kemaskiniBaris(namaSheet, sediaAda.__row, objek, HEADER_HEADCOUNT);
  } else {
    tambahBaris(namaSheet, objek, HEADER_HEADCOUNT);
  }

  // MODUL 3: setiap perubahan TOV mesti direkod (tarikh, pengguna, nilai lama/baharu, sebab).
  catatAudit(sesi, sediaAda ? 'KEMASKINI' : 'TAMBAH', 'HEADCOUNT_' + p.semester,
    kunciRekod(idPelajar, kodSubjek, tahunSTPM),
    medan + '=' + markahLama + ' (' + gredLama + ')', medan + '=' + markahBaru + ' (' + gredBaru + ')',
    p.sebab || ('Kemaskini ' + medan));

  return jaya({ gred: gredBaru });
}

/* MODUL 14 — Profil akademik lengkap seorang pelajar: headcount semua semester,
   ulangan, trend, PNGK, GPS dan intervensi. */
function apiProfilPelajar(p) {
  const sesi = wajibPeranan(p.token, null);
  if (sesi.success === false) return sesi;

  const pelajar = cariBarisMengikutId(SHEET_STUDENTS, 'ID_Pelajar', p.idPelajar);
  if (!pelajar) return ralat('Pelajar tidak dijumpai.');

  const mapGred = dapatkanGred();
  const konfig = dapatkanKonfig();

  const semuaSemester = {};
  ['S1', 'S2', 'S3'].forEach(sem => {
    const rekod = bacaSheetSebagaiObjek(sheetHeadcount(sem)).filter(r => r.ID_Pelajar === p.idPelajar);
    semuaSemester[sem] = rekod.map(r => Object.assign({}, r, analisisRekodHeadcount(mapGred, konfig, r)));
  });

  const ulangan = {
    S1: bacaSheetSebagaiObjek(SHEET_REPEAT_S1).filter(r => r.ID_Pelajar === p.idPelajar),
    S2: bacaSheetSebagaiObjek(SHEET_REPEAT_S2).filter(r => r.ID_Pelajar === p.idPelajar)
  };

  const intervensi = bacaSheetSebagaiObjek(SHEET_INTERVENTIONS).filter(i => i.ID_Pelajar === p.idPelajar);

  const gredSebenarSemua = ['S1', 'S2', 'S3'].reduce((acc, sem) => acc.concat(semuaSemester[sem].map(r => r.SEBENAR_Gred).filter(Boolean)), []);
  const pngk = kiraPNGK(mapGred, gredSebenarSemua);

  return jaya({ pelajar, headcount: semuaSemester, ulangan, intervensi, pngk });
}
