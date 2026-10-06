/* =========================================================================
 * SISTEM E-BIDANG BAHASA SMK ASAJAYA — Config.gs
 * Semua nama Sheet, peranan, senarai panitia dan nilai lalai konfigurasi.
 * JANGAN hard-code nilai ini di service lain — rujuk fail ini sahaja.
 * ========================================================================= */

/* ------------------------- NAMA SHEET ------------------------- */
const SHEET_USERS = 'USERS';
const SHEET_PANITIA = 'PANITIA';
const SHEET_KATEGORI_DOKUMEN = 'KATEGORI_DOKUMEN';
const SHEET_DOKUMEN = 'DOKUMEN';
const SHEET_MESYUARAT = 'MESYUARAT';
const SHEET_KEHADIRAN_MESYUARAT = 'KEHADIRAN_MESYUARAT';
const SHEET_TINDAKAN_SUSULAN = 'TINDAKAN_SUSULAN';
const SHEET_PROGRAM = 'PROGRAM';
const SHEET_EVIDENS = 'EVIDENS';
const SHEET_AUDIT_LOG = 'AUDIT_LOG';
const SHEET_PERANCANGAN_STRATEGIK = 'PERANCANGAN_STRATEGIK';
const SHEET_PELAN_TAKTIKAL = 'PELAN_TAKTIKAL';
const SHEET_PELAN_OPERASI = 'PELAN_OPERASI';
const SHEET_AKTIVITI_TAHUNAN = 'AKTIVITI_TAHUNAN';
const SHEET_PENCERAPAN_PDP = 'PENCERAPAN_PDP';
const SHEET_SEMAKAN_BUKU_LATIHAN = 'SEMAKAN_BUKU_LATIHAN';

/* ------------------------- PERANAN (ROLES) ------------------------- */
const ROLE_ADMIN = 'ADMIN';
const ROLE_KETUA_BIDANG = 'KETUA_BIDANG';
const ROLE_KETUA_PANITIA = 'KETUA_PANITIA';
const ROLE_GURU = 'GURU';

const SEMUA_PERANAN = [ROLE_ADMIN, ROLE_KETUA_BIDANG, ROLE_KETUA_PANITIA, ROLE_GURU];

// Peranan yang boleh melihat/menguruskan SEMUA panitia (bukan hanya panitia sendiri)
const PERANAN_AKSES_PENUH = [ROLE_ADMIN, ROLE_KETUA_BIDANG];

// Peranan yang boleh menguruskan (cipta/kemaskini/padam) mesyuarat & program panitia
const PERANAN_URUS_PANITIA = [ROLE_ADMIN, ROLE_KETUA_BIDANG, ROLE_KETUA_PANITIA];

/* ------------------------- PANITIA BIDANG BAHASA ------------------------- */
// Ubah senarai ini mengikut panitia bahasa sebenar di sekolah. Frontend (Index.html) membaca
// senarai ini terus daripada pelayan. Jika diubah SELEPAS "1. Sediakan Sistem", jalankan
// menu "4. Selaraskan Senarai Panitia" supaya Sheet PANITIA turut dikemaskini.
const SENARAI_PANITIA = ['Bahasa Melayu', 'Bahasa Inggeris', 'Bahasa Cina', 'Bahasa Iban', 'Bahasa Arab'];

// Skop khusus bagi Perancangan Strategik/Taktikal/Operasi & Carta Gantt yang
// merentasi SEMUA panitia (peringkat Ketua Bidang) — bukan satu Panitia tertentu.
// Digunakan sebagai nilai medan "Skop" (menggantikan nama Panitia biasa).
const SKOP_BIDANG = 'BIDANG';
const BULAN_TAHUNAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];

/* ------------------------- KATEGORI DOKUMEN LALAI ------------------------- */
function kategoriDokumenLalai() {
  return [
    ['MINIT_MESYUARAT', 'Minit Mesyuarat Panitia', 'Minit mesyuarat panitia sepanjang tahun', 'YA'],
    ['RPT', 'Rancangan Pengajaran Tahunan (RPT)', 'RPT setiap mata pelajaran/tingkatan', 'YA'],
    ['TAKWIM', 'Takwim Aktiviti Panitia', 'Perancangan aktiviti/program sepanjang tahun', 'YA'],
    ['PEKELILING', 'Pekeliling & Surat Rasmi', 'Pekeliling/arahan berkaitan panitia', 'TIDAK'],
    ['LAPORAN_PROGRAM', 'Laporan Program/Aktiviti', 'Laporan pelaksanaan program panitia', 'YA'],
    ['INSTRUMEN_PBD', 'Instrumen Pentaksiran', 'Instrumen ujian/pentaksiran mata pelajaran', 'TIDAK'],
    ['ANALISIS_PEPERIKSAAN', 'Analisis Keputusan Peperiksaan', 'Analisis pencapaian pelajar setiap peperiksaan', 'YA'],
    ['FAIL_KEWANGAN', 'Fail Kewangan/Peruntukan', 'Rekod perbelanjaan/peruntukan panitia', 'TIDAK']
  ];
}

/* ------------------------- STATUS TINDAKAN SUSULAN ------------------------- */
const STATUS_BELUM_MULA = 'BELUM_MULA';
const STATUS_DALAM_PROSES = 'DALAM_PROSES';
const STATUS_SELESAI = 'SELESAI';
const SEMUA_STATUS_TINDAKAN = [STATUS_BELUM_MULA, STATUS_DALAM_PROSES, STATUS_SELESAI];

/* ------------------------- JENIS PROGRAM ------------------------- */
const JENIS_PROGRAM = 'PROGRAM';
const JENIS_PLC = 'PLC';
const SEMUA_JENIS_PROGRAM = [JENIS_PROGRAM, JENIS_PLC];

/* ------------------------- SESI & KESELAMATAN ------------------------- */
const TEMPOH_SESI_SAAT = 8 * 60 * 60; // 8 jam
const NAMA_FOLDER_INDUK_DRIVE = 'E-Bidang Bahasa - Fail';
