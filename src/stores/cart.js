import { defineStore } from 'pinia'

export const useCartStore = defineStore('cart', {
  state: () => ({
    tableToken: null,
    tableInfo: null,
    items: [],
    customerName: '', // Simpan nama di sini
    appliedDiscount: null, // State baru untuk menyimpan data diskon/promo
  }),
  getters: {
    totalItems: (state) => state.items.reduce((total, item) => total + item.qty, 0),
    totalPrice: (state) => state.items.reduce((total, item) => total + (item.price * item.qty), 0),

    // --- GETTER BARU: Hitung Diskon Bertingkat (Stacking QTY) ---
    discountAmount(state) {
      if (!state.appliedDiscount) return 0;

      const discount = state.appliedDiscount;
      let eligibleTotal = 0;
      let eligibleQty = 0;

      // 1. Tentukan barang apa saja yang kena diskon (Scope)
      if (discount.scope === 'products' && Array.isArray(discount.product_ids)) {
        const inScope = state.items.filter(item => discount.product_ids.includes(item.product_id));
        eligibleTotal = inScope.reduce((sum, item) => sum + (item.price * item.qty), 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else if (discount.scope === 'categories' && Array.isArray(discount.category_ids)) {
        const inScope = state.items.filter(item => discount.category_ids.includes(item.category_id));
        eligibleTotal = inScope.reduce((sum, item) => sum + (item.price * item.qty), 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else {
        // Global scope (Semua item kena diskon)
        eligibleTotal = this.totalPrice; 
        eligibleQty = this.totalItems;   
      }

      if (eligibleTotal <= 0) return 0;

      let finalDiscount = 0;

      // 2. Kalkulasi nilai uang diskon
      if (discount.type === 'percentage') {
        finalDiscount = eligibleTotal * (discount.value / 100);
        if (discount.max_discount > 0 && finalDiscount > discount.max_discount) {
          finalDiscount = discount.max_discount;
        }
      } else {
        // Diskon Nominal: Dikalikan jumlah kuantitas (QTY) barang yang dibeli
        finalDiscount = discount.value * eligibleQty;
        
        // Mencegah diskon membuat total tagihan jadi minus
        finalDiscount = Math.min(finalDiscount, eligibleTotal);
      }

      return Math.round(finalDiscount);
    },

    // --- GETTER BARU: Grand Total (Subtotal dikurangi Diskon) ---
    grandTotal() {
      return Math.max(0, this.totalPrice - this.discountAmount);
    }
  },
  actions: {
    setTable(token, info) {
      this.tableToken = token
      this.tableInfo = info
    },

    // --- ACTION BARU: Pasang / Copot Diskon ---
    applyDiscount(discountData) {
      this.appliedDiscount = discountData
    },
    removeDiscount() {
      this.appliedDiscount = null
    },

    addItem(product) {
      const price = product.price || product.pivot?.price || 0
      const existingItem = this.items.find(item => item.product_id === product.id)
      if (existingItem) {
        existingItem.qty++
      } else {
        this.items.push({
          product_id: product.id,
          name: product.name,
          price: price,
          category_id: product.category_id, // PENTING: Wajib dibawa untuk validasi diskon kategori
          qty: 1
        })
      }
    },
    removeItem(productId) {
      const index = this.items.findIndex(item => item.product_id === productId)
      if (index !== -1) {
        if (this.items[index].qty > 1) {
          this.items[index].qty--
        } else {
          this.items.splice(index, 1)
        }
      }
    },
    clearCart() {
      this.items = []
      this.customerName = ''
      this.appliedDiscount = null // Pastikan diskon ke-reset saat keranjang kosong
    }
  }
})