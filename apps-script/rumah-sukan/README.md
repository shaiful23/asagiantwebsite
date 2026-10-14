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

## Struktur Sheet (database)

| Sheet | Kandungan |
| --- | --- |
| `STAF` | NoKP, Password, NamaPenuh, Kategori (GURU/AKP), Jantina, Jawatan, Telefon, Emel, Admin, RumahId, PerananRumah, MestiTukarPassword, Status, Dikemaskini |
| `MURID` | NoKP, Password, NamaPenuh, Jantina, Tingkatan, Kelas, Kaum, Agama, TarikhLahir, NoTelPenjaga, Atlet, Acara, RumahId, KunciRumah, MestiTukarPassword, Status, Dikemaskini |
| `RUMAH_SUKAN` | RumahId, Nama, Warna, Moto, Susunan |
| `AJK` / `AJK_AHLI` | Senarai AJK; lantikan (AjkId, NoKP, Peranan KETUA_AJK/AHLI_AJK, Tahun) |
| `TETAPAN` | Tahun & nama kejohanan, mod & senarai kategori, kriteria agihan, ringkasan agihan terakhir |
| `LOG_AUDIT` | Log tindakan |

Jangan ubah nama header. Suntingan manual dalam Sheet dikesan oleh `onEdit` (cache dikosongkan).

## Cara pasang

1. Cipta Google Sheet baharu (cth. *Sistem Rumah Sukan SMK Asajaya*) → **Extensions → Apps Script**.
2. Salin semua fail dalam folder ini ke projek Apps Script (fail `.gs` sebagai *Script*, `Index.html` dan
   `Logo.html` sebagai *HTML*; nama fail mesti sama tanpa sambungan). Gantikan `appsscript.json`
   (Project Settings → *Show "appsscript.json"*).
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

## Penyelesaian masalah

- **Menu "Sistem Rumah Sukan" tidak muncul** — pastikan kod terkini `Code.gs` digunakan, kemudian
  muat semula Sheet. Jika masih tiada, buka Apps Script, pilih fungsi `onOpen` dan tekan **Run** sekali
  (benarkan akses); ralat semasa memuatkan skrip akan dipaparkan dalam *Execution log*.
