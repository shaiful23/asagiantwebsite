# Sistem E-Bidang Sains & Matematik — SMK Asajaya

Sistem pengurusan fail digital bagi **Bidang Sains & Matematik** (Panitia
Matematik, Sains, Kimia, Biologi, Fizik), dibina menggunakan Google Sheets
sebagai database dan Google Apps Script sebagai backend + frontend
(satu Web App SPA).

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
  | `KETUA_PANITIA` | Terhad kepada panitia sendiri; boleh urus mesyuarat, tindakan susulan, program & fail panitia sendiri |
  | `GURU` | Terhad kepada panitia sendiri; boleh muat naik/lihat fail, lihat mesyuarat/program, kemaskini status tindakan yang ditugaskan kepadanya |
  | `PEMBANTU_MAKMAL` | Tiada panitia sendiri; lihat & proses Pesanan Radas & Bahan Makmal merentasi SEMUA panitia makmal (Sains/Kimia/Biologi/Fizik) sahaja — tiada akses ke Dokumen/Mesyuarat/Program/Panitia/Pengguna/Audit |

- **Pengurusan Fail Panitia** (modul teras) — kategori dokumen berpiawai
  (Minit Mesyuarat, RPT, Takwim, Pekeliling, Laporan Program, Instrumen
  Pentaksiran, Analisis Peperiksaan, Fail Kewangan), setiap fail dimuat naik
  terus ke Google Drive (struktur folder **Induk → Panitia → Kategori**) dan
  direkod dalam Sheet `DOKUMEN`. **Checklist kelengkapan fail** memaparkan
  peratus kategori wajib yang sudah lengkap bagi setiap panitia.
- **Mesyuarat Panitia** — minit (fail Drive), kehadiran ahli, dan tindakan
  susulan (status Belum Mula/Dalam Proses/Selesai, tanggungjawab, tarikh akhir).
- **Program & PLC** — rekod program/aktiviti panitia (termasuk sesi PLC)
  berserta evidens pelaksanaan (fail Drive).
- **Dashboard** — ringkasan kelengkapan fail, mesyuarat akan datang &
  tindakan tertunggak bagi setiap panitia (dalam skop akses peranan semasa),
  serta senarai tindakan susulan peribadi.
- **Log Audit** — setiap tindakan TAMBAH/KEMASKINI/PADAM/LOGIN/tukar kata
  laluan direkod (Admin/Ketua Bidang sahaja boleh semak).
- **Pesanan Radas & Bahan Makmal** (Panitia Sains/Kimia/Biologi/Fizik sahaja —
  Matematik tidak menjalankan eksperimen makmal) — Guru/Ketua Panitia
  panitia berkenaan membuat pesanan (kelas, tajuk eksperimen, tarikh
  diperlukan, senarai bahan/radas dengan kuantiti & unit, baris boleh
  ditambah/dibuang secara dinamik). Peranan `PEMBANTU_MAKMAL` (+
  Admin/Ketua Bidang) melihat & memproses pesanan merentasi semua panitia
  makmal, menukar status (Menunggu → Dalam Proses → Siap, atau Ditolak) dan
  mencatat nota pemprosesan. Pemohon (atau Ketua Panitia/Admin/Ketua Bidang
  bagi panitia berkenaan) boleh **menyunting atau membatalkan** pesanan
  sendiri selagi masih berstatus Menunggu — selepas pemprosesan bermula,
  pembetulan perlu dibuat terus bersama Pembantu Makmal. **Borang formal**
  (dengan logo sekolah, no. rujukan, jadual bahan/radas, dan blok
  tandatangan Guru/Ketua Panitia/Pembantu Makmal) dijana terus di pelayar
  dan dicetak/dimuat turun sebagai PDF melalui dialog cetak pelayar (butang
  "Cetak / PDF").
- **Kalendar Bersepadu (Google Calendar)** — setiap Mesyuarat dan Program/PLC
  disegerakkan secara automatik sebagai *event* sehari (atau julat hari bagi
  Program dengan Tarikh Tamat) ke satu Kalendar Google khusus bernama
  **"E-Bidang Sains & Matematik"**, dicipta automatik (di bawah akaun Google
  yang men-deploy sistem) apabila mesyuarat/program pertama disimpan.
  Kemaskini/padam rekod turut mengemaskini/memadam *event* berkaitan.
  Kongsikan kalendar ini dengan staf (rujuk **Cara Pasang** langkah 14) —
  kegagalan penyegerakan Kalendar (cth. kuota) tidak menghalang mesyuarat/
  program itu sendiri daripada disimpan.
- **Notifikasi E-mel Harian** — pencetus terjadual (diaktifkan sekali melalui
  menu Sheet) menghantar e-mel setiap hari lebih kurang jam 7 pagi kepada:
  (a) guru/ketua panitia yang mempunyai **Tindakan Susulan** tertunggak/tamat
  tempoh, dan (b) Pembantu Makmal/Admin/Ketua Bidang jika ada **Pesanan
  Makmal** berstatus Menunggu. Hanya pengguna dengan lajur **Emel** diisi
  (menu Pengguna) akan menerima notifikasi — pengguna lain dilangkau senyap.

## Struktur

- `Code.gs` — menu Sheet, `sediakanSistemEBidang()`, `doGet()`.
- `Config.gs` — nama Sheet, peranan, senarai panitia, kategori dokumen lalai.
- `Utils.gs` — utiliti baca/tulis Sheet, ID, tarikh (guna oleh semua Service).
- `AuthService.gs` — log masuk, sesi (CacheService), tukar kata laluan sendiri.
- `UserService.gs` — urus pengguna (Admin/Ketua Bidang), set semula kata laluan.
- `PanitiaService.gs` — urus penetapan Ketua Panitia bagi 5 panitia tetap.
- `DriveService.gs` — struktur folder Drive (Induk → Panitia → Kategori).
- `DocumentService.gs` — kategori dokumen, dokumen, checklist kelengkapan fail.
- `MeetingService.gs` — mesyuarat, kehadiran, tindakan susulan.
- `ProgramService.gs` — program/PLC & evidens.
- `PesananMakmalService.gs` — Pesanan Radas & Bahan Makmal (cipta/sunting/batal
  oleh Guru/Ketua Panitia; kemaskini status/padam oleh Pembantu Makmal/Admin/Ketua Bidang).
- `CalendarService.gs` — cipta/kemaskini/padam *event* Google Calendar bagi
  Mesyuarat & Program (dipanggil dari MeetingService.gs/ProgramService.gs).
- `NotifikasiService.gs` — e-mel harian (tindakan tertunggak + pesanan makmal
  menunggu), dicetuskan oleh pencetus terjadual — rujuk `sediakanNotifikasiHarian()`
  dalam `Code.gs`.
- `DashboardService.gs` — ringkasan statistik (termasuk ringkasan Pesanan Makmal).
- `AuditService.gs` — catat & semak log audit.
- `appsscript.json`, `Index.html` — manifest & frontend SPA tunggal.

**Nota struktur frontend:** mengikut pendekatan projek `headcount-stpm` dalam
repo yang sama, sistem ini guna **satu `Index.html` sebagai Single Page App**
(navigasi sidebar tukar kandungan tanpa reload) berbanding banyak fail HTML
berasingan bagi setiap paparan — lebih mudah diselenggara kerana banyak
kandungan (borang, jadual, modal) dikongsi antara paparan.

## Cara Pasang (sekali sahaja)

1. **Cipta Google Sheet baharu** (cth. "Data E-Bidang Sains & Matematik").
2. Buka **Extensions → Apps Script** dari Sheet tersebut.
3. Padam kandungan `Code.gs` lalai. Untuk setiap fail `.gs` dalam folder ini
   (`Code.gs`, `Config.gs`, `Utils.gs`, `AuthService.gs`, `UserService.gs`,
   `PanitiaService.gs`, `DriveService.gs`, `DocumentService.gs`,
   `MeetingService.gs`, `ProgramService.gs`, `PesananMakmalService.gs`,
   `CalendarService.gs`, `NotifikasiService.gs`, `DashboardService.gs`,
   `AuditService.gs`), cipta fail Script baharu dengan nama yang sama (tanpa
   `.gs`) dan salin-tampal kandungannya.
4. Cipta satu fail HTML baharu bernama **Index** (guna nama tepat ini),
   salin-tampal kandungan `Index.html`.
5. Klik ikon gear ⚙️ **Project Settings**, tandakan *"Show appsscript.json
   manifest file in editor"*, salin-tampal kandungan `appsscript.json` di sini.
6. Kembali ke Sheet, refresh halaman. Menu baharu **"Sistem E-Bidang"** akan
   muncul di bar menu.
7. Klik **Sistem E-Bidang → 1. Sediakan Sistem (Jalankan Sekali)**. Benarkan
   kebenaran yang diminta (Sheets, Drive, Calendar, Gmail/hantar e-mel,
   urus pencetus). Ini mencipta semua 12 Sheet:
   `USERS`, `PANITIA`, `KATEGORI_DOKUMEN`, `DOKUMEN`, `MESYUARAT`,
   `KEHADIRAN_MESYUARAT`, `TINDAKAN_SUSULAN`, `PROGRAM`, `EVIDENS`, `AUDIT_LOG`,
   `PESANAN_MAKMAL`, `ITEM_PESANAN_MAKMAL`.
8. **Log masuk kali pertama** guna No. KP `000000000000` dan kata laluan
   `000000` (akaun "ADMIN CONTOH"). Sistem akan paksa tukar kata laluan.
9. Tambah pengguna sebenar di menu **Pengguna** (No. KP, Nama, Peranan,
   Panitia, dan **Emel** jika mahu pengguna itu menerima notifikasi e-mel).
   Kata laluan lalai = 6 digit terakhir No. KP setiap pengguna. Padam/
   nyahaktifkan akaun "ADMIN CONTOH" selepas admin sebenar ditambah. Tambah
   sekurang-kurangnya seorang pengguna berperanan **Pembantu Makmal** untuk
   memproses Pesanan Radas & Bahan.
10. Tetapkan **Ketua Panitia** setiap panitia di menu **Panitia** (pengguna
    berkenaan mesti sudah didaftarkan dengan Panitia yang sepadan di menu
    Pengguna terlebih dahulu).
11. Klik **Deploy → New deployment**. Pilih jenis **Web app**.
    - Execute as: **Me**
    - Who has access: **Anyone** (kawalan sebenar dibuat oleh log masuk
      No.KP/kata laluan sistem, bukan oleh tetapan akses Apps Script)
    - Klik **Deploy**, salin URL yang berakhir dengan `/exec`.
12. Buka fail `ebidang.html` (di root repo laman web ini), gantikan
    `GANTI_DENGAN_EXEC_URL_ANDA` dengan URL sebenar dari langkah 11.
13. **Kongsikan folder Drive induk** ("E-Bidang Sains & Matematik - Fail",
    dicipta secara automatik bersebelahan Google Sheet di atas semasa fail
    pertama dimuat naik) dengan staf berkenaan — pautan fail (`FailUrl`)
    yang dipaparkan dalam sistem hanya boleh dibuka oleh sesiapa yang
    mempunyai akses kepada folder/fail tersebut di Google Drive.
14. **Kongsikan Kalendar "E-Bidang Sains & Matematik"** dengan staf berkenaan —
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

Jika sistem ini sudah dideploy **sebelum** ciri Pesanan Makmal/Emel/Kalendar/
Notifikasi ditambah: gantikan kandungan semua fail `.gs` dan `Index`/
`appsscript.json` dengan versi terkini (termasuk fail baharu
`PesananMakmalService.gs`, `CalendarService.gs`, `NotifikasiService.gs`),
**Deploy semula** (Deploy → Manage deployments → Edit → New version), kemudian
klik **Sistem E-Bidang → 2. Kemaskini Struktur (Emel & Kalendar)** SEKALI
sahaja — ini menambah lajur `Emel` (USERS) dan `EventIdKalendar`
(MESYUARAT/PROGRAM) yang hilang tanpa menjejaskan data sedia ada. Selamat
dijalankan berulang kali (tiada kesan jika struktur sudah terkini).

## Struktur Folder Drive

```
E-Bidang Sains & Matematik - Fail/      (bersebelahan Google Sheet database)
├── Matematik/
│   ├── Minit Mesyuarat Panitia/
│   ├── Rancangan Pengajaran Tahunan (RPT)/
│   ├── ...(kategori dokumen lain)
│   └── Evidens Program - <Nama Program>/
├── Sains/
├── Kimia/
├── Biologi/
└── Fizik/
```

## Skop Semasa & Belum Dilaksanakan

Fokus versi ini ialah **pengurusan fail & governan panitia** (dokumen,
mesyuarat, tindakan susulan, program/PLC) sepertimana diminta — modul
akademik lanjutan berikut **belum** dibina dan boleh ditambah kemudian jika
diperlukan:

- ⏳ Analisis pencapaian akademik pelajar (PBD/peperiksaan) & intervensi murid.
- ⏳ Eksport laporan (PDF/CSV) bagi jadual lain (Dokumen, Mesyuarat, dsb.) —
  buat masa ini guna Cetak/Print pelayar pada jadual sedia ada. Borang
  Pesanan Radas & Bahan Makmal sahaja yang mempunyai reka bentuk cetak
  formal khusus (dengan logo sekolah) buat masa ini.
- ⏳ Notifikasi e-mel semasa (segera bila status berubah) — buat masa ini
  notifikasi berbentuk **digest harian** sahaja (rujuk "Notifikasi E-mel
  Harian" di atas), bukan setiap kali satu rekod berubah.
- ⏳ Pilihan masa (bukan sekadar tarikh) bagi Mesyuarat/Program — *event*
  Kalendar yang disegerakkan buat masa ini sentiasa "sehari penuh" (all-day)
  kerana borang sedia ada hanya kumpul tarikh, bukan masa.
