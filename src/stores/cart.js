import { defineStore } from 'pinia'
import api from '../services/api.js'

export const useCartStore = defineStore('cart', {
  state: () => ({
    tableToken: null,
    tableInfo: null,
    onlinePaymentAvailable: true,
    items: [],
    customerName: '',
    // Daftar diskon yang dipasang user.
    // - Diskon scope produk/kategori boleh lebih dari satu (bertumpuk).
    // - Diskon global hanya boleh satu DAN eksklusif (tidak bisa dibarengi yang lain).
    appliedDiscounts: [],
    cachedTaxes: null,
    cachedDiscounts: null,
  }),
  getters: {
    totalItems: (state) => state.items.reduce((total, item) => total + item.qty, 0),
    
    // MENANGANI HARGA CORET VS HARGA NORMAL SECARA DINAMIS
    totalPrice(state) {
      // Hitung subtotal murni berdasarkan harga asli dulu sebagai basis pengecekan syarat
      const subtotalMurni = state.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0);

      return state.items.reduce((total, item) => {
        let currentPrice = Number(item.price);

        // KONDISI 1: User TIDAK sedang pakai voucher/diskon apa pun
        if (state.appliedDiscounts.length === 0) {
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

    // Diskon global yang sedang aktif (kalau ada). Global selalu eksklusif.
    globalDiscount(state) {
      return state.appliedDiscounts.find(d => (d.scope || 'global') === 'global') || null;
    },

    // Kompatibilitas: sebagian kode lama mengacu ke satu diskon. Kembalikan yang pertama.
    appliedDiscount(state) {
      return state.appliedDiscounts[0] || null;
    },

    // TOTAL POTONGAN (abaikan promo produk otomatis selama ada diskon yang dipasang).
    // Mendukung dua mode: satu diskon global, ATAU beberapa diskon produk/kategori
    // bertumpuk (tiap item hanya didiskon sekali, ambil yang paling menguntungkan).
    discountAmount(state) {
      if (state.appliedDiscounts.length === 0) return 0;

      const baseSubtotalMurni = state.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0);

      // --- MODE GLOBAL (eksklusif, satu diskon) ---
      const global = state.appliedDiscounts.find(d => (d.scope || 'global') === 'global');
      if (global) {
        if (global.min_purchase > 0 && baseSubtotalMurni < Number(global.min_purchase)) return 0;
        if (baseSubtotalMurni <= 0) return 0;

        const value = Number(global.value) || 0;
        let finalDiscount = 0;
        if (global.type === 'percentage') {
          finalDiscount = baseSubtotalMurni * (value / 100);
          const maxVal = Number(global.max_discount) || 0;
          if (maxVal > 0 && finalDiscount > maxVal) finalDiscount = maxVal;
        } else {
          finalDiscount = Math.min(value, baseSubtotalMurni);
        }
        return Math.round(finalDiscount);
      }

      // --- MODE BERTUMPUK (produk/kategori, boleh banyak) ---
      // Hanya diskon yang lolos min_purchase yang ikut dihitung.
      const eligible = state.appliedDiscounts.filter(d => {
        const min = Number(d.min_purchase) || 0;
        return min === 0 || baseSubtotalMurni >= min;
      });
      if (eligible.length === 0) return 0;

      const matchesItem = (d, item) => {
        const scope = d.scope || 'global';
        if (scope === 'products') {
          let allowedIds = [];
          if (Array.isArray(d.product_ids)) allowedIds = d.product_ids.map(Number);
          else if (Array.isArray(d.products)) allowedIds = d.products.map(p => Number(p.id));
          return allowedIds.includes(Number(item.product_id));
        }
        if (scope === 'categories') {
          let allowedCats = [];
          if (Array.isArray(d.category_ids)) allowedCats = d.category_ids.map(Number);
          else if (Array.isArray(d.categories)) allowedCats = d.categories.map(c => Number(c.id));
          return allowedCats.includes(Number(item.category_id));
        }
        return false;
      };

      // Tiap item: pilih satu diskon dengan potongan terbesar, akumulasi per diskon
      // agar cap max_discount bisa diterapkan per diskon (sama persis dgn backend).
      const perDiscountSum = {};
      for (const item of state.items) {
        const line = Number(item.price) * item.qty;
        let bestVal = 0;
        let bestId = null;
        for (const d of eligible) {
          if (!matchesItem(d, item)) continue;
          const value = Number(d.value) || 0;
          const val = d.type === 'percentage' ? line * (value / 100) : value * item.qty;
          if (val > bestVal) {
            bestVal = val;
            bestId = d.id;
          }
        }
        if (bestId !== null && bestVal > 0) {
          perDiscountSum[bestId] = (perDiscountSum[bestId] || 0) + bestVal;
        }
      }

      let total = 0;
      for (const [id, sum] of Object.entries(perDiscountSum)) {
        const d = eligible.find(x => String(x.id) === String(id));
        let capped = sum;
        if (d && d.type === 'percentage') {
          const maxVal = Number(d.max_discount) || 0;
          if (maxVal > 0 && capped > maxVal) capped = maxVal;
        }
        total += capped;
      }

      return Math.round(Math.min(baseSubtotalMurni, total));
    },

    grandTotal() {
      // Jika ada diskon yang dipasang, potong dari subtotal harga normal (promo produk di-override)
      if (this.appliedDiscounts.length > 0) {
        const baseSubtotalMurni = this.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0);
        return Math.max(0, baseSubtotalMurni - this.discountAmount);
      }
      // Jika normal, langsung pakai kalkulasi totalPrice bawaan promo produk yang valid
      return Math.max(0, this.totalPrice);
    },

    isDiscountEligible: (state) => (discount) => {
      const subtotalMurni = state.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0);
      const minPurchase = Number(discount.min_purchase) || 0;
      const meetMinPurchase = minPurchase === 0 || subtotalMurni >= minPurchase;
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
    setTable(token, info, onlinePaymentAvailable = true) {
      this.tableToken = token
      this.tableInfo = info
      this.onlinePaymentAvailable = onlinePaymentAvailable
    },
    isDiscountApplied(discountData) {
      return this.appliedDiscounts.some(d => String(d.id) === String(discountData.id))
    },
    applyDiscount(discountData) {
      const scope = discountData.scope || 'global'
      if (scope === 'global') {
        // Global eksklusif: buang semua diskon lain, sisakan global ini saja.
        this.appliedDiscounts = [discountData]
        return
      }
      // Produk/kategori: boleh bertumpuk, tapi tidak boleh dibarengi diskon global.
      this.appliedDiscounts = this.appliedDiscounts.filter(d => (d.scope || 'global') !== 'global')
      if (!this.isDiscountApplied(discountData)) {
        this.appliedDiscounts.push(discountData)
      }
    },
    toggleDiscount(discountData) {
      if (this.isDiscountApplied(discountData)) {
        this.removeDiscount(discountData.id)
      } else {
        this.applyDiscount(discountData)
      }
    },
    removeDiscount(discountId = null) {
      if (discountId === null) {
        this.appliedDiscounts = []
      } else {
        this.appliedDiscounts = this.appliedDiscounts.filter(d => String(d.id) !== String(discountId))
      }
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
      this.appliedDiscounts = []
      this.cachedTaxes = null
      this.cachedDiscounts = null
      localStorage.removeItem('posqr_last_order_id')
    }
  }
})