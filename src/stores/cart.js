import { defineStore } from 'pinia'

export const useCartStore = defineStore('cart', {
  state: () => ({
    tableToken: null,
    tableInfo: null,
    items: [], // Tempat menampung makanan yang dipilih
  }),
  
  getters: {
    // Menghitung total jumlah barang (otomatis update)
    totalItems: (state) => state.items.reduce((total, item) => total + item.qty, 0),
    // Menghitung total harga (otomatis update)
    totalPrice: (state) => state.items.reduce((total, item) => total + (item.price * item.qty), 0),
  },
  
  actions: {
    setTable(token, info) {
      this.tableToken = token
      this.tableInfo = info
    },
    
    addItem(product) {
      // Prioritaskan harga pivot (harga khusus cabang) jika ada
      const price = product.price || product.pivot?.price || 0;
      
      // Cek apakah makanan ini sudah ada di keranjang
      const existingItem = this.items.find(item => item.product_id === product.id)
      
      if (existingItem) {
        existingItem.qty++ // Kalau sudah ada, tambah jumlahnya
      } else {
        this.items.push({ // Kalau belum, masukkan sebagai barang baru
          product_id: product.id,
          name: product.name,
          price: price,
          image: product.image, // Nanti disesuaikan dengan nama kolom gambar
          qty: 1
        })
      }
    }
  }
})