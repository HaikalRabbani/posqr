import { defineStore } from 'pinia'

export const useCartStore = defineStore('cart', {
  state: () => ({
    tableToken: null,
    tableInfo: null,
    items: [],
    customerName: '', 
    appliedDiscount: null, 
  }),
  getters: {
    totalItems: (state) => state.items.reduce((total, item) => total + item.qty, 0),
    totalPrice: (state) => state.items.reduce((total, item) => total + (item.price * item.qty), 0),

    // --- GETTER: Hitung Diskon Bertingkat (Stacking QTY) ---
    discountAmount(state) {
      if (!state.appliedDiscount) return 0;

      const discount = state.appliedDiscount;
      let eligibleTotal = 0;
      let eligibleQty = 0;

      // FIX DISKON: Pastikan tipe data sama (diubah jadi Number semua)
      const discountScope = discount.scope || 'global';

      if (discountScope === 'products' && Array.isArray(discount.product_ids)) {
        const allowedIds = discount.product_ids.map(Number);
        const inScope = state.items.filter(item => allowedIds.includes(Number(item.product_id)));
        
        eligibleTotal = inScope.reduce((sum, item) => sum + (item.price * item.qty), 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else if (discountScope === 'categories' && Array.isArray(discount.category_ids)) {
        const allowedCats = discount.category_ids.map(Number);
        const inScope = state.items.filter(item => allowedCats.includes(Number(item.category_id)));
        
        eligibleTotal = inScope.reduce((sum, item) => sum + (item.price * item.qty), 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else {
        // Global scope (Semua item kena diskon)
        eligibleTotal = this.totalPrice; 
        eligibleQty = this.totalItems;   
      }

      if (eligibleTotal <= 0) return 0;

      let finalDiscount = 0;
      const discountValue = Number(discount.value) || 0;

      // 2. Kalkulasi nilai uang diskon
      if (discount.type === 'percentage') {
        finalDiscount = eligibleTotal * (discountValue / 100);
        const maxVal = Number(discount.max_discount) || 0;
        if (maxVal > 0 && finalDiscount > maxVal) {
          finalDiscount = maxVal;
        }
      } else {
        // FIX: Diskon Nominal Dikalikan jumlah kuantitas (QTY) barang yang memenuhi syarat
        finalDiscount = discountValue * eligibleQty;
        
        // Mencegah diskon membuat total tagihan jadi minus
        finalDiscount = Math.min(finalDiscount, eligibleTotal);
      }

      return Math.round(finalDiscount);
    },

    // --- GETTER: Grand Total ---
    grandTotal() {
      return Math.max(0, this.totalPrice - this.discountAmount);
    }
  },
  actions: {
    setTable(token, info) {
      this.tableToken = token
      this.tableInfo = info
    },

    applyDiscount(discountData) {
      this.appliedDiscount = discountData
    },
    removeDiscount() {
      this.appliedDiscount = null
    },

    addItem(product) {
      // FIX BARIS GANDA: Deteksi ID apakah datang dari halaman Menu (id) atau halaman Cart (product_id)
      const productId = product.id || product.product_id;
      const price = product.price || product.pivot?.price || 0;
      const categoryId = product.category_id; 

      const existingItem = this.items.find(item => item.product_id === productId);
      
      if (existingItem) {
        existingItem.qty++; // Kalau barangnya udah ada, tambahin QTY aja
      } else {
        this.items.push({
          product_id: productId,
          name: product.name,
          price: price,
          category_id: categoryId, 
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
      this.appliedDiscount = null 
    }
  }
})