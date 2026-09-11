# Sistem Headcount STPM — SMK Asajaya

Sistem pengurusan & pemantauan pencapaian akademik STPM (Semester 1 →
Ulangan S1 → Semester 2 → Ulangan S2 → Semester 3 → PNGK → GPS), dibina
mengikut *Master Prompt Pembangunan Sistem Headcount STPM* menggunakan
Google Sheets sebagai database dan Google Apps Script sebagai backend.

## Status Pembangunan (Fasa)

Dokumen master prompt memberi amaran supaya pembangunan tidak tergesa-gesa
dan dibuat berperingkat (Seksyen 41 & 45). Fasa yang **telah dilaksanakan**
dalam versi ini:

- ✅ Fasa 1 — Database + Configuration (CONFIG, GRADES, semua Sheet)
- ✅ Fasa 2 — Authentication + Roles (login NoKP+PIN, kawalan akses server-side)
- ✅ Fasa 3 — Student + Subject Management (CRUD + pendaftaran)
- ✅ Fasa 4–6 — Headcount S1 / S2 / S3 (TOV→OTR1→AR1→OTR2→AR2→ETR→SEBENAR,
  gap, status Hijau/Kuning/Merah, trend, risiko — dikira automatik backend)
- ✅ Fasa 7 — Ulangan S1 / S2 (ASAL → INTERVENSI → ULANGAN)
- ✅ Fasa 8 — Intervensi + Impak Intervensi (AR1 → AR2)
- ✅ Fasa 9 — Dashboard (GPK, Guru, Ketua Panitia)
- ✅ Fasa 10 — Laporan (senarai + eksport CSV untuk 9 jenis laporan)
- ✅ Modul 20 — "High Impact Students" (pelajar hampir capai ETR, diutamakan
  yang hanya ada satu subjek kritikal, dengan cadangan tindakan)
- ✅ Modul 21 — What-If Analysis (simulasi anggaran perubahan PNGK/GPS bagi
  satu pelajar/subjek — dilabel "SIMULASI", tidak pernah menulis ke Sheet)
- ✅ **Markah & BLD (Jadual Penentuan Gred) khusus setiap subjek** — Admin/Ketua
  Panitia tetapkan julat markah->gred per mata pelajaran melalui UI (menu
  "Skema Gred (BLD)"). Guru key-in MARKAH sahaja di Headcount (TOV, OTR1, AR1,
  OTR2, AR2, ETR, SEBENAR); Gred diterbitkan automatik oleh backend ikut BLD
  subjek berkenaan. UI papar Markah bersama Gred di semua jadual/laporan
  berkaitan headcount. Rujuk **"Markah & BLD"** di bawah.
- ✅ **Sokongan berbilang batch/kohort (cth. calon STPM 2026 & 2027 serentak)**
  — pemilih **"Tahun STPM"** global di semua paparan berkaitan (Pelajar,
  Headcount, Ulangan, Intervensi, Analisis, Laporan, Dashboard), supaya data
  dua (atau lebih) batch tidak bercampur. Rujuk **"Berbilang Batch/Kohort"**
  di bawah.
- ✅ **ETR-driven headcount (guru hanya isi ETR; TOV/OTR dikira automatik) +
  Markah Ujian berasingan** — guru isi **ETR sahaja** (per pelajar, ikut
  kelas yang diajar) di Headcount; TOV, OTR1, OTR2 diterbitkan automatik
  daripada ETR (rujuk BLD semester berkenaan). AR1, AR2 dan SEBENAR kini
  diisi di **tab "Markah Ujian"** berasingan. Headcount **tidak lagi
  rolling** — setiap semester (S1/S2/S3) berdiri sendiri sepenuhnya. Jadual
  keseluruhan Headcount ada butang paparan **"Ikut Subjek" / "Ikut Kelas"**.
  Rujuk **"Aliran Kerja Headcount (ETR-Driven)"** di bawah.
- ✅ **UI Pendaftaran Subjek (MODUL 4)** — sebelum ini backend sudah ada
  (`apiDaftarSubjek`) tetapi TIADA UI untuk gunakannya, jadi pemilih Kelas di
  Headcount/Markah Ujian sentiasa kosong (kelas hanya "wujud" bagi sistem
  selepas pelajar berdaftar ke subjek). Kini ada panel **"Pendaftaran Subjek"**
  di halaman Pelajar — pendaftaran **pukal ikut kelas** (satu klik daftarkan
  semua pelajar aktif satu kelas ke satu subjek) dan pendaftaran **individu**
  (satu pelajar, satu subjek, dengan senarai + butang batal). Rujuk
  **"Pendaftaran Subjek"** di bawah — **WAJIB dibuat dahulu** sebelum guru
  boleh key-in ETR/Markah Ujian.

**Belum dilaksanakan**:

- ⏳ Ulangan (REPEAT_S1/S2) masih guna Gred teks bebas (bukan Markah+BLD) —
  boleh dilanjutkan kemudian jika diperlukan.
- ⏳ Eksport PDF terus dari sistem (buat masa ini guna Cetak/Print pelayar
  pada jadual/laporan sedia ada, atau eksport CSV lalu buka di Excel/Sheets)
- ⏳ Fasa 11 (Testing rasmi oleh pengguna sekolah) & Fasa 12 (Deployment) —
  langkah pemasangan diberikan di bawah, tetapi ujian data sebenar & deployment
  akhir perlu dibuat oleh admin sekolah.

## Struktur

- `Code.gs`, `Config.gs`, `Utils.gs`, `AuditService.gs`, `AuthService.gs`,
  `StudentService.gs`, `SubjectService.gs`, `GradeBoundaryService.gs`,
  `HeadcountService.gs`, `AnalysisService.gs`, `RepeatService.gs`,
  `InterventionService.gs`, `DashboardService.gs`, `ReportService.gs`,
  `HighImpactService.gs`, `WhatIfService.gs`, `appsscript.json`, `Index.html`
  — projek Google Apps Script (backend modular + frontend SPA tunggal).
- `../../headcountstpm.html` — pembungkus GitHub Pages (iframe) untuk sistem ini.

**Nota mengenai struktur fail frontend:** Master prompt mencadangkan fail HTML
berasingan (Login.html, Dashboard.html, Students.html, dsb.). Selepas mengambil
kira Seksyen 24 ("Jika struktur fail Apps Script memerlukan pendekatan lain,
pilih struktur yang paling maintainable"), sistem ini menggunakan **satu
Index.html sebagai Single Page App** (navigasi sidebar bertukar kandungan tanpa
reload) — lebih mudah diselenggara berbanding 9 fail HTML berasingan yang
kongsi banyak kod sama, sementara backend kekal dipecahkan mengikut modul
sepenuhnya seperti diminta.

## Cara Pasang (sekali sahaja)

1. **Cipta Google Sheet baharu** (cth. "Data Headcount STPM SMK Asajaya").
2. Buka **Extensions → Apps Script** dari Sheet tersebut.
3. Padam kandungan `Code.gs` lalai. Untuk setiap fail `.gs` dalam folder ini
   (`Code.gs`, `Config.gs`, `Utils.gs`, `AuditService.gs`, `AuthService.gs`,
   `StudentService.gs`, `SubjectService.gs`, `GradeBoundaryService.gs`,
   `HeadcountService.gs`, `AnalysisService.gs`, `RepeatService.gs`,
   `InterventionService.gs`, `DashboardService.gs`, `ReportService.gs`,
   `HighImpactService.gs`, `WhatIfService.gs`), cipta fail Script baharu dengan
   nama yang sama (tanpa `.gs`) dan salin-tampal kandungannya.

   **Jika projek Apps Script anda sudah wujud** (kemaskini daripada versi
   sebelumnya):
   1. Tambah fail Script baharu bernama `GradeBoundaryService` (dan
      `HighImpactService`/`WhatIfService` jika belum ada), salin-tampal
      kandungan `.gs` masing-masing.
   2. **Gantikan** kandungan semua fail `.gs` sedia ada (terutamanya
      `Config.gs`, `AnalysisService.gs`, `HeadcountService.gs`,
      `GradeBoundaryService.gs`, `InterventionService.gs`, `DashboardService.gs`,
      `ReportService.gs`, `WhatIfService.gs`, `Code.gs`) dengan versi terkini
      dalam folder ini — struktur headcount berubah daripada "Gred sahaja"
      kepada "Markah + Gred", dan BLD kini per **Subjek x Semester** (bukan
      per subjek sahaja).
   3. **Gantikan** kandungan `Index` dengan `Index.html` versi terkini (ada
      menu "Skema Gred (BLD)" baharu dengan pemilih Semester, borang
      Headcount kini minta Markah).
   4. Kembali ke Sheet, refresh, klik **Sistem Headcount STPM → 2. Kemaskini
      Struktur (Markah & Gred BLD)**. Ini (a) mencipta Sheet `GRADE_BOUNDARIES`
      jika belum wujud ATAU tambah lajur `Semester` jika sudah wujud (BLD
      sedia ada diandaikan untuk S1 — **WAJIB semak & salin/laraskan untuk
      S2/S3** selepas ini di menu "Skema Gred (BLD)"), dan (b) menukar
      struktur lajur `HEADCOUNT_S1/S2/S3` kepada Markah+Gred (data Gred
      sedia ada, jika ada, dikekalkan) — rujuk **"Markah & BLD"** di bawah
      untuk butiran. Selamat dijalankan berulang kali.
   5. Deploy semula (**Deploy → Manage deployments → Edit → New version**).

   **Kemaskini terkini (ETR-driven headcount + tab Markah Ujian):** tiada
   perubahan struktur Sheet — cukup **gantikan** kandungan `Config.gs`,
   `AnalysisService.gs`, `StudentService.gs`, `HeadcountService.gs` dan
   `Index` dengan versi terkini, kemudian deploy semula. Tiada langkah
   migrasi Sheet diperlukan untuk kemaskini ini.
4. Cipta satu fail HTML baharu bernama **Index** (guna nama tepat ini),
   salin-tampal kandungan `Index.html`.
5. Klik ikon gear ⚙️ **Project Settings**, tandakan *"Show appsscript.json
   manifest file in editor"*, salin-tampal kandungan `appsscript.json` di sini.
6. Kembali ke Sheet, refresh halaman. Menu baharu **"Sistem Headcount STPM"**
   akan muncul di bar menu.
7. Klik **Sistem Headcount STPM → 1. Sediakan Sistem (Jalankan Sekali)**.
   Benarkan kebenaran yang diminta. Ini mencipta semua 15 Sheet: `CONFIG`,
   `GRADES`, `GRADE_BOUNDARIES`, `USERS`, `STUDENTS`, `SUBJECTS`, `ENROLLMENTS`,
   `HEADCOUNT_S1/S2/S3`, `REPEAT_S1/S2`, `INTERVENTIONS`, `INTERVENTION_LOG`, `AUDIT_LOG`.
8. **Kemaskini data sebenar sekolah** terus dalam Sheet:
   - `CONFIG`: nama sekolah, tahun STPM aktif, sasaran GPS/PNGK, threshold gap/risiko.
   - `GRADES`: senarai gred & nilai gred rasmi sekolah (boleh ubah tanpa sentuh kod).
   - `USERS`: satu baris setiap pengguna (No. KP, PIN, Peranan, Nama, Skop Subjek
     untuk Guru/Ketua Panitia — kod subjek dipisah koma). Padam baris "ADMIN CONTOH"
     selepas tambah admin sebenar.
   - `STUDENTS`, `SUBJECTS`, `ENROLLMENTS`: data pelajar, mata pelajaran dan
     pendaftaran sebenar. Padam baris "CONTOH".
   - **`GRADE_BOUNDARIES` (BLD)**: WAJIB tetapkan julat markah->gred bagi
     **SETIAP** mata pelajaran sebelum guru boleh key-in markah subjek itu —
     paling mudah terus di menu **"Skema Gred (BLD)"** dalam sistem (bukan
     dalam Sheet secara terus), supaya validasi (julat tidak bertindih,
     0-100) dikuatkuasakan. Sheet baru ada contoh untuk subjek `PA` sahaja.
9. Klik **Deploy → New deployment**. Pilih jenis **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy**, salin URL yang berakhir dengan `/exec`.
10. Buka fail `headcountstpm.html` (di root repo laman web ini), gantikan
    `GANTI_DENGAN_EXEC_URL_ANDA` dengan URL sebenar dari langkah 9.

## Peranan & Kebenaran (MODUL 1, 31)

| Peranan | Akses |
| --- | --- |
| `ADMIN` | Penuh, termasuk urus pengguna & lihat audit log |
| `GPK_TINGKATAN6` | Urus penuh pelajar/subjek/headcount, dashboard GPK |
| `KETUA_AKADEMIK` | Sama seperti GPK (akses analisis akademik penuh) |
| `KETUA_PANITIA` | Terhad kepada subjek dalam `SkopSubjek`, dashboard panitia |
| `GURU` | Terhad kepada subjek dalam `SkopSubjek`. Isi **ETR** (Headcount) dan **AR1/AR2/SEBENAR** (Markah Ujian) sahaja — TOV/OTR1/OTR2 diterbitkan automatik, tidak boleh ditaip terus oleh sesiapa |

Semua semakan kebenaran dibuat di **server** (`wajibPeranan()` dalam setiap
Service), bukan hanya disembunyikan di frontend — selaras MODUL 31.

## Prinsip Pengiraan (MODUL 43)

Semua pengiraan (Gap, Status Hijau/Kuning/Merah, Trend, Risiko, PNGK, GPS)
dibuat **sepenuhnya di backend** dalam `AnalysisService.gs`, berdasarkan nilai
dalam Sheet `GRADES` dan `CONFIG` — tiada nilai di-hard-code. Frontend
(`Index.html`) hanya memaparkan hasil yang dipulangkan server.

## Audit & Sejarah TOV (MODUL 3, 27)

Setiap tindakan TAMBAH/KEMASKINI/NYAHAKTIF/LOGIN direkod dalam `AUDIT_LOG`
(tarikh, pengguna, peranan, modul, nilai lama/baharu, sebab). Semakan boleh
dibuat terus dalam Sheet `AUDIT_LOG` atau melalui `apiSenaraiAudit`.

## Markah & BLD (Jadual Penentuan Gred khusus setiap Subjek x Semester)

Setiap mata pelajaran ada julat markah→gred sendiri (BLD), **DAN julat itu
boleh berbeza mengikut semester** (S1, S2, S3) bagi subjek yang sama — cth.
skema markah Pengajian Am Semester 1 tak semestinya sama dengan Semester 3.
Aliran kerja:

1. **Admin / GPK / Ketua Akademik / Ketua Panitia** tetapkan BLD di menu
   **"Skema Gred (BLD)"** — pilih **Semester** (S1/S2/S3) di bahagian atas
   dahulu, kemudian untuk setiap Gred masukkan Markah Min & Markah Max
   (0-100) bagi subjek itu **pada semester tersebut sahaja**. Sistem menolak
   julat yang bertindih dalam subjek+semester yang sama. Ketua Panitia hanya
   boleh urus subjek dalam `SkopSubjek` mereka sendiri.
   - Guna **"Salin BLD"** untuk salin julat sedia ada ke subjek lain, ke
     semester lain bagi subjek yang sama (cth. jadikan BLD S1 sebagai titik
     mula untuk S2), atau kedua-duanya sekali.
2. **Guru / Admin** key-in **MARKAH** (bukan Gred) — **ETR** di halaman
   **Headcount** (panel "Isi ETR"), **AR1/AR2/SEBENAR** di tab **"Markah
   Ujian"**. TOV, OTR1, OTR2 tidak ditaip terus oleh sesiapa — rujuk
   **"Aliran Kerja Headcount (ETR-Driven)"** di bawah.
3. Backend (`HeadcountService.gs` → `apiSimpanHeadcount`) **menterjemah
   Markah ke Gred secara automatik** menggunakan BLD subjek+semester berkenaan
   (`AnalysisService.gs` → `gredDaripadaMarkah`), dan menyimpan **kedua-duanya**
   (cth. lajur `AR1_Markah` = `72`, `AR1_Gred` = `B`).
4. Jika BLD subjek+semester belum lengkap (atau markah tiada dalam mana-mana
   julat ditetapkan), sistem **menolak simpanan** dengan mesej ralat yang
   jelas, memandu pengguna ke menu "Skema Gred (BLD)" — headcount tidak akan
   tersimpan dengan Gred kosong secara senyap. **Penting:** BLD mesti
   ditetapkan berasingan untuk SETIAP semester (S1, S2, S3) — bukan sekali
   sahaja untuk seluruh subjek.
5. Semua paparan (Headcount, Dashboard Guru, High Impact Students, What-If,
   Laporan/CSV) memaparkan **Markah bersama Gred**, cth. `72 (B)`.

Semua pengiraan lanjutan (Gap, Trend, Risiko, PNGK, GPS) tetap berasaskan
**Gred** (nilai gred daripada Sheet `GRADES`, bukan markah mentah) — selaras
MODUL 43, supaya kaedah pengiraan konsisten walaupun BLD berbeza antara
subjek/semester.

**Skop semasa:** Ulangan (`REPEAT_S1/S2`) masih guna Gred teks bebas, belum
disambungkan kepada Markah+BLD — boleh dilanjutkan jika sekolah memerlukannya.

## Pendaftaran Subjek (MODUL 4)

**Langkah ini WAJIB dibuat dahulu** (selepas Pelajar & Mata Pelajaran diisi,
sebelum sesiapa cuba key-in ETR/AR1/AR2/SEBENAR) — jika tidak, pemilih
**Kelas** di Headcount ("Isi ETR") dan tab "Markah Ujian" akan sentiasa
**kosong**, kerana kedua-duanya membina senarai Kelas daripada siapa yang
sudah berdaftar ke subjek berkenaan (`ENROLLMENTS`), bukan daripada Sheet
`STUDENTS` terus.

Di halaman **Pelajar**, panel **"Pendaftaran Subjek"** ada dua cara:

1. **Pukal (ikut Kelas)** — pilih Kod Subjek + Kelas + Tahun STPM, klik
   **"Daftarkan Kelas Ini"**. Semua pelajar **AKTIF** dalam kelas itu terus
   didaftarkan ke subjek tersebut sekali gus. Pelajar yang sudah berdaftar
   dilangkau secara automatik (bukan ralat) — selamat diklik berulang kali,
   cth. selepas tambah pelajar baharu ke kelas yang sama.
2. **Individu** — untuk kes pelajar ambil subjek berbeza daripada rakan
   sekelas (cth. elektif). Taip/pilih ID Pelajar (senarai cadangan nama
   disediakan), pilih Kod Subjek, klik **Daftar**. Senarai subjek pelajar
   itu terus dipaparkan di bawah, dengan pautan **×** untuk batalkan
   pendaftaran.

Backend: `apiDaftarSubjekPukal` (StudentService.gs) untuk pukal,
`apiDaftarSubjek`/`apiBatalDaftarSubjek`/`apiSenaraiPendaftaran` (sedia ada)
untuk individu. Semua tindakan direkod dalam `AUDIT_LOG`.

## Aliran Kerja Headcount (ETR-Driven)

Headcount **tidak lagi rolling** — TOV, OTR1, OTR2 dan ETR bagi setiap
semester (S1, S2, S3) adalah **berdiri sendiri sepenuhnya**, tidak diwarisi
daripada semester sebelumnya. Aliran kerja diringkaskan kepada:

1. **Guru** (atau Admin/GPK/Ketua Akademik/Ketua Panitia) pergi ke
   **Headcount → panel "Isi ETR"** — pilih Subjek, kemudian Kelas (senarai
   kelas diambil terus daripada pendaftaran sebenar bagi subjek itu, jadi
   guru hanya nampak kelas yang benar-benar dia ajar). Jadual senarai
   pelajar kelas itu dipaparkan; guru taip **Markah ETR** bagi setiap
   pelajar (auto-simpan bila pindah fokus/"blur" daripada kotak input).
2. Backend (`HeadcountService.gs` → `apiSimpanETR`) terbitkan Gred ETR
   daripada BLD Semester berkenaan, kemudian **kira TOV, OTR1, OTR2
   automatik** — progresif, setiap satu tingkat gred tersendiri:
   - `TOV` = **3 gred di bawah ETR**
   - `OTR1` = **2 gred di bawah ETR**
   - `OTR2` = **1 gred di bawah ETR** (paling hampir ETR — sasaran menaik
     sepanjang semester: TOV → OTR1 → OTR2 → ETR)
   - "N gred di bawah" dikira mengikut kedudukan dalam Sheet `GRADES`
     (tersusun ikut `NilaiGred`, **data-driven, tiada huruf gred
     di-hard-code** — MODUL 43), jadi ia ikut skema gred sekolah sebenar,
     bukan senarai tetap dalam kod.
   - Markah bagi TOV/OTR1/OTR2 yang diterbitkan diambil daripada **Markah
     Minimum** gred berkenaan dalam BLD Semester itu (anggaran — bukan
     keputusan ujian sebenar).
   - Jika BLD Semester+Subjek belum lengkap, simpanan ETR **ditolak** dengan
     mesej memandu ke menu "Skema Gred (BLD)".
3. Guru pergi ke tab **"Markah Ujian"** (nav berasingan) untuk isi **AR1**
   (Ujian 1) dan **AR2** (Ujian 2) sebagai **Markah** (Gred diterbitkan
   daripada BLD Semester berkenaan, sama seperti ETR), serta **SEBENAR**
   (keputusan rasmi) yang dipilih terus sebagai **Gred** (dropdown, bukan
   Markah) — slip keputusan STPM sebenar hanya menyatakan gred, jadi tiada
   BLD terlibat bagi SEBENAR. Corak pemilihan Subjek → Kelas sama, jadual
   pelajar sama, auto-simpan yang sama ("blur" untuk input Markah, "change"
   untuk dropdown Gred) (`apiSimpanHeadcount`).
4. Jadual **"Headcount Semester … — Keseluruhan"** (bawah panel Isi ETR)
   memaparkan semua rekod, dengan butang **"Ikut Subjek" / "Ikut Kelas"**
   untuk tukar cara ia dikumpulkan/disusun — tiada panggilan data tambahan,
   sekadar susunan semula paparan sedia ada.

## Berbilang Batch/Kohort (cth. STPM 2026 & 2027 serentak)

Struktur data (`STUDENTS`, `ENROLLMENTS`, `HEADCOUNT_S1/S2/S3`, `REPEAT_S1/S2`)
sememangnya menyimpan `TahunSTPM` sebagai sebahagian ID unik setiap rekod
(MODUL 4), jadi dua atau lebih batch **boleh wujud serentak** dalam satu
Sheet database yang sama tanpa konflik — cth. semasa fasa peralihan, calon
STPM 2026 masih dalam Semester 3/ulangan sementara calon STPM 2027 baru mula
didaftarkan untuk Semester 1.

Untuk elak data batch bercampur di paparan/laporan, setiap halaman berkaitan
kini ada pemilih **"Tahun STPM"** di bahagian atas (sebelah pemilih Semester,
jika berkenaan):

| Halaman | Ditapis ikut Tahun STPM? |
| --- | --- |
| Dashboard (GPK & Guru) | ✅ |
| Pelajar | ✅ |
| Headcount | ✅ |
| Ulangan | ✅ |
| Intervensi (senarai + impak) | ✅ |
| Analisis → Pelajar Impak Tinggi | ✅ |
| Laporan (semua 9 jenis) | ✅ |
| Mata Pelajaran, Skema Gred (BLD), Pengguna | Tidak berkenaan — subjek/BLD/pengguna dikongsi merentasi semua batch |
| Analisis → Simulasi What-If | Tidak berkenaan — dikendalikan terus melalui ID Pelajar tertentu |

Pilihan **"Semua Tahun"** (nilai kosong) sentiasa tersedia untuk pandangan
merentasi batch (cth. Admin nak lihat jumlah keseluruhan). Borang tambah
pelajar/headcount/ulangan pra-isi Tahun STPM mengikut pemilih global semasa,
tetapi masih boleh diubah secara manual jika perlu masukkan data batch lain.

Tiada tetapan tambahan diperlukan — cukup pastikan lajur `TahunSTPM` diisi
dengan betul (cth. `2026`, `2027`) semasa mendaftar pelajar setiap batch.
