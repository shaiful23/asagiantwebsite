# Sistem Pengurusan Rumah Sukan — SMK Asajaya

Sistem pengurusan rumah sukan dengan **Google Sheets** sebagai database dan
**Google Apps Script** sebagai backend + frontend (satu Web App SPA, `Index.html`), mengikut
corak projek lain dalam repo ini (`e-pajsk`, `e-bidang`).

## Dua portal

| Portal | Pengguna | Fungsi |
| --- | --- | --- |
| **Portal Guru & Staf** | Guru dan staf AKP (Sheet `STAF`) | Dashboard, Rumah Sukan Saya (senarai guru & ahli rumah), AJK Kejohanan. Staf bertanda `Admin = YA` mendapat menu Pentadbiran |
| **Portal Murid** | Murid (Sheet `MURID`) | Rumah sukan sendiri, kategori, status atlet, guru rumah, ringkasan ahli & rakan sekelas serumah |

Skrin log masuk mempunyai tab **Portal Guru & Staf / Portal Murid**. URL `…/exec?portal=murid`
membuka terus tab Portal Murid (digunakan oleh `rumahsukanmurid.html` di akar repo).

## Log masuk & kata laluan

- **No. KP** (12 digit) + kata laluan. Kata laluan lalai = **6 digit terakhir No. KP**.
- Selepas log masuk pertama (atau selepas Admin *Reset KW*) pengguna **dipaksa menukar kata laluan**;
  kata laluan baharu tidak boleh sama dengan kata laluan lalai.
- Kata laluan disimpan sebagai hash SHA-256 bergaram No. KP. Lajur `Password` **kosong** = kata laluan
  lalai (jadi import ribuan murid adalah pantas). 5 cubaan gagal mengunci log masuk 10 minit.
- Kebenaran disahkan di **pelayan** pada setiap panggilan (status & hak Admin dibaca semula daripada Sheet).

## Fungsi Admin (menu Pentadbiran)

1. **Tetapan Rumah Sukan** — tetapkan **bilangan** rumah (2–12), **nama**, warna dan moto melalui UI.
   Rumah yang masih mempunyai ahli tidak boleh dibuang kecuali *Kosongkan ahli rumah yang dibuang*
   ditanda. Juga: tahun kejohanan, nama kejohanan dan **kategori** (ikut **umur** — tahun kejohanan
   tolak tahun lahir daripada No. KP/tarikh lahir — atau ikut **tingkatan**). Lalai: B15 (≤15), B18 (16–18),
   Terbuka (≥19).
2. **Guru & Staf AKP** — tambah/sunting, **import pukal**, tetapkan **rumah sukan** dan **peranan rumah**
   (*Ketua Guru Rumah Sukan*, *Penolong Ketua Guru Rumah Sukan*, *Guru Rumah Sukan*) terus dalam jadual
   (simpan semua perubahan sekali gus), hak Admin, status, reset kata laluan. Butang **Agih Automatik**
   mengagih staf yang belum mempunyai rumah secara sama rata (seimbang kategori GURU/AKP & jantina).
   Had: 1 Ketua Guru Rumah bagi setiap rumah (`HAD_KETUA_SETIAP_RUMAH` dalam `Config.gs`).
3. **AJK Kejohanan** — cipta jawatankuasa (cth. AJK Teknik, AJK Hadiah) dan lantik guru/AKP sebagai
   **Ketua AJK** atau **Ahli AJK** bagi tahun kejohanan semasa (seorang boleh menganggotai beberapa AJK).
   Semua staf boleh melihat senarai AJK; peranan AJK turut dipaparkan di Dashboard & Rumah Sukan Saya.
4. **Murid & Atlet** — **import pukal** (CSV, Excel `.xlsx`, atau tampal terus dari Excel/Google Sheets),
   tapis mengikut tingkatan/kelas/rumah/kategori/jantina, **tanda atlet** (kotak semak + acara) dan
   simpan sekali gus, sunting individu, tetapkan rumah secara manual (🔒 dikunci), reset kata laluan.
5. **Agihan Murid** — alat membahagikan murid kepada rumah sukan (lihat di bawah).
6. **Log Audit** — semua tindakan penting direkod dalam Sheet `LOG_AUDIT`.

### Import pukal

Baris pertama mesti header; lajur dikenal pasti mengikut **nama header** (susunan bebas). Templat CSV
boleh dimuat turun dalam kotak import.

| Data | Lajur (wajib **tebal**) |
| --- | --- |
| Murid | **NO KP, NAMA, TINGKATAN, KELAS**, JANTINA, KAUM, AGAMA, TARIKH LAHIR, NO TEL PENJAGA, ATLET (YA/TIDAK), ACARA |
| Guru/AKP | **NO KP, NAMA**, KATEGORI (GURU/AKP), JANTINA, JAWATAN, TELEFON, EMEL |

- Tiada lajur JANTINA → diteka daripada digit akhir No. KP (ganjil = lelaki).
- Lajur KELAS seperti `1 BESTARI` tanpa lajur TINGKATAN dipecah secara automatik.
- Rekod sedia ada dikemaskini; **kata laluan, rumah sukan dan peranan tidak diubah** oleh import.
- Pilihan murid: tandakan murid aktif yang **tiada** dalam fail sebagai TIDAK AKTIF (murid berpindah).

## Agihan murid ke rumah sukan

Kriteria (semuanya boleh dihidup/matikan di UI dan disimpan sebagai lalai):

| Kriteria | Lalai | Maksud |
| --- | --- | --- |
| Agih atlet dahulu | ✅ | **Murid bertanda atlet** dibahagi sama rata ke semua rumah mengikut **kategori & jantina** |
| Sebar atlet ikut acara | ✅ | Atlet bagi acara yang sama disebar ke semua rumah |
| Imbang ikut kategori | ✅ | Bilangan setiap kategori hampir sama bagi setiap rumah |
| Imbang ikut jantina | ✅ | Lelaki & perempuan diimbangi berasingan |
| Imbang ikut kelas | ✅ | **Setiap kelas** mempunyai bilangan ahli hampir sama bagi setiap rumah **mengikut jantina** (atlet dalam kelas turut dikira) |
| Kekalkan murid dikunci 🔒 | ✅ | Murid yang rumahnya ditetapkan manual tidak dipindah |
| Skop | Semua | *Semua murid aktif* (awal tahun) atau *hanya murid tanpa rumah* (murid baharu — ahli sedia ada kekal & diambil kira) |

**Cara kerja:** algoritma tamak berprioriti. Bagi setiap murid, rumah dengan kiraan terkecil dipilih
mengikut keutamaan — atlet: *(atlet kumpulan kategori+jantina, atlet acara sama, kelas+jantina,
kumpulan, jumlah)*; bukan atlet (diproses kelas demi kelas): *(kelas+jantina, kategori+jantina, jumlah)*.
Seri dipecahkan secara rawak berbiji (*seed*), jadi **Pratonton** dan **Sahkan & Simpan** menghasilkan
agihan yang sama. Pratonton memaparkan taburan setiap rumah (jumlah, L/P, atlet, kategori×jantina) dan
setiap kelas (L/P bagi setiap rumah + beza maksimum) sebelum apa-apa disimpan.

## Reka bentuk (UI)

Konsep **bersih & profesional** (sama seperti Sistem SMART): kepala biru tua dengan tab navigasi mendatar
(*Kejohanan Olahraga* dan *Pentadbiran* sebagai senarai jatuh), latar kelabu cerah, kad putih bergaris halus,
fon **Figtree** (teks) + **Inter Tight** (tajuk & nombor). Identiti SMK Asajaya dikekalkan: logo, biru tua,
kuning (butang aksi utama), merah, ungu dan warna rumah sukan.

- **Log masuk dua panel:** panel biru tua dengan logo, tajuk besar dan arena trek animasi; borang di sebelah kanan.
- **Intro ringkas** selepas log masuk, **jam digital** di kepala, **ticker papan skor langsung** di Dashboard & Pusat Kejohanan.
- Nombor KPI mengira naik, *hero* dengan lorong trek bergerak, podium & carta beranimasi (SVG/CSS tanpa pustaka luar).
- Telefon: tab menjadi menu laci. Animasi dimatikan jika peranti ditetapkan *kurangkan gerakan*; laporan cetak hitam-putih.

## Naik Tingkatan & Arkib

- **Naik Tingkatan** (*Pentadbiran → Naik Tingkatan*, Admin): pratonton mengikut tingkatan semasa dengan cadangan
  automatik (Peralihan → 1, 1 → 2 … 4 → 5, 6 Rendah → 6 Atas; Tingkatan 5 & 6 Atas → **tamat**). Setiap tindakan
  boleh diubah (Naik / Tamat / Kekal, nama tingkatan baharu). Dijalankan dengan pengesahan bertaip
  `NAIK TINGKATAN`; murid tamat dipindahkan ke **arkib** (tidak boleh log masuk lagi). Rumah sukan, kelas,
  kata laluan & No. Bib kekal. Amaran dipaparkan jika sudah dijalankan pada tahun yang sama, dan proses
  terakhir boleh **dibatalkan sepenuhnya** (tingkatan dipulihkan, murid dikembalikan daripada arkib).
- **Arkib** (*Kejohanan Olahraga → Arkib*):
  - *Kejohanan lepas* (semua guru): pilih tahun → johan keseluruhan, jadual pingat, olahragawan/olahragawati,
    pemenang setiap acara (boleh dicari) dan cetak keputusan. Nama murid lepasan kekal dipaparkan.
  - *Murid lepasan* (Admin): cari / tapis mengikut tahun tamat, **pulihkan** ke senarai murid atau **padam kekal**.
  - *Tahun baharu* (Admin): mula kejohanan tahun berikutnya — tarikh dikosongkan, pendaftaran ditutup,
    acara & rekod terbaik disalin dan jadual dijana automatik; kejohanan lama kekal dalam arkib.
- Sheet baharu `ARKIB_MURID` dan `SEJARAH_NAIK` dicipta automatik pada log masuk pertama (skema versi 5).

## Kejohanan Olahraga Tahunan (mula hingga akhir)

Menu **Kejohanan Olahraga** — semua kerja dibuat terus dalam Web App, tanpa membuka Google Sheet:

| Halaman | Fungsi |
| --- | --- |
| **Pusat Kejohanan** | Kiraan detik, 5 fasa (Persediaan → Pendaftaran → Jadual & Senarai Mula → Pertandingan → Keputusan Rasmi) dengan peratus siap, papan mata langsung, keputusan terkini, status acara |
| **Acara & Jadual** | Jana **acara standard** (100m–1500m, 4×100m, 4×400m, lompat jauh/kijang/tinggi, lontar peluru, lempar cakera, rejam lembing) bagi setiap kategori × jantina, **salin acara & rekod tahun lepas**, tambah/sunting acara, ubah no./tarikh/masa terus dalam jadual, cetak jadual |
| **Pendaftaran Atlet** | Ketua/Penolong Ketua Guru Rumah mendaftar atlet rumah sendiri bagi setiap acara (semakan automatik: kategori, jantina, had per rumah, had acara per atlet, pasukan berganti 4–6 orang) |
| **Saringan & Keputusan** | Guru/AJK hanya **memasukkan keputusan** — masa larian dengan milisaat (`12.345`, `1:05.321`), jarak (`4.35`), atau DNS/DNF/DQ. Senarai mula (saringan & lorong untuk balapan dengan atlet serumah disebar dan lorong tengah dahulu; giliran untuk padang), kedudukan (seri berkongsi kedudukan), mata, **mara ke akhir** dan **rekod** dikira automatik. Senarai mula / keputusan boleh dicetak |
| **Papan Mata & Pingat** | Johan keseluruhan (podium), jadual mata, kutipan pingat emas/perak/gangsa, sumbangan mata mengikut kategori, **olahragawan/olahragawati** setiap kategori, mata lain-lain (perbarisan, sorakan, khemah) |
| **Rekod Kejohanan** | Rekod setiap acara dikemas kini **automatik** apabila dipecahkan, dan dipulihkan sendiri jika keputusan dibetulkan (rekod sebelum kejohanan disimpan sebagai garis asas) |
| **Laporan & Cetak** | Jadual acara, senarai mula semua acara, buku keputusan, senarai pemenang, papan mata & olahragawan, senarai atlet ikut rumah (Cetak / PDF) + eksport CSV |
| **Tetapan Kejohanan** (Admin) | Tarikh, lokasi, jadual mata individu & berganti, had acara per atlet, tarikh hari padang & hari balapan 1/2, masa mula & selang jadual automatik, buka/tutup pendaftaran, terbitkan keputusan ke Portal Murid |

**Automatik sepenuhnya (tiada proses manual oleh guru):**
- **Jadual** — no. acara, tarikh & masa. Acara padang dan balapan **tidak serentak**: semua acara **padang pada 1 hari**,
  acara **balapan dibahagi kepada 2 hari** (jarak menaik, berganti-ganti di akhir). Lalai: padang = tarikh kejohanan,
  balapan = hari ke-2 & ke-3; ketiga-tiga tarikh, masa mula dan selang boleh diubah di Tetapan Kejohanan
  (jadual disusun semula sendiri apabila tetapan ini diubah).
- **No. Bib** — diberi sebaik atlet didaftarkan (`<no. rumah><3 digit>`, cth. 1001).
- **Senarai mula** — dijana apabila pendaftaran ditutup (atau sebaik acara dibuka di halaman keputusan).
- **Kedudukan, mata, pingat, papan mata, olahragawan/olahragawati** — sebaik keputusan disimpan; dikira semula jika jadual mata ditukar.
- **Mara ke akhir** — finalis terbaik merentasi semua saringan dipilih sebaik semua saringan lengkap.
- **Rekod kejohanan** — dikemas kini sendiri (tiada pengesahan diperlukan).

**Kawalan manual mengatasi automasi.** Admin dan guru/AJK yang mempunyai akses boleh menyunting apa sahaja hasil
automatik; suntingan itu **dikunci** dan tidak ditimpa oleh fungsi automatik:

| Perkara | Cara sunting | Kembali automatik |
|---|---|---|
| Jadual (no., tarikh, masa) | Terus dalam jadual *Acara & Jadual* atau borang acara (ikon 🔒) | Kosongkan tarikh & masa, atau *Jana jadual automatik* → tanda "termasuk acara disunting manual" |
| Senarai mula (saringan, lorong / giliran) | *Saringan & Keputusan* → **Sunting lorong / saringan** | *Rawak semula lorong* / *Set semula* |
| Finalis ke akhir | Tanda lajur **Ke akhir** → **Simpan pilihan finalis** | *Set semula* |
| Kedudukan (photo-finish / keputusan hakim) | Isi lajur **Kedudukan** (mata ikut kedudukan manual) | Kosongkan lajur (auto) |
| Rekod semasa | Borang acara → **Tetapkan rekod semasa secara manual** (lencana *Manual*) | Nyahtanda pilihan itu |
| No. Bib | *Murid & Atlet* → sunting murid → No. Bib | Kosongkan medan |

**Kebenaran:** Admin (semua) · AJK yang ditanda *Akses keputusan* (jadual, senarai mula, keputusan) ·
Ketua/Penolong Ketua Guru Rumah (pendaftaran atlet rumah sendiri semasa pendaftaran dibuka) · staf lain (lihat).
Portal Murid memaparkan **kad bib atlet**, acara sendiri (saringan, lorong, keputusan) dan papan mata selepas
keputusan diterbitkan.

## Prestasi & kestabilan

- **Satu panggilan pelayan** semasa log masuk / muat semula (profil + tetapan + dashboard sekaligus).
- Data permulaan disimpan dalam `sessionStorage` — muat semula halaman dipaparkan serta-merta.
- Cache memori klien bagi bacaan (60 saat; dikosongkan oleh setiap simpanan) + cache pelayan (CacheService).
- Rangka pemuat (*skeleton*) & bar kemajuan; bacaan yang gagal sementara dicuba semula secara automatik.
- **Migrasi skema automatik** (`Migrasi.gs`): Sheet/lajur baharu dicipta sendiri pada log masuk pertama
  selepas naik taraf — tidak perlu membuka Google Sheet.

## Struktur Sheet (database)

| Sheet | Kandungan |
| --- | --- |
| `STAF` | NoKP, Password, NamaPenuh, Kategori (GURU/AKP), Jantina, Jawatan, Telefon, Emel, Admin, RumahId, PerananRumah, MestiTukarPassword, Status, Dikemaskini |
| `MURID` | NoKP, Password, NamaPenuh, Jantina, Tingkatan, Kelas, Kaum, Agama, TarikhLahir, NoTelPenjaga, Atlet, Acara, RumahId, KunciRumah, MestiTukarPassword, Status, Dikemaskini |
| `RUMAH_SUKAN` | RumahId, Nama, Warna, Moto, Susunan |
| `AJK` / `AJK_AHLI` | Senarai AJK; lantikan (AjkId, NoKP, Peranan KETUA_AJK/AHLI_AJK, Tahun) |
| `TETAPAN` | Tahun & nama kejohanan, mod & senarai kategori, kriteria agihan, ringkasan agihan terakhir |
| `LOG_AUDIT` | Log tindakan |
| `ACARA` | Acara setiap tahun: jenis, kategori, jantina, unit, had, lorong, tarikh/masa, status, rekod |
| `PESERTA` | Penyertaan + pusingan/saringan/lorong + keputusan, kedudukan, mata, pecah rekod |
| `MATA_LAIN` | Mata bukan acara (perbarisan, sorakan, …) |

Jangan ubah nama header. Suntingan manual dalam Sheet dikesan oleh `onEdit` (cache dikosongkan).

## Cara pasang

1. Cipta Google Sheet baharu (cth. *Sistem Rumah Sukan SMK Asajaya*) → **Extensions → Apps Script**.
2. Salin semua fail dalam folder ini ke projek Apps Script — fail `.gs` sebagai *Script*; `Index.html`,
   `Css.html`, `JsTeras.html`, `JsPortal.html`, `JsAdmin.html`, `JsKejohanan.html` dan `Logo.html` sebagai *HTML*
   (nama fail mesti sama, tanpa sambungan). Gantikan `appsscript.json` (Project Settings → *Show "appsscript.json"*).
3. Muat semula Sheet → menu **Sistem Rumah Sukan → 1. Sediakan Sistem**. Benarkan akses, kemudian
   masukkan No. KP & nama Admin pertama.
4. **Deploy → New deployment → Web app**: *Execute as: Me*, *Who has access: Anyone*. Salin URL `/exec`.
5. Gantikan `GANTI_DENGAN_EXEC_URL_ANDA` dalam `rumahsukan.html` (Portal Guru) dan
   `rumahsukanmurid.html` (Portal Murid, kekalkan `?portal=murid`) di akar repo.
6. Log masuk sebagai Admin → **Tetapan Rumah Sukan** → **Guru & Staf AKP** (import) → **Murid & Atlet**
   (import + tanda atlet) → **Agihan Murid** → tetapkan Ketua/Penolong rumah & AJK.

`Logo.html` mengandungi logo sekolah (PNG base64) yang dipaparkan pada skrin log masuk dan menu.
Menu Sheet **2. Tambah / Pulihkan Admin** boleh digunakan jika Admin terlupa kata laluan
(kata laluan di-set semula kepada lalai).

**Naik taraf daripada versi lama:** salin semula semua fail (termasuk fail baharu `ArkibService.gs` dan `JsArkib.html`), kemudian
**Deploy → Manage deployments → Edit → New version**. Sheet `ACARA`, `PESERTA`, `MATA_LAIN` dan lajur baharu
(`MURID.NoBib`, `AJK.AksesKeputusan`, `ACARA.JadualManual/AkhirManual/RekodManual`, `PESERTA.KedudukanManual`, Sheet `ARKIB_MURID` & `SEJARAH_NAIK`) dicipta secara automatik pada log masuk pertama.

## Penyelesaian masalah

- **Menu "Sistem Rumah Sukan" tidak muncul** — pastikan kod terkini `Code.gs` digunakan, kemudian
  muat semula Sheet. Jika masih tiada, buka Apps Script, pilih fungsi `onOpen` dan tekan **Run** sekali
  (benarkan akses); ralat semasa memuatkan skrip akan dipaparkan dalam *Execution log*.
- **Ralat `google.script.run…[fn] is not a function` / "Fungsi pelayan … tiada"** — bukan disebabkan data
  murid kosong. Pelayar meminta fungsi yang tiada dalam versi Web App yang sedang di-deploy: sama ada
  fail `.gs` (biasanya `KejohananService.gs`) belum disalin / masih versi lama, atau deployment belum
  dikemas kini. Jalankan menu **Sistem Rumah Sukan → 4. Semak Pemasangan**, salin semula fail yang
  disenaraikan, kemudian **Deploy → Manage deployments → Edit → Version: New version → Deploy**.
