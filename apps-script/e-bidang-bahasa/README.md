# Sistem E-Bidang Bahasa — SMK Asajaya

Sistem pengurusan fail digital bagi **Bidang Bahasa** (lalai: Panitia
Bahasa Melayu, Bahasa Inggeris, Bahasa Cina, Bahasa Iban, Bahasa Arab),
dibina menggunakan Google Sheets sebagai database dan Google Apps Script
sebagai backend + frontend (satu Web App SPA).

Kerangka & fungsi **sama** seperti Sistem E-Bidang Sains & Matematik
(`apps-script/e-bidang`), **kecuali**:

- Tiada modul **Pesanan Radas & Bahan Makmal** dan **Pengurusan Makmal**
  (Inventori & Semakan Keselamatan) — `PesananMakmalService.gs` dan
  `MakmalOpsService.gs` tidak disertakan, begitu juga Sheet
  `PESANAN_MAKMAL`, `ITEM_PESANAN_MAKMAL`, `INVENTORI_MAKMAL`,
  `SEMAKAN_KESELAMATAN_MAKMAL`.
- Tiada peranan **Pembantu Makmal** / **Ketua Pembantu Makmal**, dan tiada
  lajur `USERS.MakmalDijaga`.

**Senarai panitia boleh diubah** — sunting `SENARAI_PANITIA` dalam
`Config.gs` **sahaja** (cth. tambah `'Kesusasteraan Melayu Komunikatif'`,
`'Literature in English'`, `'Bahasa Tamil'`). `Index.html` membaca senarai ini
terus daripada pelayan, jadi semua tab (Fail & Dokumen, Mesyuarat, Tindakan
Susulan, Program & PLC, Perancangan Strategik, Pencerapan & Semakan, Pengguna)
ikut serta-merta. Jika diubah **selepas** "1. Sediakan Sistem", jalankan
**Sistem E-Bidang → 4. Selaraskan Senarai Panitia** supaya Sheet `PANITIA`
turut dikemaskini (panitia baharu ditambah; panitia yang dibuang ditanda
`TIDAK_AKTIF`, bukan dipadam), kemudian tetapkan Ketua Panitia baharu di menu
Panitia dan kemaskini Panitia setiap guru di menu Pengguna jika perlu.

## Ciri Utama

- **Log masuk selamat** — No. Kad Pengenalan (No. KP) + kata laluan. Kata
  laluan lalai bagi pengguna baharu ialah **6 digit terakhir No. KP**; kata
  laluan disimpan sebagai *hash* SHA-256 (bukan teks biasa) dalam Sheet `USERS`.
- **Paksa tukar kata laluan** selepas log masuk pertama (atau selepas kata
  laluan di-set semula oleh Admin/Ketua Bidang) — pengguna tidak boleh
  meneruskan penggunaan sistem tanpa menetapkan kata laluan baharu.
- **Kawalan akses mengikut peranan** (disahkan di **server**, bukan sekadar
  disembunyikan di frontend):

  | Peranan | Akses |
  | --- | --- |
  | `ADMIN` | Penuh — semua panitia, urus pengguna, log audit |
  | `KETUA_BIDANG` | Penuh — semua panitia, urus pengguna, log audit |
  | `KETUA_PANITIA` | Terhad kepada panitia sendiri (boleh > 1); boleh urus mesyuarat, tindakan susulan, program & fail bagi setiap panitia dalam senarai panitia sendiri |
  | `GURU` | Terhad kepada panitia sendiri (boleh > 1); boleh muat naik/lihat fail, lihat mesyuarat/program, kemaskini status tindakan yang ditugaskan kepadanya |

- **Sokongan pertindihan peranan & > 1 panitia** — seorang guru yang mengajar
  lebih daripada satu mata pelajaran (cth. Bahasa Melayu & Bahasa Iban,
  atau Bahasa Inggeris & Bahasa Cina) boleh didaftarkan dengan **lebih daripada satu Panitia** (tandakan
  semua yang berkenaan semasa tambah/sunting pengguna di menu **Pengguna**);
  sistem akan sediakan pemilih Panitia bagi setiap modul (Dokumen, Mesyuarat,
  Tindakan, Program) supaya pengguna itu boleh bertukar
  antara panitia sendiri. Seseorang yang juga `ADMIN`/`KETUA_BIDANG` tidak
  perlu akaun berasingan bagi peranan Ketua Panitia — akses penuh sedia ada
  sudah merangkumi semua panitia. **Nota:** jika seseorang `KETUA_PANITIA`
  didaftarkan bagi > 1 panitia, dia memperoleh kuasa peringkat ketua
  (urus mesyuarat/tindakan/program) bagi **kesemua** panitia yang
  disenaraikan, bukan hanya panitia yang beliau rasmi diketuai.
- **Pengurusan Fail Panitia** (modul teras) — kategori dokumen berpiawai
  (Minit Mesyuarat, RPT, Takwim, Pekeliling, Laporan Program, Instrumen
  Pentaksiran, Analisis Peperiksaan, Fail Kewangan), setiap fail dimuat naik
  terus ke Google Drive (struktur folder **Induk → Panitia → Kategori**) dan
  direkod dalam Sheet `DOKUMEN`. **Checklist kelengkapan fail** memaparkan
  peratus kategori wajib yang sudah lengkap bagi setiap panitia.
- **Mesyuarat Panitia** — minit (fail Drive), kehadiran ahli, dan tindakan
  susulan (status Belum Mula/Dalam Proses/Selesai, tanggungjawab, tarikh akhir).
  **Masa Mula & Masa Tamat** (pilihan) boleh diisi — jika kedua-duanya diisi,
  *event* Kalendar berkaitan dicipta BERMASA (bukan sehari penuh).
- **Program & PLC** — rekod program/aktiviti panitia (termasuk sesi PLC)
  berserta evidens pelaksanaan (fail Drive). **Masa Mula & Masa Tamat**
  (pilihan) boleh diisi sama seperti Mesyuarat.
- **Dashboard** — ringkasan kelengkapan fail, mesyuarat akan datang &
  tindakan tertunggak bagi setiap panitia (dalam skop akses peranan semasa),
  serta senarai tindakan susulan peribadi.
- **Carta Organisasi & Profil Guru** — menu **Carta Organisasi** (boleh
  diakses semua peranan) memaparkan carta bidang (Admin/Ketua Bidang di atas,
  Ketua Panitia setiap panitia di bawahnya) serta satu panel berasingan bagi
  **setiap Panitia** (Ketua Panitia + ahli).
  Klik mana-mana nama untuk buka **profil lengkap**: gambar, jawatan/gelaran,
  gred jawatan, no. telefon, kelayakan akademik, opsyen/pengkhususan, kelas
  diajar, dan tempoh mengajar subjek semasa (dikira automatik daripada tahun
  mula). Setiap pengguna kemaskini profil sendiri (termasuk muat naik gambar,
  dikecilkan automatik di pelayar sebelum dihantar) di menu **Profil Saya**
  — Admin/Ketua Bidang boleh juga isi medan yang sama bagi pihak pengguna
  lain di menu Pengguna (kecuali gambar, yang kekal sendiri-isi sahaja).
  Gambar dipaparkan terus daripada Drive melalui pelayan (bukan pautan Drive
  terus), jadi paparan tidak bergantung kepada tetapan perkongsian Drive
  setiap pengguna.
- **Perancangan Strategik** — menu berasingan dengan 4 tab:
  - **Perancangan Strategik (PS)** — Isu Strategik, Matlamat Strategik,
    Objektif, KPI, Sasaran (TOV → ETR), dan Strategi/Inisiatif bagi satu
    tempoh tahun (cth. 2024–2028).
  - **Pelan Taktikal (PT)** — program/projek tahunan berserta tanggungjawab,
    tempoh, kos/sumber, KPI, sasaran, dan pelan kontinjensi.
  - **Pelan Operasi (PO)** — perincian pelaksanaan satu program mengikut 4
    fasa (Pratugas, Penyediaan Bahan/Publisiti, Pelaksanaan, Penilaian &
    Post-Mortem).
  - **Carta Gantt** — jadual visual aktiviti tahunan merentasi 12 bulan
    (Jan–Dis), bertahun.

  Setiap rekod mempunyai **Skop** — satu Panitia tertentu, ATAU **"Bidang
  (Keseluruhan)"** (peringkat Ketua Bidang, dikongsi merentasi semua
  panitia). Sesiapa log masuk boleh **melihat** perancangan Bidang + panitia
  sendiri; hanya Admin/Ketua Bidang boleh **urus** skop Bidang, dan
  Admin/Ketua Bidang/Ketua Panitia panitia berkenaan boleh urus skop
  Panitia (sama seperti kebenaran Mesyuarat/Program).
- **Pencerapan &amp; Semakan** — menu berasingan dengan 2 tab (per Panitia,
  sama kebenaran seperti Mesyuarat/Program):
  - **Pencerapan PdP** — rekod pemerhatian pengajaran guru (guru diperc
    dipilih daripada ahli panitia, pencerap, tarikh, mata pelajaran/
    tingkatan, instrumen cth. SKPMg2, skor, catatan) berserta muat naik
    borang pencerapan (fail Drive).
  - **Semakan Buku Latihan** — rekod semakan buku latihan murid (tingkatan/
    kelas, semakan kali ke-, tarikh, pemeriksa, catatan) berserta muat naik
    laporan (fail Drive).
- **Log Audit** — setiap tindakan TAMBAH/KEMASKINI/PADAM/LOGIN/tukar kata
  laluan direkod (Admin/Ketua Bidang sahaja boleh semak).
- **Eksport CSV** — jadual Dokumen, Mesyuarat, Tindakan Susulan, Program & PLC,
  dan Log Audit masing-masing mempunyai butang **"Eksport CSV"** yang memuat
  turun terus data yang dipaparkan (tanpa panggilan pelayan tambahan) sebagai
  fail `.csv` — sesuai dibuka di Excel/Google Sheets.
- **Format paparan tarikh** — semua tarikh yang dipaparkan di UI (jadual,
  dashboard, log audit, borang cetak) dipaparkan dalam format **dd/MM/yyyy**
  (cth. 16/09/2026). Ini hanya format paparan — nilai disimpan dalam Sheet
  dan medan `<input type="date">` kekal format ISO (yyyy-MM-dd) seperti biasa,
  supaya penyusunan/perbandingan tarikh di pelayan tidak terjejas.
- **Kalendar Bersepadu (Google Calendar)** — setiap Mesyuarat dan Program/PLC
  disegerakkan secara automatik ke satu Kalendar Google khusus bernama
  **"E-Bidang Bahasa"**, dicipta automatik (di bawah akaun Google
  yang men-deploy sistem) apabila mesyuarat/program pertama disimpan. Jika
  Masa Mula & Masa Tamat diisi, *event* dicipta **bermasa** (waktu sebenar);
  jika tidak, *event* sehari penuh (atau julat hari bagi Program dengan
  Tarikh Tamat) seperti asal. Kemaskini/padam rekod turut mengemaskini/
  memadam *event* berkaitan. Kongsikan kalendar ini dengan staf (rujuk
  **Cara Pasang** langkah 14) — kegagalan penyegerakan Kalendar (cth. kuota)
  tidak menghalang mesyuarat/program itu sendiri daripada disimpan.
- **Notifikasi E-mel** — dua bentuk:
  - **Digest Harian** — pencetus terjadual (diaktifkan sekali melalui menu
    Sheet) menghantar e-mel setiap hari lebih kurang jam 7 pagi kepada:
    guru/ketua panitia yang mempunyai **Tindakan Susulan** tertunggak/
    tamat tempoh.
  - **Segera (real-time)** — dihantar TERUS (bukan menunggu digest harian)
    apabila **Tindakan Susulan** baharu ditugaskan
    atau tanggungjawabnya ditukar kepada orang lain — penerima baharu
    dimaklumkan serta-merta (kemaskini lain seperti tukar perkara/tarikh
    tanpa tukar tanggungjawab tidak menghantar e-mel berulang).
  - Kedua-duanya: hanya pengguna dengan lajur **Emel** diisi (menu Pengguna)
    akan menerima notifikasi — pengguna lain dilangkau senyap; kegagalan
    e-mel (kuota/ralat) tidak menghalang tindakan utama.

## Struktur

- `Code.gs` — menu Sheet, `sediakanSistemEBidang()`, `doGet()`.
- `Config.gs` — nama Sheet, peranan, senarai panitia, kategori dokumen lalai.
- `Utils.gs` — utiliti baca/tulis Sheet, ID, tarikh (guna oleh semua Service).
- `AuthService.gs` — log masuk, sesi (CacheService), tukar kata laluan sendiri.
- `UserService.gs` — urus pengguna (Admin/Ketua Bidang), set semula kata laluan.
- `PanitiaService.gs` — urus penetapan Ketua Panitia bagi panitia tetap (`SENARAI_PANITIA`).
- `DriveService.gs` — struktur folder Drive (Induk → Panitia → Kategori).
- `DocumentService.gs` — kategori dokumen, dokumen, checklist kelengkapan fail.
- `MeetingService.gs` — mesyuarat, kehadiran, tindakan susulan.
- `ProgramService.gs` — program/PLC & evidens.
- `CalendarService.gs` — cipta/kemaskini/padam *event* Google Calendar bagi
  Mesyuarat & Program (dipanggil dari MeetingService.gs/ProgramService.gs).
- `NotifikasiService.gs` — e-mel digest harian (tindakan tertunggak, dicetuskan oleh pencetus terjadual — rujuk
  `sediakanNotifikasiHarian()` dalam `Code.gs`) DAN `hantarEmelSegera()`
  (dipanggil terus daripada MeetingService.gs).
- `DashboardService.gs` — ringkasan statistik.
- `ProfilService.gs` — Carta Organisasi (`apiCartaOrganisasi`), profil penuh
  (`apiProfilPengguna`), kemaskini/muat naik profil SENDIRI sahaja
  (`apiKemaskiniProfilSendiri`/`apiMuatNaikGambarProfilSendiri`).
- `PerancanganService.gs` — Perancangan Strategik (PS), Pelan Taktikal (PT),
  Pelan Operasi (PO), dan Carta Gantt aktiviti tahunan — setiap satu boleh
  berskop Bidang (merentasi semua panitia) atau satu Panitia tertentu.
- `PencerapanService.gs` — Pencerapan PdP & Semakan Buku Latihan (berskop
  Panitia, sama kebenaran seperti Mesyuarat/Program).
- `AuditService.gs` — catat & semak log audit.
- `appsscript.json`, `Index.html` — manifest & frontend SPA tunggal.

**Nota struktur frontend:** mengikut pendekatan projek `headcount-stpm` dalam
repo yang sama, sistem ini guna **satu `Index.html` sebagai Single Page App**
(navigasi sidebar tukar kandungan tanpa reload) berbanding banyak fail HTML
berasingan bagi setiap paparan — lebih mudah diselenggara kerana banyak
kandungan (borang, jadual, modal) dikongsi antara paparan.

## Cara Pasang (sekali sahaja)

1. **Cipta Google Sheet baharu** (cth. "Data E-Bidang Bahasa"). Projek Apps
   Script ini BERASINGAN daripada E-Bidang Sains & Matematik — jangan guna
   Sheet yang sama.
2. Buka **Extensions → Apps Script** dari Sheet tersebut.
3. Padam kandungan `Code.gs` lalai. Untuk setiap fail `.gs` dalam folder ini
   (`Code.gs`, `Config.gs`, `Utils.gs`, `AuthService.gs`, `UserService.gs`,
   `PanitiaService.gs`, `DriveService.gs`, `DocumentService.gs`,
   `MeetingService.gs`, `ProgramService.gs`,
   `CalendarService.gs`, `NotifikasiService.gs`, `DashboardService.gs`,
   `ProfilService.gs`, `PerancanganService.gs`, `PencerapanService.gs`,
   `AuditService.gs`), cipta fail Script baharu dengan
   nama yang sama (tanpa `.gs`) dan salin-tampal kandungannya.
4. Cipta satu fail HTML baharu bernama **Index** (guna nama tepat ini),
   salin-tampal kandungan `Index.html`.
5. Klik ikon gear ⚙️ **Project Settings**, tandakan *"Show appsscript.json
   manifest file in editor"*, salin-tampal kandungan `appsscript.json` di sini.
6. Kembali ke Sheet, refresh halaman. Menu baharu **"Sistem E-Bidang"** akan
   muncul di bar menu.
7. Klik **Sistem E-Bidang → 1. Sediakan Sistem (Jalankan Sekali)**. Benarkan
   kebenaran yang diminta (Sheets, Drive, Calendar, Gmail/hantar e-mel,
   urus pencetus). Ini mencipta semua 16 Sheet:
   `USERS`, `PANITIA`, `KATEGORI_DOKUMEN`, `DOKUMEN`, `MESYUARAT`,
   `KEHADIRAN_MESYUARAT`, `TINDAKAN_SUSULAN`, `PROGRAM`, `EVIDENS`, `AUDIT_LOG`,
   `PERANCANGAN_STRATEGIK`, `PELAN_TAKTIKAL`, `PELAN_OPERASI`,
   `AKTIVITI_TAHUNAN`, `PENCERAPAN_PDP`, `SEMAKAN_BUKU_LATIHAN`.
8. **Log masuk kali pertama** guna No. KP `000000000000` dan kata laluan
   `000000` (akaun "ADMIN CONTOH"). Sistem akan paksa tukar kata laluan.
9. Tambah pengguna sebenar di menu **Pengguna** (No. KP, Nama, Peranan,
   Panitia, dan **Emel** jika
   mahu pengguna itu menerima notifikasi e-mel). Kata laluan lalai = 6 digit
   terakhir No. KP setiap pengguna. Padam/nyahaktifkan akaun "ADMIN CONTOH"
   selepas admin sebenar ditambah.
10. Tetapkan **Ketua Panitia** setiap panitia di menu **Panitia** (pengguna
    berkenaan mesti sudah didaftarkan dengan Panitia yang sepadan di menu
    Pengguna terlebih dahulu). Setiap staf boleh (dan digalakkan) lengkapkan
    profil sendiri — gambar, jawatan, kelayakan, dsb. — di menu **Profil
    Saya** selepas log masuk, supaya Carta Organisasi lengkap dan berguna.
11. Klik **Deploy → New deployment**. Pilih jenis **Web app**.
    - Execute as: **Me**
    - Who has access: **Anyone** (kawalan sebenar dibuat oleh log masuk
      No.KP/kata laluan sistem, bukan oleh tetapan akses Apps Script)
    - Klik **Deploy**, salin URL yang berakhir dengan `/exec`.
12. Buka fail `bidangbahasa.html` (di root repo laman web ini), gantikan
    `GANTI_DENGAN_EXEC_URL_ANDA` dengan URL sebenar dari langkah 11.
13. **Kongsikan folder Drive induk** ("E-Bidang Bahasa - Fail",
    dicipta secara automatik bersebelahan Google Sheet di atas semasa fail
    pertama dimuat naik) dengan staf berkenaan — pautan fail (`FailUrl`)
    yang dipaparkan dalam sistem hanya boleh dibuka oleh sesiapa yang
    mempunyai akses kepada folder/fail tersebut di Google Drive.
14. **Kongsikan Kalendar "E-Bidang Bahasa"** dengan staf berkenaan —
    dicipta automatik (di bawah akaun Google yang men-deploy sistem) sebaik
    sahaja Mesyuarat/Program pertama disimpan. Buka [Google Calendar](https://calendar.google.com),
    cari kalendar tersebut di bawah "Kalendar Saya", **Tetapan dan perkongsian**,
    kongsikan dengan staf (cth. "Lihat semua butiran acara") supaya tarikh
    mesyuarat/program panitia kelihatan dalam kalendar peribadi mereka.
15. **(Pilihan) Aktifkan notifikasi e-mel harian** — pastikan pengguna
    berkenaan sudah ada Emel diisi (langkah 9), kemudian klik **Sistem
    E-Bidang → 3. Aktifkan Notifikasi E-mel Harian**. `MailApp` tertakluk
    kepada kuota harian akaun Google (~100 e-mel/hari bagi akaun Gmail
    percuma) — memadai bagi bilangan staf sekolah biasa.

## Naik Taraf Deployment Sedia Ada

Selepas menggantikan kandungan fail `.gs`/`Index`/`appsscript.json` dengan
versi terkini, **Deploy semula** pada deployment SEDIA ADA (Deploy → Manage
deployments → Edit (ikon pensel) → Version: New version → Deploy — bukan
"New deployment" yang cipta pautan baharu), kemudian klik **Sistem E-Bidang →
2. Kemaskini Struktur** SEKALI jika versi baharu menambah lajur/Sheet. Selamat
dijalankan berulang kali (tiada kesan jika struktur sudah terkini).

## Struktur Folder Drive

```
E-Bidang Bahasa - Fail/                 (bersebelahan Google Sheet database)
├── Bahasa Melayu/
│   ├── Minit Mesyuarat Panitia/
│   ├── Rancangan Pengajaran Tahunan (RPT)/
│   ├── ...(kategori dokumen lain)
│   └── Evidens Program - <Nama Program>/
├── Bahasa Inggeris/
├── Bahasa Cina/
├── Bahasa Iban/
└── Bahasa Arab/
```

## Skop Semasa & Belum Dilaksanakan

Fokus versi ini ialah **pengurusan fail & governan panitia** (dokumen,
mesyuarat, tindakan susulan, program/PLC) sepertimana diminta — modul
akademik lanjutan berikut **belum** dibina dan boleh ditambah kemudian jika
diperlukan:

- ⏳ Analisis pencapaian akademik pelajar (PBD/peperiksaan) & intervensi murid.

Ciri yang **sudah** dilaksanakan (sebelum ini disenaraikan di sini sebagai
belum dibina): eksport CSV bagi jadual Dokumen/Mesyuarat/Tindakan Susulan/
Program & PLC/Log Audit, notifikasi e-mel segera (bukan sekadar digest
harian) bila Tindakan Susulan baharu ditugaskan, dan pilihan Masa Mula/Tamat (pilihan) bagi Mesyuarat & Program
— rujuk **Ciri Utama** di atas untuk butiran.
