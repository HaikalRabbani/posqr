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
    
    // 1. MODIFIKASI: totalPrice sekarang menghitung pakai harga promo jika produk memiliki promo dari backend
    totalPrice: (state) => {
      return state.items.reduce((total, item) => {
        const currentPrice = item.is_promo ? Number(item.promo_price) : Number(item.price);
        return total + (currentPrice * item.qty);
      }, 0);
    },

    // 2. TAMBAHAN: Menghitung total kehematan dari diskon coret otomatis untuk info nota di Vue
    totalProductDiscount: (state) => {
      return state.items.reduce((sum, item) => {
        if (item.is_promo && item.discount_amount_per_item) {
          return sum + (Number(item.discount_amount_per_item) * item.qty);
        }
        return sum;
      }, 0);
    },

    // 3. TAMBAHAN: Mendeteksi apakah di keranjang ada barang promo otomatis (untuk kunci voucher global nanti)
    hasProductWithDiscount: (state) => {
      return state.items.some(item => item.is_promo);
    },

    // --- GETTER: Hitung Diskon Manual / Voucher Global ---
    discountAmount(state) {
      if (!state.appliedDiscount) return 0;

      const discount = state.appliedDiscount;
      let eligibleTotal = 0;
      let eligibleQty = 0;

      const discountScope = discount.scope || 'global';
      const discountValue = Number(discount.value) || 0;

      if (discountScope === 'products') {
        let allowedIds = [];
        if (Array.isArray(discount.product_ids)) allowedIds = discount.product_ids.map(Number);
        else if (Array.isArray(discount.products)) allowedIds = discount.products.map(p => Number(p.id));

        const inScope = state.items.filter(item => allowedIds.includes(Number(item.product_id)));
        eligibleTotal = inScope.reduce((sum, item) => {
          const currentPrice = item.is_promo ? Number(item.promo_price) : Number(item.price);
          return sum + (currentPrice * item.qty);
        }, 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else if (discountScope === 'categories') {
        let allowedCats = [];
        if (Array.isArray(discount.category_ids)) allowedCats = discount.category_ids.map(Number);
        else if (Array.isArray(discount.categories)) allowedCats = discount.categories.map(c => Number(c.id));

        const inScope = state.items.filter(item => allowedCats.includes(Number(item.category_id)));
        eligibleTotal = inScope.reduce((sum, item) => {
          const currentPrice = item.is_promo ? Number(item.promo_price) : Number(item.price);
          return sum + (currentPrice * item.qty);
        }, 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else {
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
        if (discountScope === 'global') {
             finalDiscount = discountValue;
        } else {
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
      const productId = Number(product.id || product.product_id);
      const price = Number(product.price || product.pivot?.price || 0);
      const categoryId = Number(product.category_id || 0); 

      // Ambil properti diskon bawaan dari backend appends (jika ada)
      const isPromo = product.is_promo || false;
      const promoPrice = product.promo_price ? Number(product.promo_price) : price;
      const discountAmountPerItem = product.discount_amount_per_item ? Number(product.discount_amount_per_item) : 0;

      const existingItem = this.items.find(item => Number(item.product_id) === productId);
      
      if (existingItem) {
        existingItem.qty++; 
      } else {
        this.items.push({
          product_id: productId,
          name: product.name,
          price: price,
          category_id: categoryId, 
          qty: 1,
          // Simpan status promo di level item keranjang agar sinkron
          is_promo: isPromo,
          promo_price: promoPrice,
          discount_amount_per_item: discountAmountPerItem
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