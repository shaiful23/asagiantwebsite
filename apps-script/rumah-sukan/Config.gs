/* =========================================================================
 * SISTEM PENGURUSAN RUMAH SUKAN SMK ASAJAYA — Config.gs
 * Semua nama Sheet, header, peranan dan nilai lalai konfigurasi.
 * JANGAN hard-code nilai ini di service lain — rujuk fail ini sahaja.
 * ========================================================================= */

/* ------------------------- NAMA SHEET (database) ------------------------- */
const SHEET_STAF = 'STAF';                 // guru & staf AKP
const SHEET_MURID = 'MURID';
const SHEET_RUMAH = 'RUMAH_SUKAN';
const SHEET_AJK = 'AJK';                   // senarai jawatankuasa kejohanan
const SHEET_AJK_AHLI = 'AJK_AHLI';         // lantikan ketua/ahli AJK
const SHEET_TETAPAN = 'TETAPAN';
const SHEET_AUDIT = 'LOG_AUDIT';
const SHEET_ACARA = 'ACARA';               // acara kejohanan olahraga (setiap tahun)
const SHEET_PESERTA = 'PESERTA';           // penyertaan, saringan/lorong & keputusan
const SHEET_MATA_LAIN = 'MATA_LAIN';       // mata bukan acara (perbarisan, sorakan, khemah, ...)

/* ------------------------- HEADER SHEET ------------------------- */
// Lajur pertama setiap Sheet ialah KUNCI baris (disemak sebelum menulis).
const HEADER_STAF = ['NoKP', 'Password', 'NamaPenuh', 'Kategori', 'Jantina', 'Jawatan', 'Telefon', 'Emel',
  'Admin', 'RumahId', 'PerananRumah', 'MestiTukarPassword', 'Status', 'Dikemaskini'];
const HEADER_MURID = ['NoKP', 'Password', 'NamaPenuh', 'Jantina', 'Tingkatan', 'Kelas', 'Kaum', 'Agama',
  'TarikhLahir', 'NoTelPenjaga', 'Atlet', 'Acara', 'RumahId', 'KunciRumah', 'MestiTukarPassword', 'Status', 'Dikemaskini', 'NoBib'];
const HEADER_RUMAH = ['RumahId', 'Nama', 'Warna', 'Moto', 'Susunan'];
const HEADER_AJK = ['AjkId', 'Nama', 'Tugas', 'Susunan', 'AksesKeputusan'];
const HEADER_AJK_AHLI = ['Id', 'AjkId', 'NoKP', 'Peranan', 'Tahun'];
const HEADER_TETAPAN = ['Kunci', 'Nilai', 'Keterangan'];
const HEADER_AUDIT = ['Tarikh', 'NoKP', 'Nama', 'Peranan', 'Tindakan', 'Modul', 'RujukanId', 'Butiran'];
const HEADER_ACARA = ['AcaraId', 'Tahun', 'NoAcara', 'Nama', 'Jenis', 'Kategori', 'Jantina', 'Unit', 'HadPerRumah',
  'BilLorong', 'BilKeAkhir', 'Tarikh', 'Masa', 'Status', 'RekodNilai', 'RekodPemegang', 'RekodRumah', 'RekodTahun', 'Susunan', 'Dikemaskini'];
const HEADER_PESERTA = ['Id', 'Tahun', 'AcaraId', 'RumahId', 'NoKP', 'Ahli', 'Pusingan', 'Saringan', 'Lorong',
  'Keputusan', 'Nilai', 'Kedudukan', 'Mata', 'Status', 'RekodBaharu', 'Dikemaskini'];
const HEADER_MATA_LAIN = ['Id', 'Tahun', 'RumahId', 'Perkara', 'Mata', 'Catatan', 'Dikemaskini'];

/* Lajur yang mesti disimpan sebagai TEKS (No. KP bermula 0, hash kata laluan, no. telefon). */
const LAJUR_TEKS = {
  STAF: ['NoKP', 'Password', 'Telefon'],
  MURID: ['NoKP', 'Password', 'Tingkatan', 'Kelas', 'TarikhLahir', 'NoTelPenjaga', 'NoBib'],
  ACARA: ['NoAcara', 'Tarikh', 'Masa', 'RekodNilai'],
  PESERTA: ['NoKP', 'Ahli', 'Keputusan'],
  AJK_AHLI: ['NoKP'],
  TETAPAN: ['Nilai'],
  LOG_AUDIT: ['NoKP']
};

/* ------------------------- JENIS PENGGUNA / PORTAL ------------------------- */
const JENIS_STAF = 'STAF';     // Portal Guru (guru & AKP)
const JENIS_MURID = 'MURID';   // Portal Murid

const KATEGORI_STAF = ['GURU', 'AKP'];

/* Peranan dalam rumah sukan (ditetapkan admin). */
const PERANAN_RUMAH = {
  KETUA: 'KETUA_GURU_RUMAH',
  PENOLONG: 'PENOLONG_KETUA_GURU_RUMAH',
  GURU: 'GURU_RUMAH'
};
const NAMA_PERANAN_RUMAH = {
  KETUA_GURU_RUMAH: 'Ketua Guru Rumah Sukan',
  PENOLONG_KETUA_GURU_RUMAH: 'Penolong Ketua Guru Rumah Sukan',
  GURU_RUMAH: 'Guru Rumah Sukan'
};
const HAD_KETUA_SETIAP_RUMAH = 1;

/* Peranan tambahan AJK Kejohanan Olahraga Tahunan. */
const PERANAN_AJK = { KETUA: 'KETUA_AJK', AHLI: 'AHLI_AJK' };
const NAMA_PERANAN_AJK = { KETUA_AJK: 'Ketua AJK', AHLI_AJK: 'Ahli AJK' };

/* ------------------------- TETAPAN (kunci Sheet TETAPAN) ------------------------- */
const TET_TAHUN = 'TAHUN_KEJOHANAN';
const TET_NAMA_KEJOHANAN = 'NAMA_KEJOHANAN';
const TET_MOD_KATEGORI = 'MOD_KATEGORI';         // UMUR | TINGKATAN
const TET_KATEGORI = 'KATEGORI';                 // JSON senarai kategori
const TET_KRITERIA = 'KRITERIA_AGIHAN';          // JSON kriteria agihan murid
const TET_AGIHAN_TERAKHIR = 'AGIHAN_TERAKHIR';   // ringkasan agihan terakhir (teks)

/* Kategori lalai olahraga sekolah menengah (umur = tahun kejohanan - tahun lahir).
   Mod TINGKATAN pula menggunakan senarai tingkatan (dipisah koma). Boleh diubah di UI. */
const KATEGORI_LALAI = [
  { kod: 'B15', nama: 'Bawah 15 Tahun', umurMin: 0, umurMax: 15, tingkatan: '1,2,3' },
  { kod: 'B18', nama: 'Bawah 18 Tahun', umurMin: 16, umurMax: 18, tingkatan: '4,5' },
  { kod: 'TBK', nama: 'Terbuka (Tingkatan 6)', umurMin: 19, umurMax: 99, tingkatan: '6' }
];

/* Kriteria lalai agihan murid ke rumah sukan (semua boleh diubah di UI Agihan). */
const KRITERIA_LALAI = {
  atletDahulu: true,       // 1. atlet diagih dahulu, sama rata ikut kategori & jantina
  atletIkutAcara: true,    //    atlet bagi acara sama disebar ke semua rumah
  ikutKategori: true,      // imbang mengikut kategori
  ikutJantina: true,       // imbang mengikut jantina
  ikutKelas: true,         // 2. setiap kelas mempunyai bilangan ahli hampir sama bagi setiap rumah (ikut jantina)
  skop: 'SEMUA',           // SEMUA = agih semula semua murid aktif | BAHARU = hanya murid tanpa rumah
  hormatKunci: true        // murid yang rumahnya dikunci (ditetapkan manual) tidak dipindah
};

/* Rumah sukan lalai semasa Sediakan Sistem (boleh diubah sepenuhnya di UI). */
const RUMAH_LALAI = [
  ['R1', 'MERAH', '#dc2626', '', 1],
  ['R2', 'BIRU', '#2563eb', '', 2],
  ['R3', 'HIJAU', '#16a34a', '', 3],
  ['R4', 'KUNING', '#eab308', '', 4]
];
const HAD_RUMAH = 12;

/* ------------------------- SESI & KESELAMATAN ------------------------- */
const TEMPOH_SESI_SAAT = 6 * 60 * 60;       // 6 jam
const HAD_GAGAL_LOGIN = 5;                  // kunci sementara selepas 5 cubaan gagal
const TEMPOH_KUNCI_LOGIN_SAAT = 10 * 60;    // 10 minit
const PREFIKS_CACHE = 'rs_';

/* ------------------------- KEJOHANAN OLAHRAGA ------------------------- */
const VERSI_SKEMA = 2;   // naikkan apabila Sheet/lajur baharu ditambah (Migrasi.gs menyelaras secara automatik)

const TET_TARIKH_KEJOHANAN = 'TARIKH_KEJOHANAN';
const TET_LOKASI = 'LOKASI_KEJOHANAN';
const TET_MATA_INDIVIDU = 'MATA_INDIVIDU';         // mata mengikut kedudukan (1,2,3,...)
const TET_MATA_BERGANTI = 'MATA_BERGANTI';
const TET_HAD_INDIVIDU = 'HAD_ACARA_INDIVIDU';     // maksimum acara individu bagi seorang atlet
const TET_HAD_BERGANTI = 'HAD_ACARA_BERGANTI';
const TET_PENDAFTARAN = 'PENDAFTARAN_ATLET';       // BUKA | TUTUP
const TET_TERBIT = 'TERBIT_KEPUTUSAN';             // YA = keputusan & papan mata dipaparkan di Portal Murid

const JENIS_ACARA = { BALAPAN: 'Balapan', PADANG: 'Padang', BERGANTI: 'Lari Berganti-ganti' };
const UNIT_ACARA = { MASA: 'Masa (saat)', JARAK: 'Jarak (meter)', TINGGI: 'Ketinggian (meter)' };
const STATUS_ACARA = { DIRANCANG: 'Dirancang', SEDIA: 'Senarai mula sedia', SARINGAN: 'Saringan selesai', SELESAI: 'Selesai' };
const STATUS_PESERTA = ['OK', 'DNS', 'DNF', 'DQ'];   // tidak hadir / tidak tamat / batal

/* Senarai acara standard olahraga sekolah — "Jana Acara Standard" di UI menciptanya bagi setiap
   kategori × jantina (acara yang sudah wujud tidak diduplikasi). */
const ACARA_STANDARD = [
  { nama: '100 METER', jenis: 'BALAPAN', unit: 'MASA' },
  { nama: '200 METER', jenis: 'BALAPAN', unit: 'MASA' },
  { nama: '400 METER', jenis: 'BALAPAN', unit: 'MASA' },
  { nama: '800 METER', jenis: 'BALAPAN', unit: 'MASA' },
  { nama: '1500 METER', jenis: 'BALAPAN', unit: 'MASA' },
  { nama: '4 X 100 METER', jenis: 'BERGANTI', unit: 'MASA' },
  { nama: '4 X 400 METER', jenis: 'BERGANTI', unit: 'MASA' },
  { nama: 'LOMPAT JAUH', jenis: 'PADANG', unit: 'JARAK' },
  { nama: 'LOMPAT KIJANG', jenis: 'PADANG', unit: 'JARAK' },
  { nama: 'LOMPAT TINGGI', jenis: 'PADANG', unit: 'TINGGI' },
  { nama: 'LONTAR PELURU', jenis: 'PADANG', unit: 'JARAK' },
  { nama: 'LEMPAR CAKERA', jenis: 'PADANG', unit: 'JARAK' },
  { nama: 'REJAM LEMBING', jenis: 'PADANG', unit: 'JARAK' }
];
