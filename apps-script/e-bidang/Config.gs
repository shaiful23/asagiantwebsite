/* =========================================================================
 * SISTEM E-BIDANG (SAINS & MATEMATIK) SMK ASAJAYA — Config.gs
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
const SHEET_PESANAN_MAKMAL = 'PESANAN_MAKMAL';
const SHEET_ITEM_PESANAN_MAKMAL = 'ITEM_PESANAN_MAKMAL';

/* ------------------------- PERANAN (ROLES) ------------------------- */
const ROLE_ADMIN = 'ADMIN';
const ROLE_KETUA_BIDANG = 'KETUA_BIDANG';
const ROLE_KETUA_PANITIA = 'KETUA_PANITIA';
const ROLE_GURU = 'GURU';
const ROLE_PEMBANTU_MAKMAL = 'PEMBANTU_MAKMAL';

const SEMUA_PERANAN = [ROLE_ADMIN, ROLE_KETUA_BIDANG, ROLE_KETUA_PANITIA, ROLE_GURU, ROLE_PEMBANTU_MAKMAL];

// Peranan yang boleh melihat/menguruskan SEMUA panitia (bukan hanya panitia sendiri)
const PERANAN_AKSES_PENUH = [ROLE_ADMIN, ROLE_KETUA_BIDANG];

// Peranan yang boleh menguruskan (cipta/kemaskini/padam) mesyuarat & program panitia
const PERANAN_URUS_PANITIA = [ROLE_ADMIN, ROLE_KETUA_BIDANG, ROLE_KETUA_PANITIA];

// Peranan yang boleh melihat/memproses Pesanan Makmal merentasi SEMUA panitia
const PERANAN_LIHAT_SEMUA_PESANAN = [ROLE_ADMIN, ROLE_KETUA_BIDANG, ROLE_PEMBANTU_MAKMAL];

/* ------------------------- PANITIA BIDANG SAINS & MATEMATIK ------------------------- */
const SENARAI_PANITIA = ['Matematik', 'Sains', 'Kimia', 'Biologi', 'Fizik'];

// Panitia yang menjalankan eksperimen makmal (boleh buat Pesanan Radas & Bahan) — Matematik tidak termasuk.
const PANITIA_MAKMAL = ['Sains', 'Kimia', 'Biologi', 'Fizik'];

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

/* ------------------------- STATUS PESANAN MAKMAL ------------------------- */
const STATUS_PESANAN_MENUNGGU = 'MENUNGGU';
const STATUS_PESANAN_DALAM_PROSES = 'DALAM_PROSES';
const STATUS_PESANAN_SIAP = 'SIAP';
const STATUS_PESANAN_DITOLAK = 'DITOLAK';
const STATUS_PESANAN_DIBATALKAN = 'DIBATALKAN';
const SEMUA_STATUS_PESANAN = [STATUS_PESANAN_MENUNGGU, STATUS_PESANAN_DALAM_PROSES,
  STATUS_PESANAN_SIAP, STATUS_PESANAN_DITOLAK, STATUS_PESANAN_DIBATALKAN];

/* ------------------------- SESI & KESELAMATAN ------------------------- */
const TEMPOH_SESI_SAAT = 8 * 60 * 60; // 8 jam
const NAMA_FOLDER_INDUK_DRIVE = 'E-Bidang Sains & Matematik - Fail';
