# e-Kehadiran SMK Asajaya — Kehadiran Guru & Murid (Imbas QR Kelas)

Sistem kehadiran berasaskan **Google Sheets + Google Apps Script** (satu Web App
SPA) dengan identiti visual SMK Asajaya (logo rasmi terbenam dalam kod, warna
logo: biru, merah, kuning, ungu). Disambung kepada **e-Data & Enrolmen**,
**e-Teach-In** dan senarai sebab tidak hadir **IDME**.

## Ciri Utama

| Modul | Penerangan |
| --- | --- |
| **Log masuk** | Guru & murid guna No. KP. Kata laluan lalai = **6 digit terakhir No. KP**. Selepas log masuk pertama pengguna **dipaksa** menukar kata laluan — disekat di **pelayan** (semua API lain menolak sehingga ditukar). Kata laluan disimpan sebagai hash SHA-256. Had 5 cubaan gagal → dikunci 10 minit. |
| **Papan pemuka** | Kad ringkas & analisis **tarikh semasa** — guru (jadual hari ini, sesi direkod, kelas tingkatan, amaran), murid (status hari ini, peratus bulan/tahun, sesi P&P hari ini, 20 hari terkini), admin (gambaran sekolah: kehadiran mengikut tingkatan, sebab, kelas belum direkod). |
| **Rekod Kehadiran (sidebar)** | Semua rekod lepas + **analisis bulanan** lengkap (pemilih bulan): carta harian, sebab, kalendar, analisis setiap murid, sesi subjek, kedudukan kelas (admin). Semua jadual boleh dicari, diisih & dieksport CSV. |
| **Kelas Diajar & Teach-In (sidebar guru)** | Jadual waktu mingguan, kad kelas diajar, senarai kelas teach-in (60 hari) dengan status direkod — **ditarik dari e-Teach-In**. |
| **Profil Pelajar (sidebar)** | Profil ringkas + **gambar** murid — **ditarik dari e-Data & Enrolmen**. Murid lihat profil sendiri; guru lihat murid kelas yang diajar/kelas tingkatan; admin semua. |
| **Rekod Kehadiran Kelas (GT/PGT)** | Lalai **semua murid hadir**; GT matikan suis bagi yang tidak hadir & pilih sebab dari senarai **IDME**. **Kunci automatik selepas 07:10** — selepas itu GT wajib **mohon admin buka akses dengan alasan**. |
| **Amaran Ponteng (sidebar)** | Pengiraan automatik kategori berturut-turut & tidak berturut-turut, rekod tindakan/intervensi, **jana surat amaran** bercetak (kepala surat + logo, No. Rujukan, tarikh ponteng, akuan penerimaan). |
| **Ponteng Kelas (sidebar)** | Guru MP tandakan murid yang hadir ke sekolah tetapi tiada dalam kelas dengan butang **Ponteng Kelas** dalam borang imbas QR (ditolak jika murid ditanda tidak hadir ke sekolah oleh GT). Analisis lengkap: kes & kadar, trend harian/bulanan, mengikut subjek, waktu, hari, kelas, guru, peta haba hari × waktu, murid berulang (≥3 kes sebulan), senarai kes — ikut skop (admin semua, GT kelasnya, guru sesi sendiri). Kiraan juga di papan pemuka, profil & rekod murid. |
| **Amaran Ponteng Kelas (sidebar GT/PGT & admin)** | Ponteng kelas **berulang** mencetuskan amaran tersendiri (berasingan daripada amaran tidak hadir ke sekolah): kes terkumpul setahun → Amaran Pertama (3), Amaran Kedua (6), Amaran Terakhir (10), Rujukan Lembaga Disiplin (15). Senarai Perlu Tindakan / Hampir, butiran kes & subjek kerap, rekod intervensi, **surat amaran ponteng kelas** bercetak (senarai tarikh, masa & subjek). Ambang boleh diubah admin terus dari UI. |
| **Pematuhan Guru Masuk Kelas (admin)** | Setiap blok jadual waktu e-Teach-In & tugasan teach-in yang telah berlalu dipadankan dengan imbasan QR guru: **Tepat masa / Lewat / Tidak masuk / Diganti (teach-in) / Dikecualikan**. Kadar masuk kelas & perbandingan bulan lalu, trend harian, mengikut hari, waktu, subjek, kelas, peta haba, jadual setiap guru (GMP & guru teach-in), senarai sesi tidak masuk (eksport CSV). Admin boleh **kecualikan** sesi/hari guru (kursus, cuti, tugas rasmi); hari cuti sekolah dikecualikan automatik. |
| **Butang Edit** | Semua rekod boleh disunting: sesi kehadiran subjek (subjek, jenis, catatan, murid tidak hadir/ponteng kelas — guru pemilik dalam `TEMPOH_EDIT_SESI_HARI` hari, admin bila-bila masa & boleh padam), rekod harian kelas, intervensi (pemilik/admin), surat (admin batal), permohonan (admin tarik balik / lanjut akses / catatan), pengecualian guru. |
| **Urus Sistem (admin)** | Urus semua data **tanpa membuka Google Sheet**: Tetapan, Guru & peranan (termasuk guru dari e-Data), Kelas & kod QR, Sebab IDME, Slot waktu, Peta kod kelas, Cuti sekolah, Sesi subjek, Rekod harian, Log audit, dan tindakan sistem (semak struktur, segar cache, jana peta kod). Semua perubahan disahkan & dicatat dalam audit. |
| **Imbas QR Kelas** | Guru subjek/teach-in imbas QR kelas → borang dropdown auto-isi (subjek & jenis dari jadual/e-Teach-In) → murid lalai hadir → simpan. Murid yang ditanda tidak hadir oleh GT pagi itu dicadangkan tidak hadir. |
| **Admin** | Lulus/tolak permohonan buka akses, **analisis permohonan** (bulanan, kelas, guru, hari, masa proses, % rekod selepas kunci), cetak kod QR kelas, status sambungan sistem luar, set semula kata laluan. |

## Peranan & Akses

Lajur `Peranan` dalam Sheet `GURU` (boleh lebih satu, dipisah koma, cth. `GT, GMP`):

| Kod | Peranan | Akses |
| --- | --- | --- |
| `GT` | Guru Tingkatan | **Sama dengan PGT** — rekod kehadiran kelas sendiri (lajur `KelasTingkatan`), amaran ponteng & surat kelas sendiri |
| `PGT` | Penolong Guru Tingkatan | **Sama dengan GT** |
| `GMP` | Guru Mata Pelajaran | **Sama dengan PRAKTIKAL & KAUNSELOR** — imbas QR, kelas diajar & teach-in, rekod sesi, profil murid kelas diajar |
| `PRAKTIKAL` | Guru Praktikal | Sama dengan GMP |
| `KAUNSELOR` | Guru Kaunseling | Sama dengan GMP |
| `ADMIN` | Pentadbir | Semua, termasuk lulus permohonan & analisis |

Semua guru boleh imbas QR kelas. Akses sentiasa disahkan di **pelayan**.

## Amaran Ponteng

Hari tidak hadir dikira **ponteng** jika sebabnya bertanda `DikiraPonteng = YA`
(senarai IDME). Hadir, atau tidak hadir bersebab sah, **memutuskan** kiraan berturut-turut.

| Kategori | Amaran Pertama | Amaran Kedua | Amaran Terakhir | Buang Sekolah |
| --- | --- | --- | --- | --- |
| Berturut-turut | hari ke-3 | +7 hari (ke-10) | +7 hari (ke-17) | +14 hari (ke-31) |
| Tidak berturut-turut (terkumpul setahun) | hari ke-10 | +10 hari (ke-20) | +20 hari (ke-40) | +20 hari (ke-60) |

Murid yang mencapai peringkat tetapi suratnya belum dijana ditanda **Perlu Tindakan**.
Jana semula surat peringkat yang sama menggunakan **No. Rujukan yang sama** (tiada pendua).
Ambang boleh diubah dalam `PERINGKAT_AMARAN` (`Config.gs`).

**Ponteng kelas berulang** mempunyai tangga sendiri (kes terkumpul setahun): Amaran Pertama
3, Amaran Kedua 6, Amaran Terakhir 10, Rujukan Lembaga Disiplin 15 — ditetapkan dalam TETAPAN
`PK_AMARAN_1`, `PK_AMARAN_2`, `PK_AMARAN_TERAKHIR`, `PK_RUJUKAN_DISIPLIN` (boleh diubah di UI). Teks surat ialah templat
umum — semak dengan pentadbiran sekolah sebelum digunakan secara rasmi.

## Struktur Fail

| Fail | Fungsi |
| --- | --- |
| `Config.gs` | Pemalar, nama Sheet/header, peranan, ambang amaran, tetapan lalai |
| `Utils.gs` | Utiliti Sheet/tarikh/cache/audit |
| `SumberLuar.gs` | Penyambung e-Data & Enrolmen, e-Teach-In, IDME (dengan Sheet sandaran) |
| `AuthService.gs` | Log masuk, sesi, peranan, tukar/set semula kata laluan |
| `KehadiranKelasService.gs` | Rekod harian GT/PGT, kunci 07:10, permohonan buka akses |
| `KehadiranSubjekService.gs` | Imbas QR guru subjek / teach-in |
| `AmaranService.gs` | Amaran ponteng, intervensi, surat amaran |
| `DashboardService.gs` | Papan pemuka, analisis bulanan, kelas diajar, profil |
| `PontengKelasService.gs` | Analisis ponteng kelas |
| `AmaranPontengKelasService.gs` | Amaran, intervensi & surat ponteng kelas berulang |
| `PematuhanGuruService.gs` | Analisis guru MP & teach-in masuk / tidak masuk kelas, pengecualian |
| `UrusService.gs` | Urus sistem dari UI (CRUD tetapan/guru/kelas/sebab/slot/peta kod/cuti) & suntingan rekod |
| `AdminService.gs` | Permohonan, analisis, kod QR, pengguna, status sumber luar |
| `Code.gs` | Menu, Sediakan Sistem, data contoh, `doGet` (SPA + API JSONP pengimbas) |
| `Index.html` `Gaya.html` `Logo.html` `App.html` | Antara muka SPA (logo terbenam dalam `Logo.html`) |
| `../../kehadiranqrscanner.html` | Pengimbas kamera (GitHub Pages — Apps Script menyekat kamera) |
| `../../kehadiranqr.html` | Pembungkus iframe portal di laman web sekolah |

## Cara Pasang

1. Cipta **Google Sheet baharu** → **Extensions → Apps Script**.
2. Salin setiap fail `.gs` di atas sebagai fail skrip (nama sama), dan setiap fail
   `.html` sebagai fail HTML (nama sama tanpa `.html`: `Index`, `Gaya`, `Logo`, `App`).
3. Project Settings → tanda *Show "appsscript.json"* → salin kandungan `appsscript.json`.
4. Muat semula Sheet → menu **e-Kehadiran → 1. Sediakan / Kemaskini Struktur Sistem**.
   (Selamat diulang — hanya menambah Sheet/lajur yang tiada.)
5. Isi data:
   - **GURU** — `NoKP`, `Nama`, `Peranan`, `KelasTingkatan` (wajib bagi GT/PGT), `Status`.
   - **KELAS** — `Kelas` (nama **sama** seperti di e-Data, cth. `5 CEMERLANG`), `Tingkatan`, `KodQR` (unik, ringkas, cth. `5CEM`), `Bilik`.
   - **SLOT_WAKTU** — masa setiap waktu P&P (dicipta dengan nilai lalai).
6. Sambung sistem luar dalam Sheet **TETAPAN** (lihat bawah). Akaun yang men-deploy
   mesti mempunyai akses **lihat** pada spreadsheet sistem tersebut.
7. **Deploy → New deployment → Web app** (Execute as: *Me*, Who has access: *Anyone*).
   Salin URL `/exec`.
8. Dalam repo laman web: ganti `GANTI_DENGAN_EXEC_URL_ANDA` dalam `kehadiranqr.html`.
   Semak `URL_PENGIMBAS` dalam Sheet TETAPAN menunjuk ke `kehadiranqrscanner.html` di laman sekolah.
9. Admin → menu **Kod QR Kelas** → *Cetak Semua* → tampal dalam setiap kelas.

Untuk mencuba dahulu: menu **Isi Data Contoh** (hanya jika Sheet GURU kosong) — log masuk
admin contoh `800101135001`, GT contoh `800202135002` (kata laluan = 6 digit terakhir).

## Sambungan e-Data & e-Teach-In SMK Asajaya (format dikesan automatik)

Isi dua nilai sahaja dalam Sheet **TETAPAN** (ID atau URL penuh diterima):

| Kunci | Nilai |
| --- | --- |
| `EDATA_SPREADSHEET_ID` | spreadsheet **E-DATA & ENROLMEN** |
| `TEACHIN_SPREADSHEET_ID` | spreadsheet **PENGURUSAN TEACH-IN** |

Sistem mengesan format SMK Asajaya secara automatik (`EDATA_FORMAT` / `TEACHIN_FORMAT` = `AUTO`):

| Data | Dibaca dari |
| --- | --- |
| Murid | e-Data `Data_Murid` — kelas = `TINGKATAN` + `KELAS` → cth. `1 AKASIA`, `PPKI PKKS ROTI 2`; murid bukan `AKTIF` ditapis |
| Foto murid | e-Data `Foto_Murid` — `THUMB` (base64; tidak perlu kongsi fail Drive) |
| Guru, peranan & kelas GT/PGT | e-Data `Pengguna` (`ADMIN+PENOLONG GURU TINGKATAN` → ADMIN + PGT) |
| Peranan tambahan / guru tambahan | e-Teach-In `Profil_Guru` (`PERANAN_GURU` KAUNSELOR/PENGETUA; baris yang `NO_KP` diisi → akaun guru automatik) |
| Jadual waktu | e-Teach-In `Jadual_Induk_Perdana` & `Jadual_Induk_T6` (grid). Waktu berturut dengan subjek & kelas sama digabung jadi satu blok (cth. 7:00–8:00); `PERH`, `KT`, `KK` diabaikan; `3AL/3AS` = dua kelas |
| Guru ganti | e-Teach-In `Rekod_TeachIn` (`WAKTU` atau `INDEKS_SLOT`; status BATAL diabaikan) |
| Giliran / tingkatan tidak hadir | e-Teach-In `Tingkatan_Tidak_Hadir` — kelas terlibat tidak dikira "belum direkod" |
| Nama sekolah, pengetua, kod sekolah (surat) | e-Data `Tetapan` (jika kosong dalam TETAPAN sistem ini) |

**Kod kelas e-Teach-In** (`2AR`, `T6A3`) dipadankan secara automatik kepada kelas e-Data
(`2AR` → `2 AZARA`). Semak di portal: *Pengguna & Sistem → Pemetaan Kod Kelas*, atau menu
**e-Kehadiran → 3. Jana Peta Kod Kelas** untuk menulis pemetaan ke Sheet `PETA_KOD_KELAS`
dan betulkan di situ (pemetaan dalam Sheet mengatasi automatik). Kod Tingkatan 6 (`T6A3`)
perlu diisi secara manual kerana e-Data tiada padanan nama yang jelas.

**Guru dipadankan dengan jadual melalui nama** (jadual tiada No. KP). Beza ejaan kecil
(cth. MOHAMED/MOHAMAD, BTE/BINTI) diterima. Jika nama terlalu berbeza, isi lajur
`NamaDalamJadual` dalam Sheet `GURU` (nama tepat seperti di e-Teach-In).

**Guru mata pelajaran yang tiada dalam `Pengguna` e-Data** perlu No. KP untuk log masuk —
isi `NO_KP` dalam `Profil_Guru` e-Teach-In (akaun dicipta automatik), atau tambah baris
dalam Sheet `GURU` (No. KP, Nama seperti dalam jadual, Peranan `GMP`).

Kod QR kelas lalai = kod e-Teach-In (cth. `KELAS:2AR`) — terus berfungsi tanpa isi Sheet KELAS.

## Sambungan Sistem Luar — format lain (Sheet TETAPAN)

| Sistem | Kunci ID | Tab & lajur |
| --- | --- | --- |
| e-Data & Enrolmen | `EDATA_SPREADSHEET_ID` | `EDATA_TAB`, `EDATA_LAJUR_*` (NoKP, Nama, Kelas, Tingkatan, Jantina, TarikhLahir, Alamat, NamaPenjaga, TelefonPenjaga, **Gambar**, Status) |
| e-Teach-In | `TEACHIN_SPREADSHEET_ID` | `TEACHIN_TAB_JADUAL` + `TEACHIN_JADUAL_LAJUR_*`; `TEACHIN_TAB_GANTI` + `TEACHIN_GANTI_LAJUR_*` |
| IDME (sebab tidak hadir) | `IDME_SPREADSHEET_ID` | `IDME_TAB`, `IDME_LAJUR_*` (Kod, Sebab, Kategori, DikiraPonteng) atau `SEBAB_PONTENG_KOD` |

- Isi **nama header sebenar** lajur di sistem berkenaan (padanan tidak sensitif huruf/ruang).
- Biarkan ID kosong untuk guna Sheet sandaran tempatan (`MURID`, `JADUAL_WAKTU`, `TEACH_IN`, `SEBAB_TIDAK_HADIR`).
- Guru dipadankan dengan rekod e-Teach-In melalui **No. KP**, atau **nama** jika No. KP tiada.
- Gambar murid: URL imej atau ID/pautan fail Drive — fail Drive mesti dikongsi *"Sesiapa yang mempunyai pautan"*.
- Data luar dicache 10 minit; menu **Segar Semula Data Sistem Luar** atau butang di halaman *Pengguna & Sistem* untuk paksa baca semula.
- **Penting:** `SEBAB_TIDAK_HADIR` diisi dengan senarai sandaran sementara. Gantikan dengan
  senarai rasmi IDME sekolah dan tetapkan `DikiraPonteng` bagi setiap sebab.

## Tetapan Lain (TETAPAN)

`MASA_KUNCI_KEHADIRAN` (07:10), `TEMPOH_BUKA_AKSES_MINIT` (120 — tempoh akses selepas
diluluskan), `TOLERANSI_LEWAT_MINIT` (10), `NAMA_SEKOLAH`, `ALAMAT_SEKOLAH`,
`NAMA_PENGETUA`, `PREFIKS_RUJUKAN_SURAT` (kepala & rujukan surat), `TEMPOH_EDIT_SESI_HARI` (14 —
tempoh guru boleh menyunting sesi sendiri), `PK_*` (ambang amaran ponteng kelas). Semua boleh
diubah melalui **Urus Sistem → Tetapan**.

Sheet baharu `CUTI_SEKOLAH` dan `PENGECUALIAN_GURU` dicipta automatik (menu *Sediakan/Kemaskini
Struktur* atau **Urus Sistem → Tindakan Sistem**).

## Kelajuan & Kestabilan

| Aspek | Cara dijamin |
| --- | --- |
| **Buka serta-merta** | Aplikasi dibuka terus dengan profil & data terakhir yang disimpan dalam peranti (hari yang sama), kemudian data terkini diambil di belakang (bar warna nipis di atas) dan halaman dikemas kini automatik. Borang **Rekod Kehadiran Kelas**, **Kelas Diajar** dan **Amaran** dipra-muat sejurus selepas log masuk — dibuka tanpa menunggu. Pustaka carta dimuat tak segerak (data dipaparkan dahulu). |
| **Borang tidak terganggu** | Segar semula latar **tidak** melukis semula halaman semasa guru sedang mengisi borang (perubahan belum disimpan kekal). |
| **Tiada data pendua** | Semua simpanan melalui kunci skrip; data dibaca **semula** dari Sheet selepas kunci diperoleh, jadi semakan "rekod sedia ada" sentiasa melihat simpanan guru lain. Setiap simpanan membawa `idPermintaan` — jika dihantar semula (klik dua kali, rangkaian putus, cuba semula automatik) pelayan memulangkan hasil asal tanpa menulis dua kali. |
| **GT & PGT serentak** | Rekod kehadiran kelas membawa versi. Jika rakan telah menyimpan selepas borang anda dibuka, simpanan ditolak dengan amaran *KONFLIK* dan borang dimuat semula — rekod rakan tidak ditimpa tanpa disedari. |
| **Ramai pengguna serentak** | Ralat sementara (had pelaksanaan serentak Apps Script, kunci sibuk, rangkaian lemah) dicuba semula automatik hingga 4 kali dengan tunda eksponen + rawak. Log audit ditulis dengan `appendRow` atomik. Pemadaman baris dikelompokkan (`deleteRows`). Ralat pelayan tidak dijangka dipulangkan sebagai mesej, bukan menggantung skrin. |
| **Sesi stabil** | Token log masuk ditandatangani (HMAC). Jika cache sesi dibuang oleh Google semasa beban tinggi, sesi dibina semula daripada token — guru tidak terlog keluar secara tiba-tiba. Log keluar membatalkan token. |
| **Jam betul** | Tarikh & kiraan kunci 07:10 di aplikasi mengikut jam **pelayan** (waktu Kuching), bukan jam komputer/telefon guru. |
| **Privasi** | Cache peranti dikosongkan sepenuhnya apabila log keluar (sesuai untuk komputer berkongsi). |

> Apps Script yang di-deploy sebagai *Execute as: Me* berkongsi had ~30 pelaksanaan serentak
> akaun pemilik. Cache peranti, pra-muat dan cuba semula automatik mengurangkan bilangan
> panggilan serta menyerap lonjakan pagi; untuk sekolah yang sangat besar, arkibkan Sheet
> rekod tahun lepas ke fail lain supaya bacaan kekal pantas.

## Nota Data & Keselamatan

- Hanya murid **tidak hadir** disimpan (`KETIDAKHADIRAN_HARIAN`) + satu baris ringkasan
  setiap kelas sehari (`REKOD_KELAS_HARIAN`) — Sheet kekal kecil.
- Kehadiran murid dikira berdasarkan **kelas semasa** dalam e-Data; murid yang bertukar
  kelas pertengahan tahun akan dinilai mengikut hari rekod kelas baharunya.
- Format lajur No. KP sebagai **teks biasa** (dibuat automatik oleh *Sediakan Sistem*)
  supaya sifar di hadapan tidak hilang. Pastikan e-Data juga menyimpan No. KP sebagai teks.
- Sesi log masuk 6 jam (CacheService). Semua tindakan penting dicatat dalam Sheet `AUDIT`.
- Pengimbas hanya menerima `exec` di `script.google.com` (token tidak boleh dihantar ke domain lain).
- Hadkan akses Google Sheet kepada pentadbir sistem sahaja.
