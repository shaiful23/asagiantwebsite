/* =========================================================================
 * SettingsService.gs — TETAPAN SISTEM (Admin) terus daripada UI.
 * Semua perkara yang dahulu perlu dibuat dalam Google Sheet kini boleh diurus
 * dari menu "Tetapan Sistem": konfigurasi (CONFIG), jadual gred (GRADES), band
 * MUET (MUET_BAND), semakan & kemaskini struktur Sheet (migrasi), dan log audit.
 * ========================================================================= */

/* Daftar SEMUA Sheet sistem: [nama, header, data contoh semasa dicipta]. */
function daftarStrukturSistem() {
  const tahun = String(new Date().getFullYear());
  return [
    [SHEET_CONFIG, ['Key', 'Value'], nilaiLalaiConfig()],
    [SHEET_GRADES, ['Gred', 'NilaiGred', 'Lulus'], nilaiLalaiGrades()],
    [SHEET_GRADE_BOUNDARIES, HEADER_GRADE_BOUNDARIES, nilaiLalaiBLD()],
    [SHEET_USERS, HEADER_USERS, [['000000000000', '', ROLE_ADMIN, 'ADMIN CONTOH', '', 'AKTIF', '', '']]],
    [SHEET_STUDENTS, HEADER_STUDENTS, [['P001', '070101130001', 'PELAJAR CONTOH', 'LELAKI', '6A AKASIA', tahun, 'AKTIF', '']]],
    [SHEET_SUBJECTS, HEADER_SUBJECTS, [['PA', 'PENGAJIAN AM', '', '', 'AKTIF']]],
    [SHEET_ENROLLMENTS, HEADER_ENROLLMENTS, [['P001', 'PA', tahun]]],
    [SHEET_HEADCOUNT_S1, HEADER_HEADCOUNT, []], [SHEET_HEADCOUNT_S2, HEADER_HEADCOUNT, []], [SHEET_HEADCOUNT_S3, HEADER_HEADCOUNT, []],
    [SHEET_REPEAT_S1, HEADER_REPEAT, []], [SHEET_REPEAT_S2, HEADER_REPEAT, []],
    [SHEET_INTERVENTIONS, HEADER_INTERVENTIONS, []],
    [SHEET_INTERVENTION_LOG, ['ID_Log', 'ID_Intervensi', 'Timestamp', 'Catatan_Perkembangan', 'Dicatat_Oleh'], []],
    [SHEET_AUDIT_LOG, HEADER_AUDIT_LOG, []],
    [SHEET_TEACHING_ASSIGNMENTS, HEADER_TEACHING_ASSIGNMENTS, []],
    [SHEET_UNLOCK_REQUESTS, HEADER_UNLOCK_REQUESTS, []],
    [SHEET_MUET, HEADER_MUET, []],
    [SHEET_MUET_BAND, HEADER_MUET_BAND, nilaiLalaiBandMUET()],
    [SHEET_MUET_GPS, HEADER_MUET_GPS, []]
  ];
}

// Sheet yang TIDAK ditambah lajur secara automatik (struktur lama dimigrasi oleh menu 2 khas).
const SHEET_TANPA_TAMBAH_LAJUR = [SHEET_HEADCOUNT_S1, SHEET_HEADCOUNT_S2, SHEET_HEADCOUNT_S3, SHEET_GRADE_BOUNDARIES];

/* Cipta Sheet yang belum wujud, tambah lajur baharu yang tiada (di hujung), dan
   petakan peranan lama. Selamat dijalankan berulang kali. Pulangkan senarai mesej.
   semakSahaja=true: hanya laporkan apa yang PERLU dibuat, tanpa mengubah apa-apa. */
function pastikanStrukturSistem(semakSahaja) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mesej = [];
  daftarStrukturSistem().forEach(([nama, header, contoh]) => {
    let sh = ss.getSheetByName(nama);
    if (!sh) {
      mesej.push('Sheet ' + nama + ' ' + (semakSahaja ? 'belum wujud' : 'dicipta'));
      if (semakSahaja) return;
      sh = ss.insertSheet(nama);
      sh.appendRow(header);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, header.length).setFontWeight('bold');
      if (contoh && contoh.length) sh.getRange(2, 1, contoh.length, header.length).setValues(contoh);
      buangCacheBaca(nama);
      return;
    }
    if (SHEET_TANPA_TAMBAH_LAJUR.indexOf(nama) !== -1) return;
    const sedia = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0] : [];
    const tiada = header.filter(h => sedia.indexOf(h) === -1);
    if (!tiada.length) return;
    mesej.push(nama + ': lajur ' + tiada.join(', ') + (semakSahaja ? ' belum ada' : ' ditambah'));
    if (semakSahaja) return;
    tiada.forEach((h, i) => sh.getRange(1, sedia.length + i + 1).setValue(h).setFontWeight('bold'));
    buangCacheBaca(nama);
  });

  // Peranan lama -> 4 peranan (kekalkan dwi-peranan); UnitKetua bagi Ketua Panitia lama.
  const shUsers = ss.getSheetByName(SHEET_USERS);
  if (shUsers && shUsers.getLastRow() > 1) {
    const header = shUsers.getRange(1, 1, 1, shUsers.getLastColumn()).getValues()[0];
    const iP = header.indexOf('Peranan'), iS = header.indexOf('SkopSubjek'), iU = header.indexOf('UnitKetua');
    const baris = shUsers.getRange(2, 1, shUsers.getLastRow() - 1, header.length).getValues();
    let bil = 0;
    baris.forEach(r => {
      const lama = String(r[iP] || '').trim().toUpperCase();
      if (!lama) return;
      const baru = senaraiPeranan(lama).join(',');
      const perluUnit = iU !== -1 && baru.split(',').indexOf(ROLE_KETUA_UNIT) !== -1 && !String(r[iU] || '').trim();
      if (baru !== lama.replace(/\s/g, '') || perluUnit) { bil++; r[iP] = baru; if (perluUnit) r[iU] = String(r[iS] || '').trim(); }
    });
    if (bil) {
      mesej.push(bil + ' pengguna ' + (semakSahaja ? 'masih guna peranan lama' : 'ditukar kepada 4 peranan baharu'));
      if (!semakSahaja) { shUsers.getRange(2, 1, baris.length, header.length).setValues(baris); buangCacheBaca(SHEET_USERS); }
    }
  }
  return mesej;
}

/* Persediaan automatik: jika Sheet asas belum wujud (sistem baharu), cipta struktur
   penuh secara automatik — Admin tidak perlu membuka Google Sheet langsung. */
function pastikanSistemSedia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_USERS) || !ss.getSheetByName(SHEET_CONFIG)) pastikanStrukturSistem(false);
}

/* Konfigurasi yang boleh diubah dari UI: [kunci, label, jenis, keterangan]. */
const MEDAN_KONFIG_SISTEM = [
  ['schoolName', 'Nama ringkas sekolah', 'teks', 'Dipaparkan pada sistem, cth. SMK ASAJAYA'],
  ['namaPenuhSekolah', 'Nama penuh sekolah (slip)', 'teks', 'Kosong = dijana daripada nama ringkas'],
  ['alamatSekolah', 'Alamat sekolah (slip)', 'teks', ''],
  ['namaPengetua', 'Nama Pengetua', 'teks', 'Untuk ruang tandatangan slip'],
  ['namaPKT6', 'Nama PK Tingkatan 6', 'teks', 'Untuk ruang tandatangan slip'],
  ['tahunSTPMAktif', 'Tahun STPM aktif (lalai)', 'tahun', 'Kohort yang dibuka secara lalai'],
  ['semesterAktif', 'Semester aktif', 'semester', 'S1 / S2 / S3'],
  ['sasaranGPS', 'Sasaran GPS sekolah', 'nilai', '0.00 – 4.00'],
  ['sasaranPNGK', 'Sasaran PNGK', 'nilai', '0.00 – 4.00'],
  ['thresholdGapKuning', 'Ambang gap KUNING', 'nilai', 'Gap ≤ nilai ini = KUNING; lebih = MERAH'],
  ['thresholdRisikoPemantauan', 'Ambang risiko: Perlu Pemantauan', 'nilai', 'Dalam nilai gred'],
  ['thresholdRisikoBerisiko', 'Ambang risiko: Berisiko', 'nilai', 'Dalam nilai gred']
];

function apiTetapanSistem(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const k = dapatkanKonfig();
  const kira = nama => { try { return bacaSheetSebagaiObjek(nama).length; } catch (e) { return 0; } };
  const pengguna = bacaSheetSebagaiObjek(SHEET_USERS);
  const pelajar = bacaSheetSebagaiObjek(SHEET_STUDENTS);
  return jaya({
    konfig: MEDAN_KONFIG_SISTEM.map(([kunci, label, jenis, ket]) => ({ kunci, label, jenis, ket, nilai: k[kunci] === undefined ? '' : String(k[kunci]) })),
    gred: bacaSheetSebagaiObjek(SHEET_GRADES).map(g => ({ Gred: String(g.Gred), NilaiGred: g.NilaiGred, Lulus: String(g.Lulus).toUpperCase() === 'YA' ? 'YA' : 'TIDAK' }))
      .sort((a, b) => Number(b.NilaiGred) - Number(a.NilaiGred)),
    bandMuet: dapatkanBandMUET().map(b => ({ Band: b.band, MarkahMin: b.min, MarkahMax: b.max, NilaiBand: b.nilai })),
    struktur: pastikanStrukturSistem(true),
    statistik: {
      pengguna: pengguna.filter(u => String(u.Status).toUpperCase() === 'AKTIF').length,
      pelajarAktif: pelajar.filter(s => String(s.Status).toUpperCase() === 'AKTIF').length,
      pelajarArkib: pelajar.filter(s => String(s.Status).toUpperCase() === 'TAMAT').length,
      subjek: kira(SHEET_SUBJECTS), pendaftaran: kira(SHEET_ENROLLMENTS),
      headcount: kira(SHEET_HEADCOUNT_S1) + kira(SHEET_HEADCOUNT_S2) + kira(SHEET_HEADCOUNT_S3),
      muet: kira(SHEET_MUET), audit: kira(SHEET_AUDIT_LOG)
    },
    urlSheet: SpreadsheetApp.getActiveSpreadsheet().getUrl()
  });
}

function apiSimpanKonfigSistem(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const nilai = p.nilai || {};
  const lama = dapatkanKonfig();
  const diubah = [];
  for (const [kunci, label, jenis] of MEDAN_KONFIG_SISTEM) {
    if (nilai[kunci] === undefined) continue;
    const v = String(nilai[kunci]).trim();
    if (jenis === 'nilai' && v !== '' && (isNaN(Number(v)) || Number(v) < 0 || Number(v) > 4)) return ralat(label + ' mesti nombor 0 – 4.');
    if (jenis === 'tahun' && v !== '' && !/^\d{4}$/.test(v)) return ralat(label + ' mesti 4 digit (cth. 2026).');
    if (jenis === 'semester' && v !== '' && SEMESTER_HEADCOUNT.indexOf(v) === -1) return ralat(label + ' mesti S1, S2 atau S3.');
    if (v.length > 200) return ralat(label + ' terlalu panjang.');
    if (String(lama[kunci] === undefined ? '' : lama[kunci]) !== v) { simpanNilaiKonfig(kunci, v); diubah.push(kunci + ': ' + v); }
  }
  if (diubah.length) catatAudit(sesi, 'KEMASKINI', 'CONFIG', 'TETAPAN_SISTEM', '', diubah.join('; '), 'Tetapan sistem dikemas kini');
  return jaya({ diubah: diubah.length });
}

/* Gantikan keseluruhan kandungan satu Sheet jadual (selain header). */
function gantiKandunganSheet(nama, header, baris) {
  const sh = dapatkanSheet(nama);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), header.length)).clearContent();
  if (baris.length) sh.getRange(2, 1, baris.length, header.length).setValues(baris);
}

function apiSimpanJadualGred(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const senarai = Array.isArray(p.senarai) ? p.senarai : [];
  if (!senarai.length) return ralat('Jadual gred tidak boleh kosong.');
  const dilihat = {};
  const baris = [];
  for (const g of senarai) {
    const gred = String(g.Gred || '').trim().toUpperCase();
    const nilai = Number(g.NilaiGred);
    if (!gred) return ralat('Setiap baris mesti ada Gred.');
    if (dilihat[gred]) return ralat('Gred "' + gred + '" berulang.');
    if (String(g.NilaiGred).trim() === '' || isNaN(nilai) || nilai < 0 || nilai > 4) return ralat('Nilai gred ' + gred + ' mesti 0.00 – 4.00.');
    dilihat[gred] = true;
    baris.push([gred, nilai.toFixed(2), String(g.Lulus).toUpperCase() === 'YA' ? 'YA' : 'TIDAK']);
  }
  baris.sort((a, b) => Number(b[1]) - Number(a[1]));
  // Gred yang dibuang tetapi masih dipakai dalam BLD akan menyebabkan ralat key-in markah.
  const dipakai = Array.from(new Set(bacaSheetSebagaiObjek(SHEET_GRADE_BOUNDARIES).map(b => String(b.Gred).toUpperCase()))).filter(x => !dilihat[x]);
  if (dipakai.length) return ralat('Gred ' + dipakai.join(', ') + ' masih digunakan dalam Skema Gred (BLD). Padam daripada BLD dahulu.');
  const lama = bacaSheetSebagaiObjek(SHEET_GRADES).map(g => g.Gred + '=' + g.NilaiGred).join(', ');
  gantiKandunganSheet(SHEET_GRADES, ['Gred', 'NilaiGred', 'Lulus'], baris);
  catatAudit(sesi, 'KEMASKINI', 'GRADES', 'JADUAL_GRED', lama, baris.map(b => b[0] + '=' + b[1]).join(', '), 'Jadual gred dikemas kini');
  return jaya({ bil: baris.length });
}

function apiSimpanBandMuet(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const senarai = Array.isArray(p.senarai) ? p.senarai : [];
  if (!senarai.length) return ralat('Jadual band tidak boleh kosong.');
  const baris = [];
  for (const b of senarai) {
    const band = normalBandMUET(b.Band);
    const min = Number(b.MarkahMin), max = Number(b.MarkahMax), nilai = Number(b.NilaiBand);
    if (!band) return ralat('Setiap baris mesti ada Band.');
    if ([min, max, nilai].some(isNaN) || min < 0 || max > 360 || min > max) return ralat('Julat markah Band ' + band + ' tidak sah (0 – 360, Min ≤ Max).');
    baris.push([band, min, max, nilai]);
  }
  baris.sort((a, b) => b[1] - a[1]);
  for (let i = 1; i < baris.length; i++) {
    if (baris[i][2] >= baris[i - 1][1]) return ralat('Julat Band ' + baris[i][0] + ' bertindih dengan Band ' + baris[i - 1][0] + '.');
  }
  gantiKandunganSheet(SHEET_MUET_BAND, HEADER_MUET_BAND, baris);
  catatAudit(sesi, 'KEMASKINI', 'MUET_BAND', 'JADUAL_BAND', '', baris.map(b => b[0] + ':' + b[1] + '-' + b[2]).join(', '), 'Jadual band MUET dikemas kini');
  return jaya({ bil: baris.length });
}

function apiSemakStruktur(p) {
  const sesi = wajibPeranan(p.token, PERANAN_AKSES_PENUH);
  if (sesi.success === false) return sesi;
  const mesej = pastikanStrukturSistem(false);
  if (mesej.length) catatAudit(sesi, 'KEMASKINI', 'STRUKTUR', 'SISTEM', '', mesej.join('; '), 'Semak & kemaskini struktur Sheet');
  return jaya({ mesej });
}
