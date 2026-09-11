/* =========================================================================
 * SISTEM HEADCOUNT STPM SMK ASAJAYA — Config.gs
 * Semua nama Sheet, peranan, status dan nilai lalai konfigurasi.
 * JANGAN hard-code nilai gred/threshold di service lain — rujuk CONFIG/GRADES.
 * ========================================================================= */

/* ------------------------- NAMA SHEET ------------------------- */
const SHEET_CONFIG = 'CONFIG';
const SHEET_GRADES = 'GRADES';
const SHEET_USERS = 'USERS';
const SHEET_STUDENTS = 'STUDENTS';
const SHEET_SUBJECTS = 'SUBJECTS';
const SHEET_ENROLLMENTS = 'ENROLLMENTS';
const SHEET_HEADCOUNT_S1 = 'HEADCOUNT_S1';
const SHEET_HEADCOUNT_S2 = 'HEADCOUNT_S2';
const SHEET_HEADCOUNT_S3 = 'HEADCOUNT_S3';
const SHEET_REPEAT_S1 = 'REPEAT_S1';
const SHEET_REPEAT_S2 = 'REPEAT_S2';
const SHEET_INTERVENTIONS = 'INTERVENTIONS';
const SHEET_INTERVENTION_LOG = 'INTERVENTION_LOG';
const SHEET_AUDIT_LOG = 'AUDIT_LOG';
const SHEET_GRADE_BOUNDARIES = 'GRADE_BOUNDARIES';

/* Medan headcount (MODUL 5) — setiap satu kini menyimpan Markah + Gred terbitan (BLD). */
const MEDAN_HEADCOUNT = ['TOV', 'OTR1', 'AR1', 'OTR2', 'AR2', 'ETR', 'SEBENAR'];
const MEDAN_BOLEH_GURU = ['AR1', 'AR2', 'SEBENAR'];
const SEMESTER_HEADCOUNT = ['S1', 'S2', 'S3'];

function sheetHeadcount(semester) {
  if (semester === 'S1') return SHEET_HEADCOUNT_S1;
  if (semester === 'S2') return SHEET_HEADCOUNT_S2;
  if (semester === 'S3') return SHEET_HEADCOUNT_S3;
  throw new Error('Semester tidak sah: ' + semester);
}

function sheetRepeat(semester) {
  if (semester === 'S1') return SHEET_REPEAT_S1;
  if (semester === 'S2') return SHEET_REPEAT_S2;
  throw new Error('Semester ulangan tidak sah (hanya S1/S2): ' + semester);
}

/* ------------------------- PERANAN (ROLES) ------------------------- */
const ROLE_ADMIN = 'ADMIN';
const ROLE_GPK_T6 = 'GPK_TINGKATAN6';
const ROLE_KETUA_AKADEMIK = 'KETUA_AKADEMIK';
const ROLE_KETUA_PANITIA = 'KETUA_PANITIA';
const ROLE_GURU = 'GURU';

const SEMUA_PERANAN = [ROLE_ADMIN, ROLE_GPK_T6, ROLE_KETUA_AKADEMIK, ROLE_KETUA_PANITIA, ROLE_GURU];

// Peranan yang boleh melihat/menguruskan SEMUA pelajar (bukan hanya subjek sendiri)
const PERANAN_AKSES_PENUH = [ROLE_ADMIN, ROLE_GPK_T6, ROLE_KETUA_AKADEMIK];

/* ------------------------- STATUS GAP & RISIKO ------------------------- */
const STATUS_HIJAU = 'HIJAU';
const STATUS_KUNING = 'KUNING';
const STATUS_MERAH = 'MERAH';

const RISIKO_SELAMAT = 'SELAMAT';
const RISIKO_PEMANTAUAN = 'PERLU_PEMANTAUAN';
const RISIKO_BERISIKO = 'BERISIKO';

const TREND_MENINGKAT = 'MENINGKAT';
const TREND_MENURUN = 'MENURUN';
const TREND_KONSISTEN = 'KONSISTEN';
const TREND_TIDAK_STABIL = 'TIDAK_STABIL';
const TREND_TIDAK_CUKUP_DATA = 'TIDAK_CUKUP_DATA';

/* ------------------------- SESI ------------------------- */
const TEMPOH_SESI_SAAT = 8 * 60 * 60; // 8 jam

/* ------------------------- NILAI LALAI (digunakan semasa Sediakan Sistem) ------------------------- */
function nilaiLalaiConfig() {
  return [
    ['schoolName', 'SMK ASAJAYA'],
    ['tahunSTPMAktif', String(new Date().getFullYear())],
    ['semesterAktif', 'S1'],
    ['sasaranGPS', '3.00'],
    ['sasaranPNGK', '3.00'],
    ['thresholdGapKuning', '0.33'],   // gap <= nilai ini (dalam nilai gred) = KUNING, > ini = MERAH
    ['thresholdRisikoPemantauan', '0.33'],
    ['thresholdRisikoBerisiko', '0.67']
  ];
}

function nilaiLalaiGrades() {
  // Gred, NilaiGred, Lulus(YA/TIDAK) — boleh dikemaskini ADMIN mengikut kaedah rasmi sekolah
  return [
    ['A', '4.00', 'YA'],
    ['A-', '3.67', 'YA'],
    ['B+', '3.33', 'YA'],
    ['B', '3.00', 'YA'],
    ['B-', '2.67', 'YA'],
    ['C+', '2.33', 'YA'],
    ['C', '2.00', 'YA'],
    ['C-', '1.67', 'TIDAK'],
    ['D+', '1.33', 'TIDAK'],
    ['D', '1.00', 'TIDAK'],
    ['F', '0.00', 'TIDAK']
  ];
}

function nilaiLalaiBLD() {
  // Contoh BLD (julat markah->gred) bagi subjek CONTOH 'PA', Semester 1 SAHAJA —
  // SETIAP subjek x semester sebenar WAJIB ditetapkan berasingan oleh Admin/Ketua
  // Panitia di menu "Skema Gred (BLD)", sebab S1/S2/S3 boleh ada julat markah
  // berlainan bagi subjek yang sama (MODUL 5/29 — markah & gred).
  return [
    ['PA', 'S1', 'A', '80', '100'], ['PA', 'S1', 'A-', '75', '79'], ['PA', 'S1', 'B+', '70', '74'],
    ['PA', 'S1', 'B', '65', '69'], ['PA', 'S1', 'B-', '60', '64'], ['PA', 'S1', 'C+', '55', '59'],
    ['PA', 'S1', 'C', '50', '54'], ['PA', 'S1', 'C-', '45', '49'], ['PA', 'S1', 'D+', '40', '44'],
    ['PA', 'S1', 'D', '35', '39'], ['PA', 'S1', 'F', '0', '34']
  ];
}

function jenisIntervensiLalai() {
  return [
    'Klinik akademik', 'Bengkel teknik menjawab', 'Modul latihan',
    'Bimbingan individu', 'Peer tutoring', 'Latihan topikal',
    'Program intensif', 'Mentor mentee', 'Intervensi kehadiran', 'Lain-lain'
  ];
}
