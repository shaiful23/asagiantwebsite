/* =========================================================================
 * Scoring.gs — Logik pengiraan PAJSK (fungsi MURNI, tanpa akses Sheet).
 *
 * Fungsi-fungsi di fail ini dijalankan di PELAYAN (simpan/semak semula markah)
 * DAN disalin ke pelayar melalui doGet() (Function.toString) untuk pratonton
 * markah serta-merta — satu sumber logik sahaja. Sebab itu setiap fungsi
 * WAJIB kekal murni: hanya guna argumen + fungsi lain dalam fail ini
 * (jangan rujuk pemalar/Sheet/Utilities dari fail lain).
 *
 * Mengikut formula TEMPLATE PAJSK SMK ASAJAYA:
 *   Skor aspek  = Jawatan + Libat(tertinggi) + Capai(tertinggi) + Komitmen(1-4)
 *                 + Khidmat Sumbangan + Kehadiran                (maks 110)
 *   Markah aspek = Skor / 110 x 100
 *   Ekstra       = skor tertinggi daripada 6 komponen ekstra kurikulum (maks 10)
 *   Rumusan:  purata 2 markah aspek tertinggi + Ekstra  => markah semasa (GPA)
 *             jika ada CGPA tahun sebelum => (GPA + CGPA lepas) / 2  (had 100)
 *   Gred      = jadual GRED (A >=80, B >=60, C >=40, D >=20, E >=1)
 * ========================================================================= */

function bundar2(n) {
  return Math.round((Number(n) + 1e-9) * 100) / 100;
}

function skorCari(peta, label) {
  if (label === undefined || label === null || label === '') return 0;
  const v = peta ? peta[label] : undefined;
  return typeof v === 'number' ? v : 0;
}

/* r: {Jawatan, Libat1, Capai1, Libat2, Capai2, Komit1..4, Khidmat, Kehadiran}
   ref: {peta:{JENIS:{label:nilai}}, ...} */
function kiraAspekMurni(r, ref) {
  const p = ref.peta;
  const skorJawatan = skorCari(p.JAWATAN, r.Jawatan);
  const skorLibat = Math.max(skorCari(p.PELIBATAN, r.Libat1), skorCari(p.PELIBATAN, r.Libat2));
  const skorCapai = Math.max(skorCari(p.PENCAPAIAN, r.Capai1), skorCari(p.PENCAPAIAN, r.Capai2));
  // Pilihan komitmen yang sama tidak dikira dua kali.
  const dilihat = {};
  let skorKomit = 0;
  [r.Komit1, r.Komit2, r.Komit3, r.Komit4].forEach(function (k) {
    if (k && !dilihat[k]) { dilihat[k] = true; skorKomit += skorCari(p.KOMITMEN, k); }
  });
  const skorKhidmat = skorCari(p.KHIDMAT_SUMBANGAN, r.Khidmat);
  let hadir = Math.floor(Number(r.Kehadiran) || 0);
  if (hadir < 0) hadir = 0;
  if (hadir > 12) hadir = 12;
  const skorKehadiran = hadir ? skorCari(p.KEHADIRAN, String(hadir)) : 0;
  const skor = bundar2(skorJawatan + skorLibat + skorCapai + skorKomit + skorKhidmat + skorKehadiran);
  return {
    SkorJawatan: skorJawatan, SkorLibat: skorLibat, SkorCapai: skorCapai, SkorKomit: skorKomit,
    SkorKhidmat: skorKhidmat, SkorKehadiran: skorKehadiran, Skor: skor,
    Markah: bundar2(skor / 110 * 100)
  };
}

/* e: {Perkhidmatan, AnugerahKhas, KhidmatMasyarakat, Nilam, TimmsPisa, TugasKhas} */
function kiraEkstraMurni(e, ref) {
  const p = ref.peta;
  const sk = {
    SkPerkhidmatan: skorCari(p.PERKHIDMATAN, e.Perkhidmatan),
    SkAnugerah: skorCari(p.ANUGERAH_KHAS, e.AnugerahKhas),
    SkKM: skorCari(p.KHIDMAT_MASYARAKAT, e.KhidmatMasyarakat),
    SkNilam: skorCari(p.NILAM, e.Nilam),
    SkTimms: skorCari(p.TIMMS_PISA, e.TimmsPisa),
    SkTugas: skorCari(p.TUGAS_KHAS, e.TugasKhas)
  };
  sk.SkorTertinggi = Math.max(sk.SkPerkhidmatan, sk.SkAnugerah, sk.SkKM, sk.SkNilam, sk.SkTimms, sk.SkTugas);
  return sk;
}

/* Gred bagi markah akhir (0 => tiada gred). ref.gred disusun menaik mengikut 'min'. */
function gredDaripadaMarkah(markah, ref) {
  const m = Number(markah) || 0;
  if (m <= 0 || !ref.gred || !ref.gred.length) return null;
  let hasil = ref.gred[0];
  ref.gred.forEach(function (g) { if (m >= g.min) hasil = g; });
  return hasil;
}

/* Gred peringkat aspek untuk Analisa Ringkas: >79 A, >59 B, >39 C, >19 D, >0 E. */
function gredAspek(markah) {
  const m = Number(markah) || 0;
  if (m > 79) return 'A';
  if (m > 59) return 'B';
  if (m > 39) return 'C';
  if (m > 19) return 'D';
  if (m > 0) return 'E';
  return '';
}

/* cgpaSebelum: nombor atau ''/null jika tiada. */
function kiraRumusanMurni(markahPBB, markahSP, markahKP, ekstra, cgpaSebelum, ref) {
  const tiga = [Number(markahPBB) || 0, Number(markahSP) || 0, Number(markahKP) || 0].sort(function (a, b) { return b - a; });
  const purata2 = bundar2((tiga[0] + tiga[1]) / 2);
  const gpa = bundar2(purata2 + (Number(ekstra) || 0));
  const adaSebelum = !(cgpaSebelum === '' || cgpaSebelum === null || cgpaSebelum === undefined) && !isNaN(Number(cgpaSebelum));
  let cgpa = adaSebelum ? (gpa + Number(cgpaSebelum)) / 2 : gpa;
  if (cgpa > 100) cgpa = 100;
  cgpa = bundar2(cgpa);
  const g = gredDaripadaMarkah(cgpa, ref);
  return {
    Purata2Tertinggi: purata2, GPA: gpa, CGPA: cgpa, Persepuluh: bundar2(cgpa / 10),
    Gred: g ? g.gred : '', Label: g ? g.label : '', Rumusan: g ? g.rumusan : ''
  };
}

/* Senarai fungsi yang disalin ke pelayar (lihat doGet dalam Code.gs). */
function kodKiraanUntukKlien() {
  return [bundar2, skorCari, kiraAspekMurni, kiraEkstraMurni, gredDaripadaMarkah, gredAspek, kiraRumusanMurni]
    .map(function (f) { return f.toString(); }).join('\n\n');
}
