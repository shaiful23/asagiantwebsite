/* =========================================================================
 * SISTEM e-PAJSK SMK ASAJAYA — Config.gs
 * Semua nama Sheet, peranan, aspek dan nilai lalai konfigurasi.
 * JANGAN hard-code nilai ini di service lain — rujuk fail ini sahaja.
 * ========================================================================= */

/* ------------------------- NAMA SHEET (database e-PAJSK) ------------------------- */
const SHEET_PENGGUNA = 'PENGGUNA';
const SHEET_MURID = 'MURID';
const SHEET_ASPEK = 'PENTAKSIRAN_ASPEK';
const SHEET_EKSTRA = 'PENTAKSIRAN_EKSTRA';
const SHEET_RUMUSAN = 'RUMUSAN';
const SHEET_REFERENSI = 'REFERENSI';
const SHEET_TETAPAN = 'TETAPAN';
const SHEET_ARKIB = 'ARKIB_TAHUNAN';
const SHEET_AUDIT = 'LOG_AUDIT';
const SHEET_PERMOHONAN = 'PERMOHONAN_BUKA';   // permohonan KGP buka semula pengisian selepas tarikh akhir

/* ------------------------- PERANAN ------------------------- */
const ROLE_ADMIN = 'ADMIN';
const ROLE_GURU_KELAS = 'GURU_KELAS';
const SEMUA_PERANAN = [ROLE_ADMIN, ROLE_GURU_KELAS];

/* ------------------------- ASPEK PENTAKSIRAN ------------------------- */
const ASPEK_PBB = 'PBB';
const ASPEK_KP = 'KP';
const ASPEK_SP = 'SP';
// Susunan paparan: ikut susunan lajur template (PBB, KP, SP).
const SEMUA_ASPEK = [ASPEK_PBB, ASPEK_KP, ASPEK_SP];
const NAMA_ASPEK = {
  PBB: 'Pasukan Badan Beruniform',
  KP: 'Kelab & Persatuan',
  SP: 'Sukan & Permainan'
};

/* ------------------------- PENGHUBUNG e-KOKURIKULUM ------------------------- */
// ID Google Sheet "E-KOKURIKULUM" (lalai). Boleh ditukar dalam menu Tetapan tanpa ubah kod.
// Akaun yang men-deploy e-PAJSK MESTI mempunyai akses (pemilik/editor/viewer) kepada Sheet ini.
const ID_EKOKURIKULUM_LALAI = '1W7v1ERXY6CBVOyNPKqMyYDCVYK8or8ImQh-Yq5o2dKs';

const KOKO_SHEET_MURID = 'MURID';
const KOKO_SHEET_PENGGUNA = 'PENGGUNA';
const KOKO_SHEET_PENCAPAIAN = 'PENCAPAIAN';
// Nama Sheet kehadiran e-Kokurikulum bagi setiap aspek (nama dipotong 31 aksara oleh Google Sheets).
const KOKO_SHEET_KEHADIRAN = {
  PBB: 'KEHADIRAN_PASUKAN_BADAN_BERUNIF',
  KP: 'KEHADIRAN_KELAB_&_PERSATUAN',
  SP: 'KEHADIRAN_SUKAN_&_PERMAINAN'
};
// Nilai STATUS kehadiran (huruf besar) yang dikira sebagai HADIR.
const KOKO_STATUS_HADIR = ['HADIR', 'H'];

/* ------------------------- PARAMETER PENGIRAAN ------------------------- */
const JUMLAH_SKOR_MAKSIMUM = 110;   // jawatan 10 + libat 20 + capai 20 + komitmen 10 + khidmat 10 + hadir 40
const KEHADIRAN_MAKSIMUM = 12;      // kehadiran dikira sehingga 12 perjumpaan
const PERATUS_CGPA_DALAM_ARKIB = 10; // markah akhir dibahagi 10 => "10%" pada slip

/* ------------------------- TETAPAN (kunci Sheet TETAPAN) ------------------------- */
const TET_TAHUN = 'TAHUN_PENTAKSIRAN';
const TET_KOD_SEKOLAH = 'KOD_SEKOLAH';
const TET_NAMA_SEKOLAH = 'NAMA_SEKOLAH';
const TET_ID_KOKO = 'ID_EKOKURIKULUM';
const TET_ID_FOLDER_ARKIB = 'ID_FOLDER_ARKIB';

/* ------------------------- SESI & KESELAMATAN ------------------------- */
const TEMPOH_SESI_SAAT = 8 * 60 * 60;       // 8 jam
const HAD_GAGAL_LOGIN = 5;                  // kunci sementara selepas 5 cubaan gagal
const TEMPOH_KUNCI_LOGIN_SAAT = 10 * 60;    // 10 minit
const NAMA_FOLDER_ARKIB = 'e-PAJSK SMK Asajaya - Arkib';

/* ------------------------- KELENGKAPAN PENGISIAN (menu Status Pengisian) ------------------------- */
// Medan yang WAJIB diisi guru kelas bagi setiap aspek yang murid sertai (ada unit). Pencapaian, tambahan
// aktiviti, khidmat sumbangan dan ekstra kurikulum adalah PILIHAN (tidak semua murid layak).
// Bentuk: [medan, label]; medan 'KOMITMEN' = sekurang-kurangnya satu daripada Komitmen 1-4.
const MEDAN_WAJIB_ASPEK = [['Jawatan', 'Jawatan'], ['Libat1', 'Pelibatan'], ['KOMITMEN', 'Komitmen']];
// CGPA tahun sebelum wajib bagi Tingkatan 2 ke atas (Tingkatan 1 tiada markah PAJSK tahun lepas).
const WAJIB_CGPA_SEBELUM = true;

/* ------------------------- KETUA GURU PENASIHAT (KGP) — PENGISI DATA ------------------------- */
// Medan pentaksiran aspek (Jawatan, Pelibatan, Pencapaian, Komitmen, Khidmat, Kehadiran manual) diisi oleh
// KGP unit masing-masing; Guru Kelas hanya MELIHAT data kelasnya. KGP sesuatu unit ditentukan oleh:
//   1. e-Kokurikulum (Sheet PENGGUNA, lajur UNITn_JAWATAN = "KETUA GURU PENASIHAT") -> lajur PENGGUNA.UnitKoko (auto)
//   2. Tetapan manual Admin (menu Pengguna)                                              -> lajur PENGGUNA.UnitDijaga
// Format setiap unit: "<ASPEK>|<NAMA UNIT>" (cth. "PBB|PASUKAN KADET REMAJA SEKOLAH"); beberapa unit dipisah ";".
const LAJUR_PENGGUNA_UNIT = ['UnitDijaga', 'UnitKoko'];
const KOKO_JAWATAN_KGP = /KETUA\s*GURU\s*PENASIHAT/;
const KATA_KUNCI_KATEGORI = { PBB: /BERUNIF|PASUKAN|BADAN/, KP: /KELAB|PERSATUAN/, SP: /SUKAN|PERMAINAN/ };
// Ekstra kurikulum & CGPA tahun sebelum bukan milik mana-mana unit: diisi oleh Admin.
