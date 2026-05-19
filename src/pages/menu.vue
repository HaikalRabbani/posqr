<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api.js'
import { useCartStore } from '../stores/cart.js'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore()

const products = ref([])
const tableInfo = ref(null)
const loading = ref(true)
const error = ref(null)

const activeCategory = ref(null)
const sectionRefs = ref({})
const categoryNavRef = ref(null)
let isClickScrolling = false

const showToast = ref(false)
const toastMessage = ref('')
let toastTimer = null

const handleAddToCart = (product) => {
  cartStore.addItem(product)
  
  toastMessage.value = `masuk keranjang!`
  showToast.value = true
  
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    showToast.value = false
  }, 2000)
}

const categories = computed(() => {
  const cats = []
  products.value.forEach(p => {
    const catName = p.category?.name || `Kategori ${p.category_id}`
    const catId = p.category_id
    if (catId && !cats.find(c => c.id === catId)) {
      cats.push({ id: catId, name: catName })
    }
  })
  return cats
})

// Mengelompokkan produk berdasarkan kategori untuk layout list vertical
const groupedProducts = computed(() => {
  return categories.value.map(cat => {
    return {
      id: cat.id,
      name: cat.name,
      items: products.value.filter(p => p.category_id === cat.id)
    }
  })
})

const formatRupiah = (angka) => {
  if (!angka) return '0'
  return new Intl.NumberFormat('id-ID').format(angka)
}

const getImageUrl = (imagePath) => {
  if (!imagePath) return 'https://placehold.co/400x400/EBF3FB/8AAFCC?text=No+Image'
  if (imagePath.startsWith('http')) return imagePath
  return `https://api.etres.my.id/storage/${imagePath}`
}

const onImageError = (event) => {
  event.target.src = 'https://placehold.co/400x400/EBF3FB/5A7A9A?text=Image+Error'
}

const fetchBestSellers = async (outletId) => {
  try {
    const response = await api.get('/public/top-products', {
      params: { outlet_id: outletId }
    })
    
    const topProducts = response.data.top_products || []
    const bestSellerNames = topProducts.map(p => p.name)
    
    products.value.forEach(product => {
      if (bestSellerNames.includes(product.name)) {
        product.is_best_seller = true
      }
    })
  } catch (err) {
    console.warn('Gagal memuat badge best seller:', err)
  }
}

const fetchMenu = async () => {
  try {
    const token = route.params.token
    const response = await api.get(`/public/menu/${token}`)
    
    products.value = response.data.products
    tableInfo.value = response.data.table
    cartStore.setTable(token, response.data.table)

    if (tableInfo.value?.outlet_id) {
      await fetchBestSellers(tableInfo.value.outlet_id)
    }
    
    // Set kategori aktif pertama secara default
    if (categories.value.length > 0) {
      activeCategory.value = categories.value[0].id
    }
  } catch (err) {
    error.value = 'Gagal memuat menu. Pastikan QR meja valid.'
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
}

// --- LOGIC SCROLL SPY & AUTO GESER NAVIGASI ---
const setSectionRef = (el, catId) => {
  if (el) sectionRefs.value[catId] = el
}

const onScroll = () => {
  if (isClickScrolling) return

  const headerOffset = 130 // Jarak offset sticky header
  let currentCatId = activeCategory.value

  for (const [catId, el] of Object.entries(sectionRefs.value)) {
    const rect = el.getBoundingClientRect()
    // Deteksi jika judul kategori sudah menyentuh / dekat dengan sticky header
    if (rect.top <= headerOffset && rect.bottom > headerOffset) {
      // Pastikan tipe data sama dengan id aslinya
      currentCatId = isNaN(catId) ? catId : Number(catId) 
      break
    }
  }

  if (currentCatId !== activeCategory.value) {
    activeCategory.value = currentCatId
    scrollToCategoryPill(currentCatId)
  }
}

const scrollToCategory = (catId) => {
  activeCategory.value = catId
  isClickScrolling = true
  scrollToCategoryPill(catId)

  const el = sectionRefs.value[catId]
  if (el) {
    // Scroll layar ke section kategori terpilih dengan memberi ruang untuk sticky header
    const y = el.getBoundingClientRect().top + window.scrollY - 110 
    window.scrollTo({ top: y, behavior: 'smooth' })

    // Nonaktifkan event scroll sementara agar spy tidak bentrok saat transisi
    setTimeout(() => {
      isClickScrolling = false
    }, 800)
  }
}

const scrollToCategoryPill = (catId) => {
  const nav = categoryNavRef.value
  if (!nav) return

  nextTick(() => {
    const pill = nav.querySelector(`[data-cat-id="${catId}"]`)
    if (pill) {
      const navRect = nav.getBoundingClientRect()
      const pillRect = pill.getBoundingClientRect()
      // Posisikan pill agar selalu berada di tengah area horizontal
      const scrollLeft = pill.offsetLeft - (navRect.width / 2) + (pillRect.width / 2)
      nav.scrollTo({ left: scrollLeft, behavior: 'smooth' })
    }
  })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll)
  fetchMenu()
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="page-wrapper">
    <header v-if="tableInfo && !loading && !error" class="menu-header">
      <h1 class="outlet-name">Selamat Datang</h1>
      <p class="table-label">Meja {{ tableInfo.name }}</p>
    </header>
    
    <div class="toast-notification" :class="{ 'show': showToast }">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      {{ toastMessage }}
    </div>

    <div v-if="loading" class="state-center">
      <div class="loader"></div>
      <p>Menyiapkan menu terbaik...</p>
    </div>

    <div v-else-if="error" class="state-center">
      <div class="error-box">
        <p>{{ error }}</p>
      </div>
    </div>

    <template v-else>
      <div class="category-container sticky-top">
        <div class="category-scroll" ref="categoryNavRef">
          <button 
            v-for="cat in categories" 
            :key="cat.id"
            :data-cat-id="cat.id"
            class="category-pill"
            :class="{ active: activeCategory === cat.id }"
            @click="scrollToCategory(cat.id)"
          >
            {{ cat.name }}
          </button>
        </div>
      </div>

      <div class="product-list">
        <div 
          v-for="group in groupedProducts" 
          :key="group.id"
          :ref="el => setSectionRef(el, group.id)"
          class="category-section"
        >
          <h2 class="category-title">{{ group.name }}</h2>
          
          <div class="list-container">
            <div 
              v-for="product in group.items" 
              :key="product.id" 
              class="product-item"
              :class="{ 'out-of-stock': product.stock <= 0 }"
            >
              <div class="product-image-wrap">
                <img :src="getImageUrl(product.image)" :alt="product.name" @error="onImageError" loading="lazy" />
                </div>
              
              <div class="product-info">
                <div v-if="product.is_best_seller" class="badge-bestseller">
                  ★ Best Seller
                </div>
                
                <h3 class="product-title">{{ product.name }}</h3>
                <p v-if="product.description" class="product-desc">{{ product.description }}</p>
                
                <div class="product-footer">
                  <span v-if="product.stock > 0" class="text-price">Rp {{ formatRupiah(product.price) }}</span>
                  <span v-else class="text-soldout-price">Habis</span>

                  <button 
                    v-if="product.stock > 0"
                    class="btn-add-circle" 
                    @click="handleAddToCart(product)"
                  >
                    <span>+</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="cartStore.totalItems > 0" class="floating-cart">
      <div class="cart-details">
        <span class="cart-qty">{{ cartStore.totalItems }} Item</span>
        <span class="cart-price">Rp {{ formatRupiah(cartStore.totalPrice) }}</span>
      </div>
      <button class="btn-go-to-cart" @click="router.push('/cart')">
        Keranjang
      </button>
    </div>

    <div class="bottom-spacer"></div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Poppins:wght@400;500;600;700&display=swap');

.page-wrapper { font-family: 'Poppins', sans-serif; background-color: #FFFFFF; min-height: 100vh; padding: 16px; }
.bottom-spacer { height: 120px; }

.menu-header { margin-bottom: 20px; }
.outlet-name { font-size: 22px; font-weight: 700; color: #1A2332; margin: 0; }
.table-label { font-size: 14px; color: #5A7A9A; font-weight: 500; margin-top: 2px; }

/* TOAST STYLE - Warna Hijau dengan Background Pudar */
.toast-notification {
  position: fixed;
  top: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(-100px);
  
  /* Background Hijau Pudar (Opacity rendah) */
  background: rgba(16, 185, 129, 0.1); 
  
  /* Border & Font Hijau Solid */
  border: 1px solid #10B981;
  color: #10B981;
  
  padding: 10px 20px;
  border-radius: 30px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  
  /* Shadow disesuaikan biar gak terlalu nabrak */
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.15);
  z-index: 1000;
  transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-notification.show {
  transform: translateX(-50%) translateY(0);
}


/* Sticky Container Kategori */
.category-container.sticky-top { 
  margin: 0 -16px 12px -16px; 
  position: sticky; 
  top: 0; 
  z-index: 10; 
  background-color: #FFFFFF; 
  padding-top: 10px;
  box-shadow: 0 4px 12px rgba(255, 255, 255, 0.9);
}
.category-scroll { 
  display: flex; 
  gap: 10px; 
  overflow-x: auto; 
  padding: 0 16px 12px 16px; 
  scrollbar-width: none; 
}
.category-scroll::-webkit-scrollbar { display: none; }

.category-pill {
  padding: 8px 18px; border-radius: 20px; border: 1px solid #D4E4F4;
  background: #FFFFFF; color: #5A7A9A; font-size: 13px; font-weight: 500;
  white-space: nowrap; cursor: pointer; transition: all 0.2s ease;
}

.category-pill.active { 
  background: rgba(46, 125, 214, 0.1); 
  color: #2E7DD6; 
  border-color: #2E7DD6; 
}

/* Styling List Menu */
.product-list {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.category-title {
  font-size: 16px;
  font-weight: 700;
  color: #1A2332;
  margin-bottom: 12px;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.product-item {
  display: flex;
  flex-direction: row;
  background: #FFFFFF;
  border-bottom: 1px solid #F3F4F6;
  padding-bottom: 16px;
  gap: 16px;
}
.product-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

/* --- EFEK STOK HABIS --- */
/* Matikan interaksi. Grayscale dihapus agar warna asli tetap muncul */
.product-item.out-of-stock { 
  pointer-events: none; 
}
/* Turunkan opacity HANYA pada foto, nama, dan deskripsi */
.product-item.out-of-stock .product-image-wrap img,
.product-item.out-of-stock .product-title,
.product-item.out-of-stock .product-desc {
  opacity: 0.4;
}

.product-image-wrap { 
  position: relative; 
  width: 90px; 
  min-width: 90px;
  height: 90px; 
  background-color: #EBF3FB; 
  border-radius: 12px;
  overflow: hidden;
}
.product-image-wrap img { width: 100%; height: 100%; object-fit: cover; }

/* Info Kanan */
.product-info { 
  display: flex; 
  flex-direction: column; 
  flex-grow: 1; 
  justify-content: center;
}

.badge-bestseller {
  align-self: flex-start;
  background: #FEF3C7; color: #D97706; border: 1px solid #FDE68A;
  padding: 2px 6px; 
  font-size: 9px; 
  font-weight: 700; border-radius: 4px;
  margin-bottom: 4px;
}

.product-title { 
  font-size: 14px; 
  font-weight: 600; 
  color: #1A2332; 
  margin: 0 0 4px 0; 
  line-height: 1.3; 
  display: -webkit-box; 
  -webkit-line-clamp: 2; 
  line-clamp: 2; 
  -webkit-box-orient: vertical; 
  overflow: hidden; 
  
  word-wrap: break-word;
}

.product-desc { 
  font-size: 11px; 
  color: #7A7A7A; 
  margin-bottom: 8px; 
  line-height: 1.4; 
  display: -webkit-box; 
  -webkit-line-clamp: 2; 
  line-clamp: 2; 
  -webkit-box-orient: vertical; 
  overflow: hidden; 
  
  word-wrap: break-word;
}

.product-footer { 
  margin-top: auto; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
}

.text-price { font-weight: 700; color: #2E7DD6; font-size: 14px; font-family: 'JetBrains Mono', monospace; }

/* Harga berubah jadi Habis: Ukuran lebih kecil, tidak terlalu tebal, dan warna merah */
.text-soldout-price { 
  font-weight: 600; 
  color: #EF4444; /* Warna Merah Solid */
  font-size: 12px; /* Ukuran lebih kecil dari harga */
}

/* Tombol Plus Circle */
.btn-add-circle {
  width: 28px; 
  height: 28px;
  background: #2E7DD6; 
  color: #FFFFFF; 
  border: none; 
  border-radius: 50%; 
  font-size: 18px; 
  font-weight: 600; 
  cursor: pointer; 
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s ease;
  padding: 0;
}
.btn-add-circle:active { transform: scale(0.9); }

.floating-cart {
  position: fixed; bottom: 20px; left: 16px; right: 16px;
  max-width: 450px; margin: 0 auto; background: #1A2332; color: #FFFFFF;
  padding: 16px 20px; border-radius: 18px; display: flex;
  justify-content: space-between; align-items: center;
  box-shadow: 0 10px 25px rgba(26, 35, 50, 0.3); z-index: 100;
  animation: slideUp 0.3s ease forwards;
}

@keyframes slideUp { from { bottom: -100px; opacity: 0; } to { bottom: 24px; opacity: 1; } }

.cart-details { display: flex; flex-direction: column; }
.cart-qty { font-size: 11px; color: #8AAFCC; font-weight: 500; }
.cart-price { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 16px; }

.btn-go-to-cart {
  background: #2E7DD6; color: #FFFFFF; border: none; padding: 10px 18px;
  border-radius: 10px; font-weight: 700; font-size: 13px; cursor: pointer;
}

.state-center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 20px; text-align: center; color: #5A7A9A; }
.loader { border: 3px solid #EBF3FB; border-top: 3px solid #2E7DD6; border-radius: 50%; width: 34px; height: 34px; animation: spin 1s linear infinite; margin-bottom: 16px; }
@keyframes spin { 100% { transform: rotate(360deg); } }
.error-box { background: #fff1f0; border: 1px solid #ffa39e; border-radius: 12px; padding: 20px; color: #cf1322; width: 100%; }
</style>