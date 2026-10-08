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
const SHEET_TEACHING_ASSIGNMENTS = 'TEACHING_ASSIGNMENTS';
const SHEET_UNLOCK_REQUESTS = 'UNLOCK_REQUESTS';
const SHEET_MUET = 'MUET';
const SHEET_MUET_BAND = 'MUET_BAND';
const SHEET_MUET_GPS = 'MUET_GPS_SEJARAH';

/* MUET (800) — guru dengan kod ini dalam SkopSubjek boleh isi markah MUET.
   Selaraskan dengan pemalar KOD_SUBJEK_MUET dalam Index.html jika diubah. */
const KOD_SUBJEK_MUET = '800';

/* Pilihan ulasan guru pada slip MUET (dropdown). Teks disimpan penuh dalam Sheet MUET
   (lajur T1_Ulasan/T2_Ulasan/A_Ulasan) — jika teks di sini diubah, ulasan lama yang
   tiada lagi dalam senarai perlu dipilih semula. Kumpulan 5-5: cemerlang (1–5), baik
   (6–10), peningkatan (11–15), sederhana (16–20), perlu usaha (21–25), motivasi (26–30). */
const SENARAI_ULASAN_MUET = [
  'Excellent performance! Keep up the outstanding work and continue striving for greater success.',
  'Congratulations on your excellent achievement. Your hard work and dedication have truly paid off.',
  'Outstanding performance! Continue to maintain this high standard and aim even higher.',
  'You have shown great commitment and determination. Keep up the excellent work!',
  'A remarkable achievement. Well done, and continue to shine!',
  'Well done! You have shown good progress and a positive attitude towards your studies.',
  'Good performance. Continue working hard to achieve even better results in the future.',
  'You have made good progress. Keep working consistently and believe in your abilities.',
  'A good effort and achievement. Stay focused and continue to improve.',
  'Well done on your results. With continued effort, you can achieve even greater success.',
  'Good improvement! Keep up the effort and continue working towards your goals.',
  'You have shown encouraging progress. Keep working hard and do not give up.',
  'Your improvement is commendable. Stay focused and continue to put in your best effort.',
  'Keep moving forward! With greater consistency and determination, you can achieve better results.',
  'A positive improvement. Continue building on your strengths and work on areas that need improvement.',
  'A satisfactory performance. More consistent effort and focus are needed to achieve better results.',
  'You have the potential to do better. Stay focused and put more effort into your studies.',
  'Keep trying and do not be discouraged. Greater effort and commitment will lead to better results.',
  'A fair performance. Continue working hard and seek guidance whenever necessary.',
  'You can achieve more. Be more consistent in your studies and believe in yourself.',
  'More effort is needed. Stay focused, work consistently, and do not give up.',
  'You need to put more effort into your studies. With determination and commitment, you can improve.',
  'There is room for improvement. Set clear goals and work consistently towards achieving them.',
  'Do not be discouraged by these results. Use them as motivation to work harder and improve.',
  'You have the potential to do better. Greater focus, discipline, and consistent effort are needed.',
  'Every result is a step towards improvement. Keep learning, keep trying, and never give up.',
  'Believe in yourself and keep working hard. Your effort today will shape your success tomorrow.',
  'Success comes with patience, effort, and perseverance. Keep doing your best!',
  'Keep challenging yourself and never stop improving. You are capable of achieving more.',
  'Your journey does not end with this result. Learn from it, grow from it, and keep moving forward.'
];

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

/* ------------------------- PERANAN (ROLES) -------------------------
   Hanya 4 peranan:
   - ADMIN          : akses penuh semua modul & semua pelajar.
   - KETUA_UNIT     : ketua bagi mata pelajaran dalam lajur UnitKetua (USERS) —
                      SATU ketua unit bagi setiap mata pelajaran (termasuk MUET 800).
                      Akses penuh mata pelajaran unitnya (semua medan headcount,
                      BLD, dashboard subjek; MUET: penetapan guru & GPS sejarah).
   - GURU_TINGKATAN : guru tingkatan bagi kelas dalam SkopKelas — akses SEMUA mata
                      pelajaran (termasuk MUET) bagi pelajar dalam kelas tersebut.
   - GURU           : mata pelajaran dalam SkopSubjek sahaja.
   Semua peranan bukan ADMIN juga boleh mengajar subjek dalam SkopSubjek. */
const ROLE_ADMIN = 'ADMIN';
const ROLE_KETUA_UNIT = 'KETUA_UNIT';
const ROLE_GURU_TINGKATAN = 'GURU_TINGKATAN';
const ROLE_GURU = 'GURU';

const SEMUA_PERANAN = [ROLE_ADMIN, ROLE_KETUA_UNIT, ROLE_GURU_TINGKATAN, ROLE_GURU];

// Peranan yang boleh melihat/menguruskan SEMUA pelajar & modul pentadbiran
const PERANAN_AKSES_PENUH = [ROLE_ADMIN];

/* Peranan lama (sebelum rombakan 4 peranan) dipetakan secara automatik — akaun
   lama terus berfungsi walaupun menu "5. Kemaskini Peranan" belum dijalankan. */
const PETA_PERANAN_LAMA = {
  GPK_TINGKATAN6: ROLE_ADMIN, KETUA_AKADEMIK: ROLE_ADMIN,
  KETUA_PANITIA: ROLE_KETUA_UNIT, GURU_KELAS: ROLE_GURU_TINGKATAN
};

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

/* Band MUET (format 2021, jumlah 360) — Band, MarkahMin, MarkahMax, NilaiBand.
   NilaiBand dipakai untuk GPMP/GPS MUET (purata nilai band; lebih tinggi lebih baik).
   Boleh diubah terus dalam Sheet MUET_BAND tanpa sentuh kod (MODUL 43). */
function nilaiLalaiBandMUET() {
  return [
    ['5+', '331', '360', '5.5'], ['5.0', '294', '330', '5'], ['4.5', '258', '293', '4.5'],
    ['4.0', '211', '257', '4'], ['3.5', '164', '210', '3.5'], ['3.0', '123', '163', '3'],
    ['2.5', '82', '122', '2.5'], ['2.0', '36', '81', '2'], ['1.0', '0', '35', '1']
  ];
}

function jenisIntervensiLalai() {
  return [
    'Klinik akademik', 'Bengkel teknik menjawab', 'Modul latihan',
    'Bimbingan individu', 'Peer tutoring', 'Latihan topikal',
    'Program intensif', 'Mentor mentee', 'Intervensi kehadiran', 'Lain-lain'
  ];
}
