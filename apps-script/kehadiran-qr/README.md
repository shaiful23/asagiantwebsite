# Sistem Kehadiran Guru & Murid (Imbas QR) — SMK Asajaya

Sistem ini membolehkan guru subjek/guru ganti (teach-in) mengimbas satu kod QR
unik yang ditampal di setiap kelas untuk log masuk terus ke borang kehadiran
(dropdown), merekod kehadiran guru itu sendiri, dan kemudian menandakan
kehadiran setiap murid dalam kelas tersebut.

## Struktur

- `Code.gs`, `appsscript.json`, `PortalGuru.html`, `AdminQR.html` — projek
  Google Apps Script (backend + Portal Guru + halaman jana kod QR).
- `../../kehadiranqr.html` — pembungkus GitHub Pages (iframe) untuk Portal Guru.
- `../../kehadiranqrscanner.html` — halaman pengimbas kamera QR, DIHOSKAN DI
  GITHUB PAGES (bukan Apps Script) kerana Apps Script HtmlService menyekat
  akses kamera (`getUserMedia`) secara rasmi & kekal.

## Cara Pasang (sekali sahaja)

1. **Cipta Google Sheet baharu** (cth. "Data Kehadiran QR SMK Asajaya").
2. Buka **Extensions → Apps Script** dari Sheet tersebut.
3. Padam kandungan `Code.gs` lalai, salin-tampal kandungan `Code.gs` di sini.
4. Dalam editor Apps Script, cipta 2 fail HTML baharu bernama **PortalGuru**
   dan **AdminQR** (guna nama tepat ini), salin-tampal kandungan fail
   `PortalGuru.html` dan `AdminQR.html` masing-masing.
5. Klik ikon gear ⚙️ **Project Settings**, tandakan *"Show appsscript.json
   manifest file in editor"*, kemudian salin-tampal kandungan `appsscript.json`
   di sini ke dalamnya (atau set tetapan Web App secara manual mengikut nilai
   yang sama semasa deploy di langkah 7).
6. Kembali ke Sheet, refresh halaman. Menu baharu **"Sistem Kehadiran QR"**
   akan muncul di bar menu.
7. Klik **Sistem Kehadiran QR → 1. Sediakan Sistem (Jalankan Sekali)**.
   Benarkan kebenaran (authorization) yang diminta. Ini akan mencipta semua
   Sheet: `Guru`, `Kelas`, `SlotWaktu`, `JadualWaktu`, `Murid`,
   `LogKehadiranGuru`, `LogKehadiranMurid` — setiap satu dengan 1 baris data
   contoh.
8. **Kemaskini data sekolah sebenar** terus dalam Sheet:
   - `Guru`: satu baris setiap guru (No. KP, PIN 4-6 digit, subjek diajar).
   - `Kelas`: satu baris setiap kelas (Kod_QR mestilah unik & ringkas,
     cth. `5CEM`, `4SN1`).
   - `SlotWaktu`: waktu mula/tamat setiap slot P&P (boleh ubah ikut jadual
     sekolah).
   - `JadualWaktu`: jadual waktu setiap guru bagi setiap kelas/slot/hari
     (pilihan — jika kosong, guru tetap boleh imbas & isi borang secara
     manual, cuma tiada auto-isi subjek).
   - `Murid`: senarai murid setiap kelas.
   - Padam baris "CONTOH" selepas selesai.
9. Klik **Deploy → New deployment**. Pilih jenis **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Klik **Deploy**, salin URL yang berakhir dengan `/exec`.
10. Buka fail `kehadiranqr.html` (di root repo laman web ini), gantikan
    `GANTI_DENGAN_EXEC_URL_ANDA` dengan URL sebenar dari langkah 9.
11. Buka fail `PortalGuru.html` (dalam Apps Script), pastikan pembolehubah
    `URL_SCANNER` menunjuk ke URL sebenar `kehadiranqrscanner.html` selepas
    diterbitkan di GitHub Pages (cth. `https://smkasajaya.my/kehadiranqrscanner.html`).
    Deploy semula (**Deploy → Manage deployments → Edit → New version**)
    selepas mengubah fail ini.

## Cetak Kod QR Untuk Setiap Kelas

Dari Sheet, klik **Sistem Kehadiran QR → 2. Buka Halaman Jana & Cetak Kod QR**.
Ia akan membuka tab baharu memaparkan kod QR setiap kelas (dari lajur
`Kod_QR` + `Bilik_Utama` dalam Sheet `Kelas`). Klik **Cetak Semua**, kemudian
tampal/gantung setiap kod QR di dalam kelas yang berkaitan.

Format kandungan kod QR: `KELAS:<Kod_QR>|BILIK:<Bilik_Utama>`

## Aliran Penggunaan Harian

1. Guru buka **kehadiranqr.html** (Portal Guru), log masuk dengan No. KP + PIN.
2. Klik **"Imbas Kehadiran (QR Kelas)"** — ini membuka `kehadiranqrscanner.html`
   dengan token sesi terbenam dalam URL.
3. Guru imbas kod QR yang tergantung di dalam kelas.
4. Sistem cuba padankan hari/masa semasa dengan `JadualWaktu` guru tersebut —
   jika sepadan, Subjek & Jenis (Guru Subjek) auto-diisi; jika tidak (guru
   ganti/relief), guru pilih sendiri Subjek & Jenis dari dropdown.
5. Guru sahkan → kehadiran guru direkod (dengan status Tepat Masa/Lewat).
6. Senarai murid kelas tersebut terus dipaparkan — guru tanda status setiap
   murid (default "Hadir", boleh tukar dropdown atau guna "Tandakan Semua
   Hadir") → Simpan.
7. Semua rekod boleh disemak terus dalam Sheet `LogKehadiranGuru` dan
   `LogKehadiranMurid`.

## Nota Penting: Format Lajur dalam Sheet

Google Sheets automatik menukar teks yang kelihatan seperti nombor/masa/tarikh
kepada jenis data lain, yang boleh merosakkan padanan data:

- **`NoKP` dan `PIN`** (Sheet `Guru`), serta **`Kod_QR`** (Sheet `Kelas`) jika
  ia hanya angka — format lajur ini sebagai **Plain text** (klik lajur →
  Format → Number → Plain text) SEBELUM menaip data, supaya sifar (0) di
  hadapan No. KP tidak hilang.
- **`Masa_Mula` / `Masa_Tamat`** (Sheet `SlotWaktu`) — boleh ditaip sebagai
  "07:30" seperti biasa; kod ini sudah mengendalikan sama ada Sheets
  menyimpannya sebagai teks atau nilai masa.

## Nota Keselamatan

- PIN guru disimpan sebagai teks biasa dalam Sheet `Guru` — pastikan akses
  kepada Google Sheet ini dihadkan hanya kepada admin/pentadbir sistem.
- Sesi log masuk (token) sah selama 6 jam sahaja (`TEMPOH_SESI_SAAT` dalam
  `Code.gs`), disimpan dalam `CacheService` (bukan dalam Sheet).
