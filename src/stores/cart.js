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

      const discountScope = discount.scope || 'global';
      const discountValue = Number(discount.value) || 0;

      if (discountScope === 'products') {
        // Handle format API (product_ids array mentah atau relasi products)
        let allowedIds = [];
        if (Array.isArray(discount.product_ids)) allowedIds = discount.product_ids.map(Number);
        else if (Array.isArray(discount.products)) allowedIds = discount.products.map(p => Number(p.id));

        const inScope = state.items.filter(item => allowedIds.includes(Number(item.product_id)));
        eligibleTotal = inScope.reduce((sum, item) => sum + (item.price * item.qty), 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else if (discountScope === 'categories') {
        let allowedCats = [];
        if (Array.isArray(discount.category_ids)) allowedCats = discount.category_ids.map(Number);
        else if (Array.isArray(discount.categories)) allowedCats = discount.categories.map(c => Number(c.id));

        const inScope = state.items.filter(item => allowedCats.includes(Number(item.category_id)));
        eligibleTotal = inScope.reduce((sum, item) => sum + (item.price * item.qty), 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else {
        // Global scope
        eligibleTotal = this.totalPrice; 
        eligibleQty = this.totalItems;   
      }

      if (eligibleTotal <= 0) return 0;

      let finalDiscount = 0;
      
      if (discount.type === 'percentage') {
        finalDiscount = eligibleTotal * (discountValue / 100);
        const maxVal = Number(discount.max_discount) || 0;
        if (maxVal > 0 && finalDiscount > maxVal) finalDiscount = maxVal;
      } else {
        // Diskon Nominal
        if (discountScope === 'global') {
             // Jika diskon global, hitungan tidak dikali QTY (sesuai backend)
             finalDiscount = discountValue;
        } else {
             // Jika diskon per produk/kategori, WAJIB dikali QTY
             finalDiscount = discountValue * eligibleQty;
        }
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
      // FIX BARIS GANDA: Konversi semua ID ke tipe Number yang mutlak!
      const productId = Number(product.id || product.product_id);
      const price = Number(product.price || product.pivot?.price || 0);
      const categoryId = Number(product.category_id || 0); 

      const existingItem = this.items.find(item => Number(item.product_id) === productId);
      
      if (existingItem) {
        existingItem.qty++; // Sekarang pasti ketemu dan dijumlahkan
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
      const index = this.items.findIndex(item => Number(item.product_id) === Number(productId))
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