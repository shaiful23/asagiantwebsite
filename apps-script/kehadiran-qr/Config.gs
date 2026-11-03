/* =========================================================================
 * Config.gs — e-Kehadiran SMK Asajaya
 * Semua pemalar sistem di satu tempat: nama Sheet, header, peranan,
 * ambang amaran ponteng dan tetapan lalai (boleh diubah admin dalam Sheet
 * TETAPAN tanpa menyunting kod).
 * ========================================================================= */

const NAMA_SISTEM = 'e-Kehadiran';
const ZON_MASA = 'Asia/Kuching';
const TEMPOH_SESI_SAAT = 6 * 60 * 60;   // 6 jam (had CacheService)
const HAD_CUBAAN_LOGIN = 5;
const TEMPOH_KUNCI_LOGIN_SAAT = 10 * 60;
const PANJANG_MIN_KATA_LALUAN = 8;

/* ------------------------------ SHEET ------------------------------ */
const SHEET = {
  TETAPAN: 'TETAPAN',
  GURU: 'GURU',
  MURID: 'MURID',                         // sandaran jika e-Data & Enrolmen belum disambung
  KELAS: 'KELAS',
  SLOT: 'SLOT_WAKTU',
  JADUAL: 'JADUAL_WAKTU',                 // sandaran jika e-Teach-In belum disambung
  TEACHIN: 'TEACH_IN',                    // sandaran jika e-Teach-In belum disambung
  SEBAB: 'SEBAB_TIDAK_HADIR',             // sandaran jika senarai IDME belum disambung
  AKAUN: 'AKAUN',
  REKOD_KELAS: 'REKOD_KELAS_HARIAN',
  TIDAK_HADIR: 'KETIDAKHADIRAN_HARIAN',
  LOG_SUBJEK: 'LOG_KEHADIRAN_SUBJEK',
  TIDAK_HADIR_SUBJEK: 'KETIDAKHADIRAN_SUBJEK',
  PERMOHONAN: 'PERMOHONAN_BUKA_AKSES',
  INTERVENSI: 'INTERVENSI',
  SURAT: 'SURAT_AMARAN',
  PETA_KOD: 'PETA_KOD_KELAS',             // kod kelas e-Teach-In (cth. 2AR) → kelas e-Data (2 AZARA)
  CUTI: 'CUTI_SEKOLAH',                   // hari cuti / tiada P&P (dikecualikan dari analisis pematuhan guru)
  PENGECUALIAN: 'PENGECUALIAN_GURU',      // guru berkursus/cuti/tugas rasmi — sesi tidak dikira tidak masuk
  AUDIT: 'AUDIT'
};

const HEADER = {
  TETAPAN: ['Kunci', 'Nilai', 'Keterangan'],
  GURU: ['NoKP', 'Nama', 'Peranan', 'KelasTingkatan', 'Emel', 'NoTelefon', 'Status', 'NamaDalamJadual'],
  MURID: ['NoKP', 'Nama', 'Kelas', 'Tingkatan', 'Jantina', 'TarikhLahir', 'Alamat', 'NamaPenjaga', 'TelefonPenjaga', 'Gambar', 'Status'],
  KELAS: ['Kelas', 'Tingkatan', 'KodQR', 'Bilik'],
  SLOT: ['Slot', 'MasaMula', 'MasaTamat'],
  JADUAL: ['Hari', 'Slot', 'Kelas', 'NoKPGuru', 'NamaGuru', 'Subjek'],
  TEACHIN: ['Tarikh', 'Slot', 'Kelas', 'NoKPGuruGanti', 'NamaGuruGanti', 'NoKPGuruAsal', 'NamaGuruAsal', 'Subjek', 'Catatan'],
  SEBAB: ['Kod', 'Sebab', 'Kategori', 'DikiraPonteng'],
  AKAUN: ['NoKP', 'Jenis', 'Password', 'MestiTukarPassword', 'LogMasukTerakhir', 'DikemaskiniPada'],
  REKOD_KELAS: ['IdRekod', 'Tarikh', 'Kelas', 'JumlahMurid', 'Hadir', 'TidakHadir', 'NoKPGuru', 'NamaGuru', 'MasaRekod', 'SelepasKunci', 'IdPermohonan'],
  TIDAK_HADIR: ['IdRekod', 'Tarikh', 'Kelas', 'NoKPMurid', 'NamaMurid', 'KodSebab', 'Sebab', 'DikiraPonteng'],
  LOG_SUBJEK: ['IdLog', 'Tarikh', 'Hari', 'Slot', 'NoKPGuru', 'NamaGuru', 'Kelas', 'Bilik', 'Subjek', 'Jenis', 'StatusMasa', 'JumlahMurid', 'Hadir', 'TidakHadir', 'Catatan', 'Masa'],
  TIDAK_HADIR_SUBJEK: ['IdLog', 'Tarikh', 'Slot', 'Kelas', 'Subjek', 'NoKPMurid', 'NamaMurid', 'KodSebab', 'Sebab', 'PontengKelas', 'NoKPGuru', 'NamaGuru'],
  PERMOHONAN: ['IdPermohonan', 'TarikhRekod', 'Kelas', 'NoKPGuru', 'NamaGuru', 'Alasan', 'MasaMohon', 'Status', 'DiprosesOleh', 'MasaProses', 'CatatanAdmin', 'TamatAkses'],
  INTERVENSI: ['IdIntervensi', 'Tarikh', 'NoKPMurid', 'NamaMurid', 'Kelas', 'Kategori', 'Tindakan', 'Catatan', 'NoKPGuru', 'NamaGuru', 'Masa'],
  SURAT: ['NoRujukan', 'TarikhKeluar', 'NoKPMurid', 'NamaMurid', 'Kelas', 'Kategori', 'Peringkat', 'BilHari', 'MulaEpisod', 'NoKPGuru', 'NamaGuru', 'Masa'],
  PETA_KOD: ['Kod', 'Kelas', 'Catatan'],
  CUTI: ['IdCuti', 'TarikhMula', 'TarikhTamat', 'Catatan'],
  PENGECUALIAN: ['IdPengecualian', 'Tarikh', 'Masa', 'Kelas', 'NoKPGuru', 'NamaGuru', 'Sebab', 'NoKPAdmin', 'NamaAdmin', 'MasaRekod'],
  AUDIT: ['Masa', 'NoKP', 'Nama', 'Tindakan', 'Butiran']
};

/* ------------------------------ PERANAN ------------------------------
   GT & PGT berkongsi akses yang sama (rekod kehadiran kelas + amaran ponteng).
   GMP, Guru Praktikal & Kaunselor berkongsi akses yang sama (kehadiran subjek).
   Seorang guru boleh ada > 1 peranan (cth. "GT, GMP") — akses = gabungan. */
const PERANAN = {
  ADMIN: 'ADMIN',
  GT: 'GT',
  PGT: 'PGT',
  GMP: 'GMP',
  PRAKTIKAL: 'PRAKTIKAL',
  KAUNSELOR: 'KAUNSELOR',
  MURID: 'MURID'
};
const LABEL_PERANAN = {
  ADMIN: 'Pentadbir Sistem',
  GT: 'Guru Tingkatan',
  PGT: 'Penolong Guru Tingkatan',
  GMP: 'Guru Mata Pelajaran',
  PRAKTIKAL: 'Guru Praktikal',
  KAUNSELOR: 'Guru Kaunseling',
  MURID: 'Murid'
};
const KUMPULAN_GURU_KELAS = [PERANAN.GT, PERANAN.PGT];
const KUMPULAN_GURU_SUBJEK = [PERANAN.GMP, PERANAN.PRAKTIKAL, PERANAN.KAUNSELOR];

/* ------------------------------ AMARAN PONTENG ------------------------------
   `hari` = bilangan hari tidak hadir (dikira ponteng) yang mencetuskan peringkat itu.
   Berturut-turut : 3 → +7 (10) → +7 (17) → +14 (31)
   Tidak berturut : 10 → +10 (20) → +20 (40) → +20 (60) */
const PERINGKAT_AMARAN = {
  BERTURUT: [
    { kod: 'AMARAN_1', label: 'Amaran Pertama', hari: 3 },
    { kod: 'AMARAN_2', label: 'Amaran Kedua', hari: 10 },
    { kod: 'AMARAN_TERAKHIR', label: 'Amaran Terakhir', hari: 17 },
    { kod: 'BUANG_SEKOLAH', label: 'Buang Sekolah', hari: 31 }
  ],
  TIDAK_BERTURUT: [
    { kod: 'AMARAN_1', label: 'Amaran Pertama', hari: 10 },
    { kod: 'AMARAN_2', label: 'Amaran Kedua', hari: 20 },
    { kod: 'AMARAN_TERAKHIR', label: 'Amaran Terakhir', hari: 40 },
    { kod: 'BUANG_SEKOLAH', label: 'Buang Sekolah', hari: 60 }
  ]
};
const LABEL_KATEGORI_AMARAN = { BERTURUT: 'Ponteng Berturut-turut', TIDAK_BERTURUT: 'Ponteng Tidak Berturut-turut', PONTENG_KELAS: 'Ponteng Kelas' };

const SENARAI_TINDAKAN_INTERVENSI = [
  'Panggilan telefon kepada ibu bapa/penjaga',
  'Mesej WhatsApp/SMS kepada ibu bapa/penjaga',
  'Perjumpaan dengan ibu bapa/penjaga di sekolah',
  'Lawatan ke rumah murid',
  'Sesi kaunseling individu',
  'Sesi bimbingan bersama Guru Tingkatan',
  'Rujukan kepada Guru Disiplin',
  'Rujukan kepada Unit HEM / PK HEM',
  'Rujukan kepada agensi luar (PPD/JKM/AADK)',
  'Surat amaran dihantar',
  'Lain-lain'
];

/* Ponteng kelas: murid hadir ke sekolah (menurut rekod GT) tetapi tiada dalam
   kelas semasa waktu P&P guru mata pelajaran. Sebab khas dalam borang imbas QR. */
const KOD_PONTENG_KELAS = 'PONTENG_KELAS';
const SEBAB_PONTENG_KELAS = { kod: KOD_PONTENG_KELAS, sebab: 'Ponteng kelas (hadir ke sekolah tetapi tiada dalam kelas)', kategori: 'Ponteng Kelas', dikiraPonteng: false, pontengKelas: true };
const AMBANG_PONTENG_KELAS_BERULANG = 3;   // kes sebulan → murid ditanda "berulang"

/* Amaran ponteng kelas — kes ponteng kelas terkumpul dalam tahun semasa.
   Ambang boleh diubah admin di UI (Urus Sistem → Tetapan: PK_AMARAN_*). */
const PERINGKAT_AMARAN_PK = [
  { kod: 'AMARAN_1', label: 'Amaran Pertama', kunci: 'PK_AMARAN_1', lalai: 3 },
  { kod: 'AMARAN_2', label: 'Amaran Kedua', kunci: 'PK_AMARAN_2', lalai: 6 },
  { kod: 'AMARAN_TERAKHIR', label: 'Amaran Terakhir', kunci: 'PK_AMARAN_TERAKHIR', lalai: 10 },
  { kod: 'RUJUKAN_DISIPLIN', label: 'Rujukan Lembaga Disiplin', kunci: 'PK_RUJUKAN_DISIPLIN', lalai: 15 }
];

const SENARAI_JENIS_GURU_SUBJEK = ['GURU SUBJEK', 'GURU TEACH-IN', 'LAIN-LAIN'];

const HARI_MS = ['AHAD', 'ISNIN', 'SELASA', 'RABU', 'KHAMIS', 'JUMAAT', 'SABTU'];
const BULAN_MS = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

/* ------------------------------ TETAPAN LALAI ------------------------------
   Disalin ke Sheet TETAPAN semasa "Sediakan Sistem". Admin ubah nilai di Sheet.
   Sumber luar: isi ID spreadsheet sistem berkenaan + nama tab + nama lajur
   (header) di sistem itu. Kosongkan ID untuk guna Sheet sandaran tempatan. */
const TETAPAN_LALAI = [
  ['NAMA_SEKOLAH', 'SEKOLAH MENENGAH KEBANGSAAN ASAJAYA', 'Nama penuh sekolah (kepala surat)'],
  ['ALAMAT_SEKOLAH', '94600 Asajaya, Sarawak', 'Alamat sekolah (kepala surat)'],
  ['TELEFON_SEKOLAH', '', 'No. telefon pejabat sekolah'],
  ['EMEL_SEKOLAH', '', 'E-mel rasmi sekolah'],
  ['KOD_SEKOLAH', '', 'Kod sekolah KPM (cth. YEB...)'],
  ['NAMA_PENGETUA', '', 'Nama Pengetua (tandatangan surat amaran)'],
  ['PREFIKS_RUJUKAN_SURAT', 'SMKA/HEM/KHD', 'Prefiks No. Rujukan surat amaran'],
  ['MASA_KUNCI_KEHADIRAN', '07:10', 'Selepas masa ini rekod kehadiran kelas GT dikunci (HH:mm)'],
  ['TEMPOH_BUKA_AKSES_MINIT', '120', 'Tempoh akses dibuka selepas permohonan diluluskan admin (minit)'],
  ['TOLERANSI_LEWAT_MINIT', '10', 'Guru subjek dikira LEWAT jika imbas lebih dari minit ini selepas slot bermula'],
  ['URL_PENGIMBAS', 'https://smkasajaya.my/kehadiranqrscanner.html', 'URL halaman pengimbas QR (GitHub Pages)'],
  ['HARI_PERSEKOLAHAN', 'ISNIN,SELASA,RABU,KHAMIS,JUMAAT', 'Hari persekolahan'],
  ['TEMPOH_EDIT_SESI_HARI', '14', 'Guru boleh mengedit sesi P&P yang dia rekod dalam tempoh (hari) ini; admin tiada had'],
  ['PK_AMARAN_1', '3', 'Amaran ponteng kelas: bilangan kes setahun untuk Amaran Pertama'],
  ['PK_AMARAN_2', '6', 'Amaran ponteng kelas: bilangan kes setahun untuk Amaran Kedua'],
  ['PK_AMARAN_TERAKHIR', '10', 'Amaran ponteng kelas: bilangan kes setahun untuk Amaran Terakhir'],
  ['PK_RUJUKAN_DISIPLIN', '15', 'Amaran ponteng kelas: bilangan kes setahun untuk Rujukan Lembaga Disiplin'],

  ['EDATA_SPREADSHEET_ID', '', 'e-Data & Enrolmen: ID atau URL spreadsheet (kosong = guna Sheet MURID)'],
  ['EDATA_FORMAT', 'AUTO', 'e-Data: AUTO (kesan format SMK Asajaya: tab Data_Murid/Pengguna/Foto_Murid), SMKA, atau UMUM (guna pemetaan lajur di bawah)'],
  ['EDATA_TAB', 'MURID', 'e-Data & Enrolmen: nama tab senarai murid'],
  ['EDATA_LAJUR_NOKP', 'NoKP', 'e-Data: nama lajur No. KP murid'],
  ['EDATA_LAJUR_NAMA', 'Nama', 'e-Data: nama lajur nama murid'],
  ['EDATA_LAJUR_KELAS', 'Kelas', 'e-Data: nama lajur kelas'],
  ['EDATA_LAJUR_TINGKATAN', 'Tingkatan', 'e-Data: nama lajur tingkatan'],
  ['EDATA_LAJUR_JANTINA', 'Jantina', 'e-Data: nama lajur jantina'],
  ['EDATA_LAJUR_TARIKHLAHIR', 'TarikhLahir', 'e-Data: nama lajur tarikh lahir'],
  ['EDATA_LAJUR_ALAMAT', 'Alamat', 'e-Data: nama lajur alamat'],
  ['EDATA_LAJUR_NAMAPENJAGA', 'NamaPenjaga', 'e-Data: nama lajur nama ibu bapa/penjaga'],
  ['EDATA_LAJUR_TELEFONPENJAGA', 'TelefonPenjaga', 'e-Data: nama lajur telefon penjaga'],
  ['EDATA_LAJUR_GAMBAR', 'Gambar', 'e-Data: nama lajur gambar profil (URL atau ID fail Drive)'],
  ['EDATA_LAJUR_STATUS', 'Status', 'e-Data: nama lajur status murid (AKTIF/BERHENTI/PINDAH)'],

  ['TEACHIN_SPREADSHEET_ID', '', 'e-Teach-In: ID atau URL spreadsheet (kosong = guna Sheet JADUAL_WAKTU & TEACH_IN)'],
  ['TEACHIN_FORMAT', 'AUTO', 'e-Teach-In: AUTO (kesan format SMK Asajaya: Jadual_Induk_Perdana/T6, Rekod_TeachIn, Profil_Guru), SMKA, atau UMUM'],
  ['TEACHIN_TAB_JADUAL', 'JADUAL_WAKTU', 'e-Teach-In: nama tab jadual waktu (kelas diajar)'],
  ['TEACHIN_JADUAL_LAJUR_HARI', 'Hari', 'e-Teach-In jadual: lajur hari'],
  ['TEACHIN_JADUAL_LAJUR_SLOT', 'Slot', 'e-Teach-In jadual: lajur slot/waktu'],
  ['TEACHIN_JADUAL_LAJUR_KELAS', 'Kelas', 'e-Teach-In jadual: lajur kelas'],
  ['TEACHIN_JADUAL_LAJUR_NOKPGURU', 'NoKPGuru', 'e-Teach-In jadual: lajur No. KP guru'],
  ['TEACHIN_JADUAL_LAJUR_NAMAGURU', 'NamaGuru', 'e-Teach-In jadual: lajur nama guru'],
  ['TEACHIN_JADUAL_LAJUR_SUBJEK', 'Subjek', 'e-Teach-In jadual: lajur subjek'],
  ['TEACHIN_TAB_GANTI', 'TEACH_IN', 'e-Teach-In: nama tab rekod guru ganti (teach-in)'],
  ['TEACHIN_GANTI_LAJUR_TARIKH', 'Tarikh', 'e-Teach-In ganti: lajur tarikh'],
  ['TEACHIN_GANTI_LAJUR_SLOT', 'Slot', 'e-Teach-In ganti: lajur slot/waktu'],
  ['TEACHIN_GANTI_LAJUR_KELAS', 'Kelas', 'e-Teach-In ganti: lajur kelas'],
  ['TEACHIN_GANTI_LAJUR_NOKPGURUGANTI', 'NoKPGuruGanti', 'e-Teach-In ganti: lajur No. KP guru ganti'],
  ['TEACHIN_GANTI_LAJUR_NAMAGURUGANTI', 'NamaGuruGanti', 'e-Teach-In ganti: lajur nama guru ganti'],
  ['TEACHIN_GANTI_LAJUR_NOKPGURUASAL', 'NoKPGuruAsal', 'e-Teach-In ganti: lajur No. KP guru asal'],
  ['TEACHIN_GANTI_LAJUR_NAMAGURUASAL', 'NamaGuruAsal', 'e-Teach-In ganti: lajur nama guru asal'],
  ['TEACHIN_GANTI_LAJUR_SUBJEK', 'Subjek', 'e-Teach-In ganti: lajur subjek'],

  ['IDME_SPREADSHEET_ID', '', 'Senarai sebab tidak hadir IDME: ID atau URL spreadsheet (kosong = guna Sheet SEBAB_TIDAK_HADIR)'],
  ['IDME_TAB', 'SEBAB_TIDAK_HADIR', 'IDME: nama tab senarai sebab'],
  ['IDME_LAJUR_KOD', 'Kod', 'IDME: lajur kod sebab'],
  ['IDME_LAJUR_SEBAB', 'Sebab', 'IDME: lajur keterangan sebab'],
  ['IDME_LAJUR_KATEGORI', 'Kategori', 'IDME: lajur kategori sebab'],
  ['IDME_LAJUR_DIKIRAPONTENG', 'DikiraPonteng', 'IDME: lajur YA/TIDAK sama ada sebab ini dikira ponteng (kosong = ikut SEBAB_PONTENG_KOD)'],
  ['SEBAB_PONTENG_KOD', '', 'Kod sebab (dipisah koma) yang dikira ponteng jika lajur DikiraPonteng tiada di IDME']
];

/* Senarai sandaran sebab tidak hadir — WAJIB disemak/diganti dengan senarai
   rasmi IDME sekolah (sambung melalui IDME_SPREADSHEET_ID atau salin ke Sheet). */
const SEBAB_SANDARAN = [
  ['S01', 'Sakit (dengan sijil cuti sakit)', 'Kesihatan', 'TIDAK'],
  ['S02', 'Sakit (tanpa sijil cuti sakit)', 'Kesihatan', 'TIDAK'],
  ['S03', 'Kematian ahli keluarga', 'Keluarga', 'TIDAK'],
  ['S04', 'Urusan keluarga / kecemasan keluarga', 'Keluarga', 'TIDAK'],
  ['S05', 'Mewakili sekolah / aktiviti rasmi', 'Rasmi', 'TIDAK'],
  ['S06', 'Cuti diluluskan pihak sekolah', 'Rasmi', 'TIDAK'],
  ['S07', 'Bencana alam / banjir / cuaca buruk', 'Luar Kawalan', 'TIDAK'],
  ['S08', 'Masalah pengangkutan', 'Luar Kawalan', 'TIDAK'],
  ['S09', 'Ponteng / tanpa sebab', 'Ponteng', 'YA'],
  ['S10', 'Tidak hadir tanpa makluman ibu bapa', 'Ponteng', 'YA'],
  ['S11', 'Lain-lain', 'Lain-lain', 'YA']
];
