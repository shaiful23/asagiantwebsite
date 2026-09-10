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
      `InterventionService.gs`, `DashboardService.gs`, `ReportService.gs`,
      `WhatIfService.gs`, `Code.gs`) dengan versi terkini dalam folder ini —
      struktur headcount berubah daripada "Gred sahaja" kepada "Markah + Gred".
   3. **Gantikan** kandungan `Index` dengan `Index.html` versi terkini (ada
      menu "Skema Gred (BLD)" baharu, borang Headcount kini minta Markah).
   4. Kembali ke Sheet, refresh, klik **Sistem Headcount STPM → 2. Kemaskini
      Struktur (Markah & Gred BLD)**. Ini mencipta Sheet `GRADE_BOUNDARIES`
      dan menukar struktur lajur `HEADCOUNT_S1/S2/S3` kepada Markah+Gred
      (data Gred sedia ada, jika ada, dikekalkan — rujuk **"Markah & BLD"**
      di bawah untuk butiran).
   5. Deploy semula (**Deploy → Manage deployments → Edit → New version**).
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
| `GURU` | Terhad kepada subjek dalam `SkopSubjek`, hanya boleh isi AR1/AR2 |

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

## Markah & BLD (Jadual Penentuan Gred khusus setiap subjek)

Setiap mata pelajaran ada julat markah→gred sendiri (BLD), sebab kesukaran
soalan/pemoderatan berbeza antara subjek. Aliran kerja:

1. **Admin / GPK / Ketua Akademik / Ketua Panitia** tetapkan BLD subjek di menu
   **"Skema Gred (BLD)"** — untuk setiap Gred, masukkan Markah Min & Markah Max
   (0-100). Sistem menolak julat yang bertindih dalam subjek yang sama. Ketua
   Panitia hanya boleh urus subjek dalam `SkopSubjek` mereka sendiri.
   - Guna **"Salin BLD Antara Subjek"** jika beberapa subjek berkongsi julat
     markah yang sama (elak taip berulang).
2. **Guru / Admin** key-in **MARKAH** (bukan Gred) di halaman **Headcount**,
   bagi mana-mana daripada 7 medan (TOV, OTR1, AR1, OTR2, AR2, ETR, SEBENAR).
   Guru hanya boleh isi AR1/AR2 (sama seperti sebelum ini).
3. Backend (`HeadcountService.gs` → `apiSimpanHeadcount`) **menterjemah
   Markah ke Gred secara automatik** menggunakan BLD subjek berkenaan
   (`AnalysisService.gs` → `gredDaripadaMarkah`), dan menyimpan **kedua-duanya**
   (cth. lajur `AR1_Markah` = `72`, `AR1_Gred` = `B`).
4. Jika BLD subjek belum lengkap (atau markah tiada dalam mana-mana julat
   ditetapkan), sistem **menolak simpanan** dengan mesej ralat yang jelas,
   memandu pengguna ke menu "Skema Gred (BLD)" — headcount tidak akan
   tersimpan dengan Gred kosong secara senyap.
5. Semua paparan (Headcount, Dashboard Guru, High Impact Students, What-If,
   Laporan/CSV) memaparkan **Markah bersama Gred**, cth. `72 (B)`.

Semua pengiraan lanjutan (Gap, Trend, Risiko, PNGK, GPS) tetap berasaskan
**Gred** (nilai gred daripada Sheet `GRADES`, bukan markah mentah) — selaras
MODUL 43, supaya kaedah pengiraan konsisten walaupun BLD berbeza antara subjek.

**Skop semasa:** Ulangan (`REPEAT_S1/S2`) masih guna Gred teks bebas, belum
disambungkan kepada Markah+BLD — boleh dilanjutkan jika sekolah memerlukannya.

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
