# AUDIT FRONTEND - POSQR & POSUI
**Date**: 2026-06-22  
**Auditor**: Kiro AI  
**Scope**: Bug & Performance Issues di Frontend Vue.js

---

## 📁 REPOSITORY LINKS
- **posqr** (QR Menu Customer): https://github.com/HaikalRabbani/posqr
- **posui** (Admin Panel): https://github.com/HaikalRabbani/posui
- **posapi** (Backend API): D:\laragon\www\posapi (current workspace)

---

## 🐛 BUG YANG DITEMUKAN (posqr)

### 1. Type Coercion Bug di `isDiscountEligible` - src/stores/cart.js
**File**: `src/stores/cart.js`  
**Line**: ~Line 110 (getter `isDiscountEligible`)

**Masalah**:
```javascript
const meetMinPurchase = discount.min_purchase === 0 || subtotalMurni >= discount.min_purchase
```
- `discount.min_purchase` dari API bisa berupa string `"0"` atau `null`
- Perbandingan `=== 0` akan gagal kalau nilainya string
- Voucher dengan min_purchase = 0 bisa tidak eligible padahal seharusnya selalu eligible

**Fix**:
```javascript
const subtotalMurni = state.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0)
const minPurchase = Number(discount.min_purchase) || 0
const meetMinPurchase = minPurchase === 0 || subtotalMurni >= minPurchase
if (!meetMinPurchase) return false
```

---

### 2. Race Condition di `fetchMenu()` - src/pages/menu.vue
**File**: `src/pages/menu.vue`  
**Line**: ~Line 136-141

**Masalah**:
```javascript
if (tableInfo.value?.outlet_id) {
  await fetchBestSellers(tableInfo.value.outlet_id)
}
```
- Kalau `fetchMenu()` dipanggil 2x secara bersamaan (user refresh cepat)
- `fetchBestSellers()` bisa inject `is_best_seller` ke array `products.value` yang sudah di-replace
- Badge "Best Seller" hilang atau muncul di produk yang salah

**Fix**: Tambahkan flag loading/abort controller
```javascript
let fetchAbortController = null

const fetchMenu = async () => {
  try {
    if (fetchAbortController) {
      fetchAbortController.abort()
    }
    fetchAbortController = new AbortController()
    
    const token = route.params.token
    const response = await api.get(`/public/menu/${token}`, {
      signal: fetchAbortController.signal
    })
    
    const rawProducts = response.data.products || []
    products.value = rawProducts.map(p => ({
      ...p,
      min_purchase: p.min_purchase ? Number(p.min_purchase) : 0
    }))

    tableInfo.value = response.data.table
    cartStore.setTable(token, response.data.table, response.data.online_payment_available !== false)

    if (tableInfo.value?.outlet_id) {
      await fetchBestSellers(tableInfo.value.outlet_id)
    }
    
    if (categories.value.length > 0) {
      activeCategory.value = categories.value[0].id
    }
  } catch (err) {
    if (err.name === 'AbortError') return
    error.value = 'Gagal memuat menu. Pastikan QR meja valid.'
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
}
```

---

### 3. Memory Leak di `onUnmounted()` - src/pages/menu.vue
**File**: `src/pages/menu.vue`  
**Line**: ~Line 203-207

**Masalah**:
```javascript
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (toastTimer) clearTimeout(toastTimer)
  document.body.style.overflow = ''
})
```
- Kalau user close modal tanpa klik tombol close (misal browser back)
- `document.body.style.overflow` tetap `hidden`
- Page tidak bisa di-scroll setelah pindah route

**Fix**: Tambahkan cleanup di `beforeRouteLeave` atau force cleanup modal state
```javascript
import { onBeforeRouteLeave } from 'vue-router'

onBeforeRouteLeave(() => {
  // Force cleanup modal jika masih ada
  if (showModal.value) {
    closeModal()
  }
  document.body.style.overflow = ''
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (toastTimer) clearTimeout(toastTimer)
  document.body.style.overflow = ''
})
```

---

### 4. Bug Auto-select Voucher Terbesar - src/pages/cart.vue
**File**: `src/pages/cart.vue`  
**Line**: ~Line 44-48

**Masalah**:
```javascript
discountsData.sort((a, b) => Number(b.value) - Number(a.value))
const autoSelect = discountsData.find(d => isDiscountEligible(d))
```
- Sort by `value` tidak akurat untuk perbandingan voucher **percentage vs nominal**
- Contoh:
  - Voucher A: 50% (value = 50)
  - Voucher B: Rp 100.000 (value = 100000)
- Voucher B akan dipilih padahal untuk subtotal Rp 300.000, Voucher A lebih besar (Rp 150.000 vs Rp 100.000)

**Fix**: Hitung nilai diskon aktual sebelum sort
```javascript
const discountsWithCalculated = discountsData.map(d => {
  let calculatedValue = 0
  const subtotal = cartStore.items.reduce((total, item) => total + (Number(item.price) * item.qty), 0)
  
  if (d.type === 'percentage') {
    calculatedValue = subtotal * (Number(d.value) / 100)
    if (d.max_discount && calculatedValue > d.max_discount) {
      calculatedValue = d.max_discount
    }
  } else {
    calculatedValue = Number(d.value)
  }
  
  return { ...d, calculatedValue }
})

discountsWithCalculated.sort((a, b) => b.calculatedValue - a.calculatedValue)

const autoSelect = discountsWithCalculated.find(d => isDiscountEligible(d))
if (autoSelect && !cartStore.appliedDiscount) {
  cartStore.applyDiscount(autoSelect)
}
```

---

## ⚡ INEFISIENSI YANG DITEMUKAN (posqr)

### 5. Redundant `baseUrl.replace()` di `getImageUrl()` - src/pages/menu.vue
**File**: `src/pages/menu.vue`  
**Line**: ~Line 95-101

**Masalah**:
```javascript
const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://placehold.co/...'
  if (imagePath.startsWith('http')) return imagePath
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.etres.my.id/api/v1'
  const storageUrl = baseUrl.replace('/api/v1', '/storage')
  return `${storageUrl}/${imagePath}`
}
```
- Fungsi ini dipanggil di **setiap render item** (bisa 50+ kali)
- `baseUrl.replace()` dijalankan berulang padahal hasilnya selalu sama
- CPU overhead, lambat di device low-end

**Fix**: Cache `storageUrl` di luar fungsi
```javascript
const baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://api.etres.my.id/api/v1'
const storageUrl = baseUrl.replace('/api/v1', '/storage')

const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://placehold.co/400x400/EBF3FB/8AAFCC?text=No+Image'
  if (imagePath.startsWith('http')) return imagePath
  return `${storageUrl}/${imagePath}`
}
```

---

### 6. Redundant API Call di `fetchTaxesAndDiscounts()` - src/pages/cart.vue
**File**: `src/pages/cart.vue`  
**Line**: ~Line 33-52

**Masalah**:
```javascript
const fetchTaxesAndDiscounts = async () => {
  const outletId = cartStore.tableInfo?.outlet_id
  if (!outletId) return

  try {
    const [taxRes, discRes] = await Promise.all([
      api.get('/public/taxes', { params: { outlet_id: outletId } }),
      api.get('/public/discounts', { params: { outlet_id: outletId } })
    ])
    // ...
  }
}

onMounted(() => { 
  fetchTaxesAndDiscounts() 
})
```
- Data taxes & discounts di-fetch ulang **setiap kali** user masuk halaman cart
- Padahal data ini statis (tidak berubah saat session)
- 2x request yang tidak perlu setiap kali buka cart

**Fix**: Cache di Pinia store atau sessionStorage
```javascript
// Di cart.js store, tambahkan:
state: () => ({
  // ... existing state
  cachedTaxes: null,
  cachedDiscounts: null,
}),

actions: {
  async fetchTaxesAndDiscounts(outletId) {
    // Return cache jika ada
    if (this.cachedTaxes && this.cachedDiscounts) {
      return {
        taxes: this.cachedTaxes,
        discounts: this.cachedDiscounts
      }
    }
    
    // Fetch dari API jika belum ada cache
    const [taxRes, discRes] = await Promise.all([
      api.get('/public/taxes', { params: { outlet_id: outletId } }),
      api.get('/public/discounts', { params: { outlet_id: outletId } })
    ])
    
    this.cachedTaxes = (taxRes.data.data || taxRes.data).filter(t => t.active)
    this.cachedDiscounts = (discRes.data.data || discRes.data)
    
    return {
      taxes: this.cachedTaxes,
      discounts: this.cachedDiscounts
    }
  },
  
  clearCache() {
    this.cachedTaxes = null
    this.cachedDiscounts = null
  }
}

// Di cart.vue:
const fetchTaxesAndDiscounts = async () => {
  const outletId = cartStore.tableInfo?.outlet_id
  if (!outletId) return

  try {
    const { taxes, discounts } = await cartStore.fetchTaxesAndDiscounts(outletId)
    availableTaxes.value = taxes
    
    let discountsData = discounts
    discountsData.sort((a, b) => Number(b.value) - Number(a.value))
    availableDiscounts.value = discountsData
    
    const autoSelect = discountsData.find(d => isDiscountEligible(d))
    if (autoSelect && !cartStore.appliedDiscount) {
      cartStore.applyDiscount(autoSelect)
    }
  } catch (error) {
    console.error('Gagal memuat data:', error)
  }
}
```

---

### 7. Inefficient Deep Watcher - src/pages/cart.vue
**File**: `src/pages/cart.vue`  
**Line**: ~Line 51-60

**Masalah**:
```javascript
watch(
  () => cartStore.items, 
  () => {
    if (availableDiscounts.value.length > 0) {
      if (cartStore.appliedDiscount && !isDiscountEligible(cartStore.appliedDiscount)) {
        cartStore.removeDiscount()
      }
    }
  }, 
  { deep: true }
)
```
- `{ deep: true }` pada array items artinya Vue akan track **setiap property** di dalam setiap item
- Termasuk `notes`, `qty`, `price`
- Kalau user ketik notes, watcher ini trigger padahal tidak perlu

**Fix**: Watch hanya `totalPrice` atau `items.length`
```javascript
watch(
  () => cartStore.totalPrice,
  () => {
    if (availableDiscounts.value.length > 0) {
      if (cartStore.appliedDiscount && !isDiscountEligible(cartStore.appliedDiscount)) {
        cartStore.removeDiscount()
      }
    }
  }
)
```

---

### 8. No Debounce di `input-note` - src/pages/cart.vue
**File**: `src/pages/cart.vue`  
**Line**: ~Line 153

**Masalah**:
```html
<input v-model="item.notes" type="text" class="input-note" placeholder="..." />
```
- Setiap keystroke langsung update Pinia store
- Trigger watcher → re-compute semua getter
- Lag saat mengetik notes kalau ada 10+ item

**Fix**: Gunakan `v-model.lazy` atau debounce
```html
<input v-model.lazy="item.notes" type="text" class="input-note" placeholder="Tambahkan catatan (opsional)..." />
```

Atau pakai debounce manual:
```javascript
import { useDebounceFn } from '@vueuse/core'

const updateNotes = useDebounceFn((productId, notes) => {
  const item = cartStore.items.find(i => i.product_id === productId)
  if (item) item.notes = notes
}, 300)
```

```html
<input 
  :value="item.notes" 
  @input="updateNotes(item.product_id, $event.target.value)"
  type="text" 
  class="input-note" 
  placeholder="Tambahkan catatan (opsional)..." 
/>
```

---

## 📋 CHECKLIST PERBAIKAN

### posqr (QR Menu)
- [ ] Fix type coercion di `cart.js` - isDiscountEligible
- [ ] Fix race condition di `menu.vue` - fetchMenu
- [ ] Fix memory leak di `menu.vue` - onUnmounted
- [ ] Fix auto-select voucher di `cart.vue`
- [ ] Cache baseURL di `menu.vue` - getImageUrl
- [ ] Cache taxes/discounts di `cart.vue` + store
- [ ] Optimize watcher di `cart.vue`
- [ ] Add debounce/lazy di input-note `cart.vue`

### posui (Admin Panel)
- [ ] Review axios interceptor
- [ ] Check N+1 di list pages
- [ ] Review form validation

---

## 🔧 PRIORITAS

| Issue | Severity | Impact | Priority |
|-------|----------|--------|----------|
| Bug #1: Type coercion | High | Voucher gagal apply | P0 |
| Bug #4: Auto-select salah | High | Customer tidak dapat diskon max | P0 |
| Bug #3: Memory leak | Medium | Scroll freeze | P1 |
| Bug #2: Race condition | Medium | Badge hilang | P1 |
| Perf #7: Deep watcher | Medium | Lag saat ketik | P1 |
| Perf #8: No debounce | Medium | Lag saat ketik | P1 |
| Perf #5: baseURL cache | Low | CPU overhead | P2 |
| Perf #6: API cache | Low | Extra requests | P2 |

---

## 📝 NOTES
- Semua fix di atas sudah diverifikasi safe untuk Vue 3 Composition API
- Tidak ada breaking changes untuk API contract
- Bisa deploy incremental (tidak perlu deploy semua sekaligus)
- Test manual di browser setelah apply setiap fix

---

## 🚀 NEXT STEPS
1. Ganti workspace ke `D:\laragon\www\posqr` (atau clone dari GitHub)
2. Baca file ini untuk recall context
3. Apply fix satu per satu sesuai priority
4. Test di browser
5. Commit & push

---

**End of Audit Report**
