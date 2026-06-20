import { defineStore } from 'pinia'

export const useCartStore = defineStore('cart', {
  state: () => ({
    tableToken: null,
    tableInfo: null,
    items: [],
    customerName: '', 
    appliedDiscount: null, // Menyimpan object voucher global pilihan user
  }),
  getters: {
    totalItems: (state) => state.items.reduce((total, item) => total + item.qty, 0),
    
    // MENANGANI HARGA CORET VS HARGA NORMAL SECARA DINAMIS
    totalPrice(state) {
      // Hitung subtotal murni berdasarkan harga asli dulu sebagai basis pengecekan syarat
      const subtotalMurni = state.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0);

      return state.items.reduce((total, item) => {
        let currentPrice = Number(item.price);

        // KONDISI 1: User TIDAK sedang pakai voucher global
        if (!state.appliedDiscount) {
          // Diskon produk aktif HANYA JIKA min_purchase = 0 ATAU total belanja murni sudah lolos syarat min_purchase produk
          const lulusSyaratProduk = !item.min_purchase || Number(item.min_purchase) === 0 || subtotalMurni >= Number(item.min_purchase);
          
          if (item.is_promo && lulusSyaratProduk) {
            currentPrice = Number(item.promo_price);
          }
        }
        // KONDISI 2: User SEDANG pakai voucher global
        // Jika voucher global dipilih, abaikan diskon produk otomatis (semua item kembali ke harga normal)
        
        return total + (currentPrice * item.qty);
      }, 0);
    },

    // HITUNG DISKON VOUCHER GLOBAL (Abaikan promo produk di sini)
    discountAmount(state) {
      if (!state.appliedDiscount) return 0;

      const discount = state.appliedDiscount;
      const discountScope = discount.scope || 'global';
      const discountValue = Number(discount.value) || 0;

      // Gunakan harga normal/asli produk sebagai basis DPP diskon global (karena promo produk di-override)
      const baseSubtotalMurni = state.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0);

      // VALIDASI UTAMA: Jika total belanja harga normal tidak lolos min_purchase voucher global, diskon = 0
      if (discount.min_purchase > 0 && baseSubtotalMurni < Number(discount.min_purchase)) {
        return 0;
      }

      let eligibleTotal = 0;
      let eligibleQty = 0;

      if (discountScope === 'products') {
        let allowedIds = [];
        if (Array.isArray(discount.product_ids)) allowedIds = discount.product_ids.map(Number);
        else if (Array.isArray(discount.products)) allowedIds = discount.products.map(p => Number(p.id));

        const inScope = state.items.filter(item => allowedIds.includes(Number(item.product_id)));
        eligibleTotal = inScope.reduce((sum, item) => sum + (Number(item.price) * item.qty), 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else if (discountScope === 'categories') {
        let allowedCats = [];
        if (Array.isArray(discount.category_ids)) allowedCats = discount.category_ids.map(Number);
        else if (Array.isArray(discount.categories)) allowedCats = discount.categories.map(c => Number(c.id));

        const inScope = state.items.filter(item => allowedCats.includes(Number(item.category_id)));
        eligibleTotal = inScope.reduce((sum, item) => sum + (Number(item.price) * item.qty), 0);
        eligibleQty = inScope.reduce((sum, item) => sum + item.qty, 0);

      } else {
        eligibleTotal = baseSubtotalMurni; 
        eligibleQty = state.items.reduce((total, item) => total + item.qty, 0);   
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

    grandTotal() {
      // Jika sedang pakai diskon voucher global, potong dari nilai murni base price item
      if (this.appliedDiscount) {
        const baseSubtotalMurni = this.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0);
        return Math.max(0, baseSubtotalMurni - this.discountAmount);
      }
      // Jika normal, langsung pakai kalkulasi totalPrice bawaan promo produk yang valid
      return Math.max(0, this.totalPrice);
    },

    isDiscountEligible: (state) => (discount) => {
      const subtotalMurni = state.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0);
      const meetMinPurchase = discount.min_purchase === 0 || subtotalMurni >= discount.min_purchase;
      if (!meetMinPurchase) return false;

      const scope = discount.scope || 'global';
      
      if (scope === 'products') {
        let allowedIds = [];
        if (Array.isArray(discount.product_ids)) allowedIds = discount.product_ids.map(Number);
        else if (Array.isArray(discount.products)) allowedIds = discount.products.map(p => Number(p.id));
        return state.items.some(item => allowedIds.includes(Number(item.product_id)));
        
      } else if (scope === 'categories') {
        let allowedCats = [];
        if (Array.isArray(discount.category_ids)) allowedCats = discount.category_ids.map(Number);
        else if (Array.isArray(discount.categories)) allowedCats = discount.categories.map(c => Number(c.id));
        return state.items.some(item => allowedCats.includes(Number(item.category_id)));
      }

      return true;
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

      const isPromo = product.is_promo || false;
      const promoPrice = product.promo_price ? Number(product.promo_price) : price;
      const discountAmountPerItem = product.discount_amount_per_item ? Number(product.discount_amount_per_item) : 0;
      const minPurchase = product.min_purchase ? Number(product.min_purchase) : 0; // Ambil data min_purchase produk
      const stock = (product.stock !== undefined && product.stock !== null) ? Number(product.stock) : Infinity;

      const existingItem = this.items.find(item => Number(item.product_id) === productId);

      if (existingItem) {
        const stockLimit = (existingItem.stock !== undefined && existingItem.stock !== null) ? existingItem.stock : stock;
        if (existingItem.qty >= stockLimit) {
          return { success: false, reason: 'stock_limit' }
        }
        existingItem.qty++;
      } else {
        if (stock <= 0) {
          return { success: false, reason: 'stock_limit' }
        }
        this.items.push({
          product_id: productId,
          name: product.name,
          price: price,
          category_id: categoryId, 
          qty: 1,
          is_promo: isPromo,
          promo_price: promoPrice,
          discount_amount_per_item: discountAmountPerItem,
          min_purchase: minPurchase,
          stock: stock
        })
      }
      return { success: true }
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
      localStorage.removeItem('posqr_last_order_id')
    }
  }
})