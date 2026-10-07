# Sistem e-PAJSK — SMK Asajaya

Sistem **Pentaksiran Aktiviti Jasmani, Sukan dan Kokurikulum (PAJSK)** yang menggantikan
*TEMPLATE PAJSK SMK ASAJAYA* (Google Sheet). Database = Google Sheet, backend + frontend =
Google Apps Script (satu Web App SPA, `Index.html`), mengikut corak projek lain dalam repo ini
(`e-bidang`, `e-bidang-bahasa`). Dihubungkan **terus** dengan Sheet **E-KOKURIKULUM**.

## Peranan & siapa mengisi data

| Pengguna | Akses |
| --- | --- |
| `ADMIN` | Semua: urus pengguna & murid, segerak, tetapan, Arkib & Naik Tingkatan, log audit; boleh mengisi SEMUA unit, serta **ekstra kurikulum & CGPA tahun sebelum** |
| **Ketua Guru Penasihat (KGP)** | **Mengisi** medan pentaksiran (Jawatan, Pelibatan, Pencapaian, Komitmen, Khidmat sumbangan, Kehadiran manual) bagi murid **unit yang dipimpinnya sahaja**, melalui menu *Pengisian Unit (KGP)* |
| **Guru Kelas** | **Melihat sahaja** data kelasnya (Data Kelas, Rumusan, Slip, Analisa) untuk rujukan |

Peranan dalam Sheet tetap `ADMIN` atau `GURU_KELAS` ("Guru"); keupayaan ditentukan oleh data:
- **Guru Kelas** = lajur `PENGGUNA.KelasDijaga` berisi.
- **KGP** = unit dalam `PENGGUNA.UnitKoko` (auto daripada e-Kokurikulum: Sheet PENGGUNA, `UNITn_JAWATAN = "KETUA GURU PENASIHAT"`) **atau** `PENGGUNA.UnitDijaga` (ditanda manual oleh Admin di menu Pengguna). Format: `ASPEK|NAMA UNIT`, dipisah `;`.
- Seorang guru boleh menjadi Guru Kelas dan KGP serentak. KGP yang belum ada akaun dicipta automatik semasa segerak (kata laluan lalai = 6 digit terakhir No. KP).
- Lajur `UnitDijaga` dan `UnitKoko` ditambah automatik pada Sheet PENGGUNA sedia ada.

### Menu Pengisian Unit (KGP)
- Senarai murid disusun **unit → tingkatan → kelas → nama**; tapis status / tingkatan / carian.
- Borang satu murid untuk satu aspek dengan pratonton markah, cadangan pencapaian daripada e-Kokurikulum, dan butang **Simpan & seterusnya**.
- **Isi pukal**: pilih beberapa murid (satu unit) dan tetapkan medan yang sama (cth. Jawatan `AHLI AKTIF`); pilihan *kosong sahaja* tidak menimpa data sedia ada.
- Medan yang ditarik daripada e-Kokurikulum (unit, kehadiran) tidak perlu diisi.

Kebenaran disahkan di **pelayan** pada setiap panggilan (peranan, status akaun dan kelas dibaca
semula daripada Sheet — menukar peranan/menyahaktif pengguna berkuat kuasa serta-merta).

## Log masuk

- **No. KP** (12 digit) + kata laluan. Kata laluan lalai = **6 digit terakhir No. KP**.
- Selepas log masuk pertama (atau selepas Admin *Reset KW*) pengguna **dipaksa menukar kata laluan**;
  kata laluan baharu tidak boleh sama dengan kata laluan lalai.
- Kata laluan disimpan sebagai hash SHA-256 bergaram No. KP; 5 cubaan gagal mengunci log masuk 10 minit.

## Penghubung e-Kokurikulum (tarik terus, baca sahaja)

`KokoService.gs` membuka Sheet e-Kokurikulum dengan `SpreadsheetApp.openById` (ID lalai dalam
`Config.gs`, boleh diubah di menu **Tetapan**). e-PAJSK **tidak mengubah** data e-Kokurikulum. Lajur dicari
mengikut nama header, bukan kedudukan.

| Sheet e-Kokurikulum | Digunakan untuk |
| --- | --- |
| `MURID` | Senarai murid, tingkatan, kelas, unit PBB/KP/SP (+ jawatan jika diisi). Jantina diteka daripada digit akhir No. KP (ganjil = lelaki) |
| `KEHADIRAN_PASUKAN_BADAN_BERUNIF`, `KEHADIRAN_KELAB_&_PERSATUAN`, `KEHADIRAN_SUKAN_&_PERMAINAN` | **Skor Kehadiran** automatik: bilangan perjumpaan unik (TARIKH + PERJUMPAAN) dengan STATUS `HADIR` pada tahun pentaksiran, maksimum 12 |
| `PENCAPAIAN` | **Cadangan** Pelibatan/Pencapaian (guru kelas semak & tekan *Guna*; tidak disimpan automatik) |
| `PENGGUNA` | Import akaun guru (kata laluan e-Kokurikulum **tidak** disalin) |

Syarat: akaun Gmail yang men-*deploy* e-PAJSK mesti pemilik/editor/viewer Sheet e-Kokurikulum
(aplikasi dijalankan sebagai pemilik deployment).

### Peraturan segerak (selamat untuk Arkib/Naik Tingkatan)
- Nama dan unit sentiasa dikemaskini daripada e-Kokurikulum.
- **Tingkatan tidak pernah dinaikkan oleh segerak** (hanya *Naik Tingkatan*). Kelas dikemaskini hanya jika tingkatan di kedua-dua sistem **sama**;
  jika berbeza, murid dilaporkan dan dibiarkan.
- Murid yang tiada lagi dalam e-Kokurikulum dilaporkan, **tidak dipadam**. Murid `TAMAT` tidak disentuh.
- Data yang guru isi (jawatan, pelibatan, komitmen, kehadiran manual, dll.) **tidak ditimpa** oleh segerak.

## Status Pengisian (menu *Status Pengisian*)

- **Mengikut Ketua Guru Penasihat (pengisi)** — paparan utama Admin: setiap KGP dengan status *Belum mula / Dalam proses / Lengkap*, peratus, aktiviti terakhir; bagi yang dalam proses, butiran setiap unit (bilangan murid belum lengkap mengikut medan) dan senarai murid. Unit tanpa KGP disenaraikan. Salin senarai peringatan & CSV. KGP melihat unitnya sendiri.
- **Mengikut kelas (rujukan)** — Admin & Guru Kelas: kelengkapan data setiap kelas (termasuk CGPA tahun sebelum) untuk rujukan.

Peraturan "lengkap" (`Config.gs`: `MEDAN_WAJIB_ASPEK`, `WAJIB_CGPA_SEBELUM`): bagi setiap aspek yang murid sertai, **Jawatan**, **Pelibatan** dan sekurang-kurangnya satu **Komitmen**; CGPA tahun sebelum wajib bagi Tingkatan 2 ke atas (paparan kelas). *Dalam proses* = sudah ada rekod disimpan oleh pengisi tetapi medan wajib masih kosong.

## Tarikh akhir pengisian & permohonan buka semula
- **Admin** menetapkan tarikh dan masa akhir pengisian KGP di menu **Tarikh Akhir & Permohonan**. Kosongkan untuk tiada had.
- Sebelum tarikh akhir, kiraan detik (hari, jam, minit dan saat) dipaparkan di Dashboard dan Pengisian Unit. Warnanya:
  - hijau: lebih 7 hari lagi
  - kuning: 7 hari atau kurang
  - merah: 24 jam terakhir
- Selepas tarikh akhir, pengisian **dikunci** untuk KGP:
  - borang hanya boleh dilihat (🔒)
  - isi pukal disekat
  - pelayan menolak sebarang simpanan
- Skrin yang sedang terbuka dikunci sendiri sebaik sahaja kiraan detik tamat.
- Kiraan detik menggunakan jam pelayan (zon masa skrip), bukan jam peranti.
- Admin tidak pernah dikunci. Guru Kelas sememangnya lihat sahaja.
- **Permohonan buka semula:**
  - KGP menekan **Mohon buka semula**, kemudian memilih satu unit atau semua unitnya dan menulis sebab.
  - Admin menerima permohonan dengan lencana bilangan menunggu pada menu.
  - Admin boleh **Lulus** (tetapkan "dibuka sehingga" tarikh/masa, dengan pintasan +1/+3/+7 hari), **Tolak**, atau **Tutup sekarang** bagi bukaan yang masih aktif. Catatan pilihan dipaparkan kepada guru.
  - Bukaan tamat sendiri pada masa "dibuka sehingga". Baki masanya dipaparkan kepada KGP.
- Semua tindakan dicatat dalam Log Audit. Permohonan disimpan dalam Sheet `PERMOHONAN_BUKA`, yang dicipta automatik.

## Rujukan pengisian idME (PDF / cetak)

Menu **Data Kelas** atau **Rumusan Kelas** → **PDF rujukan idME** (Admin & Guru Kelas bagi kelas sendiri):
- Pilih seluruh kelas atau seorang murid → **Muat turun PDF** (dijana di pelayan, fail A4) atau **Cetak / Simpan PDF** (dialog cetak pelayar).
- Kandungan: senarai semak kelas (CGPA, gred, medan wajib yang belum diisi), kemudian setiap murid (2 murid / halaman): Unit, Jawatan, Pelibatan & Pencapaian (aktiviti 1 dan tambahan), Komitmen, Khidmat sumbangan, Kehadiran, markah aspek — mengikut susunan **Sukan & Permainan, Kelab & Persatuan, Badan Beruniform** — serta Ekstra kurikulum, CGPA tahun sebelum dan GPA/CGPA/Gred.
- Medan wajib yang masih kosong ditanda **BELUM DIISI**. Dokumen mengandungi No. KP murid — simpan dengan selamat.

## Responsif (telefon / tablet / komputer)

- ≤ 900px: menu sisi menjadi laci (butang ☰); ≤ 640px: jadual dipaparkan sebagai kad (label diambil automatik daripada tajuk lajur), borang/modal skrin penuh dengan butang tindakan melekat di bawah, input 16px (tiada zum automatik iOS), bar alat & penomboran disusun menegak.
- Peranti sentuh: sasaran sentuhan ≥ 40px. Tiada skrol mendatar pada lebar 390px.

## Kemas kini langsung & prestasi

**Segerak automatik (live) daripada e-Kokurikulum** — tiga lapisan, boleh digunakan serentak:
1. **Pencetus masa** (Tetapan → *Segerak automatik* → *Simpan & pasang pencetus*, atau menu Sheet *5. Pasang Auto-Segerak*): setiap 1/5/10/15/30 minit sistem menyemak masa kemas kini fail e-Kokurikulum (panggilan Drive ringan) dan **hanya jika berubah** menjalankan segerak. Disyorkan 5 minit.
2. **Semakan oleh pelayar**: setiap pengguna yang membuka sistem memanggil `apiVersi` (~45 saat) yang menjalankan semakan yang sama jika sudah tiba masanya — data kekal terkini walaupun pencetus tidak dipasang.
3. **Skrin dimuat semula sendiri**: apabila versi data berubah, skrin terbuka dikemas kini senyap-senyap (titik hijau di bar atas = sambungan hidup). Jika borang sedang dibuka, banner "Data baharu tersedia" dipaparkan dan borang tidak diganggu.
4. **Webhook ping (pilihan, hampir serta-merta)**: Tetapan → *Papar / jana URL ping*. Dalam skrip e-Kokurikulum, panggil URL itu selepas menyimpan kehadiran/pencapaian (perlukan skop `script.external_request` pada projek e-Kokurikulum):
   ```js
   function pingEPajsk() {
     try { UrlFetchApp.fetch('SALIN_URL_PING_DARI_TETAPAN', { muteHttpExceptions: true }); } catch (e) {}
   }
   ```
   URL dilindungi kunci rahsia dan dihadkan 1 kali / 20 saat. Tanpa webhook, kelewatan maksimum = selang pencetus.

> **Jika muncul "You do not have permission to call ScriptApp.getProjectTriggers"**: skop `script.scriptapp` belum diberi kebenaran. Dalam editor Apps Script pilih fungsi `pasangPencetusAutoMelaluiMenu` (atau menu Sheet *5. Pasang Auto-Segerak*) → **Run** → **Allow**, kemudian **Deploy → Manage deployments → Edit → New version**. Sementara itu auto-segerak melalui pelayar (lapisan 2–3) sudah berfungsi.

**Mengapa lebih laju:**
- **Cache berversi** (`Utils.gs`): setiap Sheet dibaca sekali kemudian disimpan dalam CacheService (format kompak, dipecah kepada cebisan). Penulisan menampal cache (*write-through*) — menyimpan pentaksiran seorang murid tidak memaksa semua Sheet dibaca semula. Suntingan manual dalam Sheet ditangkap oleh `onEdit`; perubahan struktur: menu *Kosongkan Semua Cache*.
- **Segerak delta**: data e-Kokurikulum dicache mengikut masa kemas kini fail; hanya rekod yang benar-benar berubah ditulis (segerak tanpa perubahan ≈ tiada bacaan/tulisan). Sheet kehadiran dibaca 4 lajur sahaja.
- **Tulisan kelompok**: tulis banyak baris dengan beberapa panggilan sahaja (blok bersebelahan); pencarian baris hanya membaca lajur kunci. Tulisan ke baris dilindungi semakan kunci — jika baris beralih (cth. dipadam manual) tulisan dibatalkan, bukan merosakkan data.
- **Satu panggilan permulaan** (`apiMula`) menggantikan 4 panggilan; navigasi menu tidak lagi memanggil pelayan untuk senarai kelas; data kelas dipaparkan serta-merta daripada memori kemudian disegarkan di latar (*stale-while-revalidate*); hanya operasi tulis menyekat skrin.
- **Penomboran & carian di pelayan** untuk Murid, Pengguna, Log Audit dan Arkib (10/25/50/100 baris); log audit dibaca dari hujung Sheet sahaja.
- **Kestabilan**: cuba semula automatik bagi ralat sementara Sheets/Drive (bacaan), mesej mesra jika sistem sibuk (kunci), jawapan lambat tidak menimpa yang terkini, kunci skrip untuk semua penulisan.

## Pengiraan (mengikut formula template)

`Scoring.gs` (fungsi murni; disalin ke pelayar untuk pratonton, markah sah dikira semula di pelayan):

- **Skor aspek (PBB/KP/SP)** = Jawatan + Pelibatan (tertinggi antara 2 aktiviti) + Pencapaian (tertinggi) + Komitmen 1–4 + Khidmat Sumbangan + Kehadiran (maks **110**); **Markah** = Skor ÷ 110 × 100.
- **Ekstra Kurikulum** = skor tertinggi antara Perkhidmatan, Anugerah Khas, Khidmat Masyarakat, NILAM, TIMSS & PISA, Tugas-tugas Khas (maks 10).
- **Rumusan** = purata 2 markah aspek tertinggi + Ekstra = *GPA*; jika ada *CGPA tahun sebelum*: (GPA + CGPA lepas) ÷ 2. **Gred**: A ≥ 80, B ≥ 60, C ≥ 40, D ≥ 20, E ≥ 1.
- Jadual skor berada dalam Sheet **REFERENSI** (disemai daripada sheet `DATA` template) — sunting terus di Sheet, kemudian *Tetapan → Kira semula semua markah*.

### Perbezaan / andaian berbanding template (sila semak)
1. **Komitmen**: pilihan yang sama dipilih dua kali dikira **sekali** (template menjumlahkan pendua).
2. **Had 100**: CGPA dihadkan 100 juga apabila tiada CGPA tahun sebelum (template hanya menghadkan apabila ada).
3. **Jawatan Bela Diri** (7 baris terakhir senarai jawatan) tiada skor dalam template; ditetapkan **10, 8, 7, 6, 5, 4, 2** (mengikut pola jawatan lain). Sunting dalam `REFERENSI` jika berbeza.
4. **Tugas Khas**: dua pilihan "Sukarelawan program … antarabangsa yang dianjurkan dalam negara" berlabel sama (skor 5 dan 3) dalam template; yang kedua ditambah `(B)` supaya boleh dipilih.
5. **Slip**: tajuk lajur *Kelab/Persatuan* dan *Badan Beruniform* dalam sheet `SLIP` template tertukar dengan data; di sini dipaparkan betul.
6. **Analisa Ringkas**: formula *Gred Purata* template mempunyai ralat keutamaan operator; di sini Gred Purata = Σ(bil × nilai gred) ÷ murid bergred, %GPS = (5 − gred purata) ÷ 4 × 100.
7. **Kehadiran** dikira daripada rekod e-Kokurikulum sahaja (kosong sehingga e-Kokurikulum merekod kehadiran); guru kelas boleh **ganti manual** (0–12).
8. Pelibatan/Pencapaian daripada e-Kokurikulum hanya **cadangan** kerana rekod `PENCAPAIAN` tidak mengandungi aspek (SP/KP/PBB) dan tahap *Pelibatan 1/2/3*; guru kelas mengesahkannya.

## Arkib & Naik Tingkatan (Admin, menu *Arkib & Naik Tingkatan*)

Turutan wajib akhir tahun:
1. **Arkib Tahun** — kira semula semua markah, salin `MURID`, `PENTAKSIRAN_ASPEK`, `PENTAKSIRAN_EKSTRA`, `RUMUSAN`, `REFERENSI` ke satu Google Sheet baharu dalam Drive (folder *e-PAJSK SMK Asajaya - Arkib*), catat dalam `ARKIB_TAHUNAN`. Arkib boleh dilihat dalam aplikasi (ikut kelas) atau dibuka sebagai Sheet.
2. **Naik Tingkatan** (dikunci sehingga arkib wujud; perlu taip `NAIK TINGKATAN`):
   - CGPA tahun ini → *CGPA Tahun Sebelum* tahun hadapan + ditambah pada **Sejarah CGPA** (dicetak pada slip);
   - Tingkatan 1–4 → +1 (ditanda **Perlu semak** sehingga kelas disahkan melalui segerak); Tingkatan 5 → status **TAMAT**;
   - data pentaksiran tahun lepas dikosongkan; **Tahun Pentaksiran** dinaikkan;
   - (pilihan) penetapan kelas Guru Kelas dikosongkan untuk ditetapkan semula.
3. Naikkan tingkatan di e-Kokurikulum, kemudian **Segerak SEMUA** supaya kelas baharu disahkan.

Fail arkib mengandungi nama & No. KP murid — kekal peribadi dalam Drive pemilik deployment; jangan kongsi sembarangan.

## Cara pasang (sekali sahaja)

1. Cipta **Google Sheet baharu** (cth. "DATA e-PAJSK SMK ASAJAYA") menggunakan akaun Gmail anda. Ini database — **jangan** guna Sheet e-Kokurikulum.
2. **Extensions → Apps Script**. Cipta fail Script (nama tanpa `.gs`) untuk setiap fail `.gs` dalam folder ini, salin-tampal kandungan:
   `Code`, `Config`, `Utils`, `Scoring`, `ReferensiLalai`, `TetapanService`, `AuditService`, `AuthService`, `UserService`, `KokoService`, `MuridService`, `PentaksiranService`, `LaporanService`, `ArkibService`, `LiveService`, `PemantauanService`, `RujukanIdmeService`, `TarikhAkhirService`.
3. Cipta fail HTML bernama **Index**, salin-tampal `Index.html`.
4. **Project Settings → Show "appsscript.json"**, salin-tampal `appsscript.json` (skop: `spreadsheets`, `drive`, `script.scriptapp` — yang terakhir diperlukan untuk pencetus auto-segerak; selepas menampal, buat **New version** dan benarkan skop baharu).
5. Refresh Sheet → menu **Sistem e-PAJSK → 1. Sediakan Sistem**; benarkan kebenaran (OAuth). Isi **No. KP & nama Admin pertama** apabila diminta. (Menu *2. Tambah / Pulihkan Admin* boleh digunakan kemudian.)
6. **Deploy → New deployment → Web app**: *Execute as* **Me**, *Who has access* **Anyone**. Salin URL `/exec`.
7. Buka URL, log masuk (kata laluan = 6 digit terakhir No. KP, kemudian tukar).
8. Menu **Tetapan**: semak Tahun Pentaksiran, kod/nama sekolah dan ID Sheet e-Kokurikulum.
9. Menu **Pengguna → Import guru daripada e-Kokurikulum**; menu **Murid → Segerak SEMUA**; kemudian tetapkan **kelas yang dijaga** bagi setiap Guru Kelas (sunting pengguna).
10. (Pilihan) letak URL `/exec` dalam `epajsk.html` di akar repo untuk dibenam pada laman web sekolah.

Selepas mengemas kini kod, buat **Deploy → Manage deployments → Edit → New version**.

## Struktur Sheet

`PENGGUNA`, `MURID`, `PENTAKSIRAN_ASPEK` (satu baris setiap murid × aspek), `PENTAKSIRAN_EKSTRA`, `RUMUSAN`, `REFERENSI`, `TETAPAN`, `ARKIB_TAHUNAN`, `LOG_AUDIT`, `PERMOHONAN_BUKA`.
Lajur No. KP diformat teks (sistem juga melapik sifar di hadapan jika No. KP tersimpan sebagai nombor).

## Had & nota
- Satu Apps Script menjalankan satu penulisan pada satu masa (`LockService`); segerak semua (~1,000 murid) mengambil beberapa saat–puluhan saat.
- Cache data 30 minit (dinaikkan versi serta-merta apabila ditulis); untuk data lapuk akibat pengubahsuaian struktur Sheet gunakan menu *Kosongkan Semua Cache*.
- Cold start Apps Script (permintaan pertama selepas lama tidak digunakan) mengambil 1–3 saat — had platform.
- Cetakan slip/rumusan menggunakan *Print* pelayar (pilih *Save as PDF* untuk PDF).
- Tiada notifikasi e-mel dan tiada portal murid (di luar skop: hanya Admin & Guru Kelas).
