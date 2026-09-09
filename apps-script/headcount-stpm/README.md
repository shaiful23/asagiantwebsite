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

**Belum dilaksanakan** (dicadangkan sebagai fasa akan datang, bukan sebahagian
roadmap 12 fasa dokumen asal):

- ⏳ Modul 20 — "High Impact Students"
- ⏳ Modul 21 — What-If Analysis / Simulasi
- ⏳ Eksport PDF terus dari sistem (buat masa ini guna Cetak/Print pelayar
  pada jadual/laporan sedia ada, atau eksport CSV lalu buka di Excel/Sheets)
- ⏳ Fasa 11 (Testing rasmi oleh pengguna sekolah) & Fasa 12 (Deployment) —
  langkah pemasangan diberikan di bawah, tetapi ujian data sebenar & deployment
  akhir perlu dibuat oleh admin sekolah.

## Struktur

- `Code.gs`, `Config.gs`, `Utils.gs`, `AuditService.gs`, `AuthService.gs`,
  `StudentService.gs`, `SubjectService.gs`, `HeadcountService.gs`,
  `AnalysisService.gs`, `RepeatService.gs`, `InterventionService.gs`,
  `DashboardService.gs`, `ReportService.gs`, `appsscript.json`, `Index.html`
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
   `StudentService.gs`, `SubjectService.gs`, `HeadcountService.gs`,
   `AnalysisService.gs`, `RepeatService.gs`, `InterventionService.gs`,
   `DashboardService.gs`, `ReportService.gs`), cipta fail Script baharu dengan
   nama yang sama (tanpa `.gs`) dan salin-tampal kandungannya.
4. Cipta satu fail HTML baharu bernama **Index** (guna nama tepat ini),
   salin-tampal kandungan `Index.html`.
5. Klik ikon gear ⚙️ **Project Settings**, tandakan *"Show appsscript.json
   manifest file in editor"*, salin-tampal kandungan `appsscript.json` di sini.
6. Kembali ke Sheet, refresh halaman. Menu baharu **"Sistem Headcount STPM"**
   akan muncul di bar menu.
7. Klik **Sistem Headcount STPM → 1. Sediakan Sistem (Jalankan Sekali)**.
   Benarkan kebenaran yang diminta. Ini mencipta semua 14 Sheet: `CONFIG`,
   `GRADES`, `USERS`, `STUDENTS`, `SUBJECTS`, `ENROLLMENTS`, `HEADCOUNT_S1/S2/S3`,
   `REPEAT_S1/S2`, `INTERVENTIONS`, `INTERVENTION_LOG`, `AUDIT_LOG`.
8. **Kemaskini data sebenar sekolah** terus dalam Sheet:
   - `CONFIG`: nama sekolah, tahun STPM aktif, sasaran GPS/PNGK, threshold gap/risiko.
   - `GRADES`: senarai gred & nilai gred rasmi sekolah (boleh ubah tanpa sentuh kod).
   - `USERS`: satu baris setiap pengguna (No. KP, PIN, Peranan, Nama, Skop Subjek
     untuk Guru/Ketua Panitia — kod subjek dipisah koma). Padam baris "ADMIN CONTOH"
     selepas tambah admin sebenar.
   - `STUDENTS`, `SUBJECTS`, `ENROLLMENTS`: data pelajar, mata pelajaran dan
     pendaftaran sebenar. Padam baris "CONTOH".
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
