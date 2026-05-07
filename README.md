# POS Mobile - Self Order QR System

[![Vue.js](https://img.shields.io/badge/Vue.js-3.x-4fc08d?style=flat-flat&logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6.x-646cff?style=flat-flat&logo=vite)](https://vitejs.dev/)
[![Pinia](https://img.shields.io/badge/Pinia-2.x-ffe066?style=flat-flat&logo=vue.js)](https://pinia.vuejs.org/)
[![Axios](https://img.shields.io/badge/Axios-1.x-5a29e4?style=flat-flat&logo=axios)](https://axios-http.com/)

Aplikasi frontend berbasis web mobile untuk sistem pemesanan mandiri (*self-order*) menggunakan kode QR. Pelanggan dapat memindai QR di meja, memilih menu, masuk ke keranjang belanja, dan melakukan pembayaran secara langsung menggunakan *payment gateway* terintegrasi.

## 🚀 Fitur Utama

* **Sistem Scan QR Meja**: Mengidentifikasi posisi meja pelanggan secara otomatis melalui token parameter URL.
* **Manajemen Menu & Kategori**: Navigasi produk yang dinamis, cepat, dan responsif dengan fitur filter kategori.
* **Keranjang Belanja Pintar (Cart)**: Menambah, mengurangi, atau menghapus item, serta menyertakan catatan khusus (*notes*) untuk setiap menu yang dipesan.
* **Kalkulasi Biaya Akurat**: Perhitungan otomatis untuk subtotal, potongan diskon (termasuk minimal belanja), dan pajak restoran (PB1).
* **Integrasi Pembayaran**: Mendukung pembayaran via **Midtrans** (QRIS, E-Wallet, dll.) untuk transaksi *cashless*, serta opsi bayar di kasir secara tunai.
* **Halaman Status & Struk**: Melacak status pesanan secara *real-time* setelah pembayaran sukses.

## 🛠️ Stack Teknologi

Aplikasi ini dibangun menggunakan ekosistem modern Vue:

* **Core Framework:** Vue 3 (Composition API dengan `<script setup>`)
* **State Management:** Pinia (Modul terpisah untuk manajemen data keranjang)
* **Routing:** Vue Router (Single Page Application)
* **HTTP Client:** Axios (Terintegrasi dengan konfigurasi *interceptor* dan *global base URL*)
* **Build Tool:** Vite
* **Linter & Formatter:** ESLint, Oxlint, dan Prettier untuk menjaga konsistensi standar kode.

## 📂 Struktur Proyek

```text
posqr/
├── src/
│   ├── assets/          # File aset statis dan CSS global (main.css)
│   ├── pages/           # Komponen halaman utama aplikasi
│   │   ├── menu.vue     # Halaman daftar menu dan pemilihan kategori
│   │   ├── cart.vue     # Halaman ringkasan keranjang dan kalkulasi checkout
│   │   └── status.vue   # Halaman status pembayaran dan struk belanja
│   ├── router/          # Konfigurasi rute navigasi Vue Router
│   ├── services/        # Konfigurasi Axios API client (api.js)
│   ├── stores/          # Manajemen state global Pinia (cart.js, counter.js)
│   ├── App.vue          # Root component aplikasi
│   └── main.js          # Entry point utama aplikasi
├── index.html           # Template HTML utama
├── package.json         # Dependensi proyek dan skrip NPM
└── vite.config.js       # Konfigurasi bundler Vite