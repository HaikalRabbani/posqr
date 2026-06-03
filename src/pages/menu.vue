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

// --- TAMBAHAN UNTUK REKOMENDASI (Maksimal 6 Produk untuk Grid 2x3) ---
const recommendedProducts = computed(() => {
  return products.value.filter(p => p.is_best_seller).slice(0, 6)
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
    
    // FIX FRONTEND: Lakukan mapping data produk agar properti min_purchase terbaca angka oleh "v-if"
    const rawProducts = response.data.products || []
    products.value = rawProducts.map(p => ({
      ...p,
      min_purchase: p.min_purchase ? Number(p.min_purchase) : 0
    }))

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
    <header v-if="tableInfo && !loading && !error" class="saas-header">
      <div class="header-ornament">
        <div class="circle-1"></div>
        <div class="circle-2"></div>
      </div>
      
      <div class="header-content-wrapper">
        <div class="header-text-left">
          <h1 class="saas-title">Halo, selamat datang!</h1>
          <p class="saas-subtitle">Pesan menu favoritmu dari sini.</p>
        </div>
        
        <div class="header-table-right">
          <span class="table-label-clean">MEJA</span>
          <span class="table-number-clean">{{ tableInfo.name }}</span>
        </div>
      </div>
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

      <div v-if="recommendedProducts.length > 0" class="recommendation-section">
        <h2 class="category-title">Rekomendasi</h2>
        <div class="recommendation-divider-line"></div>
        <div class="recommendation-grid">
          <div 
            v-for="product in recommendedProducts" 
            :key="'rec-' + product.id"
            class="recommendation-item"
            :class="{ 'out-of-stock': product.stock <= 0 }"
          >
            <div class="rec-image-wrap">
              <div v-if="product.is_best_seller" class="rec-badge-floating">
                ★ Best Seller
              </div>
              <img :src="getImageUrl(product.image)" :alt="product.name" @error="onImageError" loading="lazy" />
            </div>
            
            <div class="rec-info">
              <span class="rec-category">{{ product.category?.name || 'Tanpa Kategori' }}</span>
              <p class="rec-title">{{ product.name }}</p>
              <div class="rec-footer-wrapper">
                <div class="rec-footer">
                  <template v-if="product.stock > 0">
                    <div v-if="product.is_promo && (!product.min_purchase || Number(product.min_purchase) === 0)" style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                      <span class="rec-price">Rp {{ formatRupiah(product.promo_price) }}</span>
                      <span style="font-size: 11px; color: #8AAFCC; text-decoration: line-through;">Rp {{ formatRupiah(product.price) }}</span>
                    </div>
                    <span v-else class="rec-price">Rp {{ formatRupiah(product.price) }}</span>
                  </template>
                  <span v-else class="text-soldout-price">Habis</span>
                  
                  <button 
                    v-if="product.stock > 0"
                    class="btn-add-circle rec-btn" 
                    @click="handleAddToCart(product)"
                  >
                    <span>+</span>
                  </button>
                </div>
                <div v-if="product.stock > 0 && product.is_promo && product.min_purchase && Number(product.min_purchase) > 0" class="promo-requirement-text">
                  *Min. order Rp{{ formatRupiah(product.min_purchase) }} untuk klaim harga diskon
                </div>
              </div>
            </div>
          </div>
        </div>
        <div class="category-block-spacer"></div>
      </div>

      <div class="product-list">
        <div 
          v-for="group in groupedProducts" 
          :key="group.id"
          :ref="el => setSectionRef(el, group.id)"
          class="category-section"
        >
          <div class="category-inner-header-container">
            <div class="category-header-wrap">
              <h2 class="category-title-custom">{{ group.name }}</h2>
              <span class="category-count">{{ group.items.length }} Produk</span>
            </div>
            
            <div class="category-divider-line"></div>
          </div>
          
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
                
                <p class="product-title">{{ product.name }}</p>
                <p v-if="product.description" class="product-desc">{{ product.description }}</p>
                
                <div class="product-footer-wrapper">
                  <div class="product-footer">
                    <template v-if="product.stock > 0">
                      <div v-if="product.is_promo && (!product.min_purchase || Number(product.min_purchase) === 0)" style="display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;">
                        <span class="text-price">Rp {{ formatRupiah(product.promo_price) }}</span>
                        <span style="font-size: 12px; color: #8AAFCC; text-decoration: line-through;">Rp {{ formatRupiah(product.price) }}</span>
                      </div>
                      <span v-else class="text-price">Rp {{ formatRupiah(product.price) }}</span>
                    </template>
                    <span v-else class="text-soldout-price">Habis Terjual</span>

                    <button 
                      v-if="product.stock > 0"
                      class="btn-add-circle" 
                      @click="handleAddToCart(product)"
                    >
                      <span>+</span>
                    </button>
                  </div>
                  <div v-if="product.stock > 0 && product.is_promo && product.min_purchase && Number(product.min_purchase) > 0" class="promo-requirement-text">
                    *Min. belanja Rp {{ formatRupiah(product.min_purchase) }} dapat diskon
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="category-block-spacer"></div>
        </div>
      </div>
    </template>

    <div v-if="cartStore.totalItems > 0" class="floating-cart" @click="router.push('/cart')">
      <div class="cart-details">
        <span class="cart-qty"> Cek Keranjang ({{ cartStore.totalItems }} Produk)</span>
      </div>
      <div class="cart-action">
        <span class="cart-price">Rp {{ formatRupiah(cartStore.totalPrice) }}</span>
        <button class="btn-go-to-cart"> &gt; </button>
      </div>
    </div>

    <div class="bottom-spacer"></div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Poppins:wght@400;500;600;700&display=swap');

.page-wrapper { font-family: 'Poppins', sans-serif; background-color: #FFFFFF; min-height: 100vh; padding: 16px; }
.bottom-spacer { height: 120px; }

/* --- STYLE HEADER SAAS UNIVERSAL (CSS ABSTRACT PATTERN) --- */
.saas-header {
  position: relative;
  background: linear-gradient(135deg, #2E7DD6 0%, #1B4F8A 100%);
  border-radius: 16px;
  padding: 24px 20px;
  margin-bottom: 24px;
  overflow: hidden;
  box-shadow: 0 8px 20px rgba(27, 79, 138, 0.15);
  color: #FFFFFF;
}

.header-ornament {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}

.circle-1 {
  position: absolute;
  width: 140px;
  height: 140px;
  background: linear-gradient(to bottom right, rgba(255,255,255,0.15), rgba(255,255,255,0));
  border-radius: 50%;
  top: -40px;
  right: 10%;
}

.circle-2 {
  position: absolute;
  width: 80px;
  height: 80px;
  border: 2px solid rgba(255,255,255,0.1);
  border-radius: 50%;
  bottom: -20px;
  right: -10px;
}

.header-content-wrapper {
  position: relative;
  z-index: 2;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.header-text-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 70%;
}

.saas-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  line-height: 1.3;
}

.saas-subtitle {
  font-size: 12px;
  color: #EBF3FB;
  margin: 0;
  opacity: 0.9;
}

.header-table-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  margin-top: -2px;
}

.table-label-clean {
  font-size: 10px;
  font-weight: 700;
  color: #8AAFCC;
  letter-spacing: 1px;
  margin-bottom: 2px;
}

.table-number-clean {
  font-size: 28px;
  font-weight: 800;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1;
  color: #FFFFFF;
}

/* Toast Notif*/
.toast-notification { position: fixed; top: 24px; left: 50%; transform: translateX(-50%) translateY(-100px); background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 8px 16px; border-radius: 20px;font-size: 12px;font-weight: 600; display: flex;align-items: center;gap: 6px; z-index: 1000; transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
.toast-notification.show { transform: translateX(-50%) translateY(0); }

/* Sticky Container Kategori */
.category-container.sticky-top { margin: 0 -16px 12px -16px; position: sticky; top: 0; z-index: 10; background-color: #FFFFFF; padding-top: 10px; box-shadow: 0 4px 12px rgba(255, 255, 255, 0.9); }
.category-scroll { display: flex; gap: 10px; overflow-x: auto; padding: 0 16px 12px 16px; scrollbar-width: none; }
.category-scroll::-webkit-scrollbar { display: none; }
.category-pill { padding: 8px 18px; border-radius: 20px; border: 1px solid #D4E4F4; background: #FFFFFF; color: #5A7A9A; font-size: 13px; font-weight: 500;white-space: nowrap; cursor: pointer; transition: all 0.2s ease; }
.category-pill.active { background: rgba(46, 125, 214, 0.1); color: #2E7DD6; border-color: #2E7DD6; }

/* Recomend Section*/
.recommendation-section { margin-bottom: 32px;}
.recommendation-grid { display: grid; grid-template-columns: repeat(2, 1fr);  gap: 20px 16px;}
.recommendation-item { display: flex; flex-direction: column; gap: 6px; }
/* --- TWEAK UKURAN FONT REKOMENDASI GRID --- */

/* Gedein judul menu di dalam grid rekomendasi */
.recommendation-item .rec-title {
  font-size: 15px !important; /* Naikin dari 13px ke 15px biar tegas */
  font-weight: 600;
  line-height: 1.3;
  margin-bottom: 3px !important; /* Jarak rapat presisi ke bawah (deskripsi/harga) */
}

/* Gedein teks kategori kecil yang ada di atas judul rekomendasi (opsional biar imbang) */
.recommendation-item .rec-category {
  font-size: 11px !important; /* Naikin dikit dari 10px */
  font-weight: 500;
  margin-bottom: 2px;
}

/* Atur jarak margin sub-info diskon biar ga tabrakan */
.recommendation-item .promo-requirement-text {
  font-size: 10px;
  line-height: 1.2;
  margin-top: 2px !important;
}
.recommendation-item.out-of-stock { pointer-events: none; }
.recommendation-item.out-of-stock .rec-image-wrap img,
.recommendation-item.out-of-stock .rec-title { opacity: 0.4; }
.rec-image-wrap { position: relative;  width: 100%; aspect-ratio: 1 / 1; background-color: #EBF3FB; border-radius: 12px; overflow: hidden; }
.rec-image-wrap img { width: 100%; height: 100%; object-fit: cover;}
.rec-badge-floating { position: absolute; top: 8px; left: 8px; z-index: 2; background: #FEF3C7;  color: #C4860A;  border: 1px solid #FDE68A; padding: 2px 10px; font-size: 9px; font-weight: 700; border-radius: 999px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
.rec-info { display: flex; flex-direction: column; flex-grow: 1; }
.rec-category { font-size: 10px; color: #8AAFCC; font-weight: 500; margin-bottom: 2px; }
.rec-title {  font-size: 13px;  font-weight: 600; color: #1A2332;  margin: 0 0 6px 0;  line-height: 1.3;  display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-wrap: break-word; }

/* Wrapper Footer tambahan untuk fleksibilitas susunan vertikal */
.rec-footer-wrapper, .product-footer-wrapper { display: flex; flex-direction: column; gap: 4px; margin-top: auto; }
.rec-footer { display: flex; justify-content: space-between; align-items: center; }

.rec-price { font-weight: 700; color: #2E7DD6; font-size: 14px; font-family: 'JetBrains Mono', monospace; }
.rec-btn { width: 24px; height: 24px; font-size: 16px; }

/* STYLE LIST MENU UTAMA */
.product-list { display: flex; flex-direction: column; gap: 24px; }
.category-title { font-size: 20px; font-weight: 700; color: #1A2332; margin-bottom: 12px; }
.list-container { display: flex; flex-direction: column; gap: 16px; }

.recommendation-divider-line {
  border-bottom: 2px dashed #D4E4F4;
  margin: 12px 0 20px 0;
}
.category-section { 
  margin-bottom: 24px;
}

.category-inner-header-container {
  padding: 0; 
  margin-bottom: 20px;
}

.category-header-wrap {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.category-title-custom {
  font-size: 20px;
  font-weight: 700;
  color: #1A2332;
  margin: 0;
}

.category-count {
  font-size: 13px;
  font-weight: 500;
  color: #8AAFCC;
}

.category-divider-line {
  border-bottom: 2px dashed #D4E4F4;
}

.category-block-spacer {
  height: 10px;
  background-color: #F3F4F6;
  margin-left: -16px;
  margin-right: -16px;
  margin-top: 28px;
}

.category-section:last-child .category-block-spacer {
  display: none;
}

/* Item Produk */
.badge-bestseller { align-self: flex-start; background: #FEF3C7; color: #C4860A; border: 1px solid #FDE68A; padding: 2px 10px; font-size: 9px; font-weight: 700; border-radius: 999px; margin-bottom: 4px;}
.product-item { display: flex; flex-direction: row; background: #FFFFFF; border-bottom: 1px solid #F3F4F6; padding-bottom: 16px; gap: 16px; }
.product-item:last-child { border-bottom: none; padding-bottom: 0; }
.product-item.out-of-stock { pointer-events: none; }
.product-item.out-of-stock .product-image-wrap img,
.product-item.out-of-stock .product-title,
.product-item.out-of-stock .product-desc { opacity: 0.4; }
.product-image-wrap { position: relative; width: 90px; min-width: 90px; height: 90px; background-color: #EBF3FB; border-radius: 12px; overflow: hidden; }
.product-image-wrap img { width: 100%; height: 100%; object-fit: cover; }
.product-info { display: flex; flex-direction: column; flex-grow: 1; justify-content: flex-start; padding-top: 2px; }
.product-title {   font-size: 16px;   font-weight: 600;   color: #1A2332;   margin: 0;  margin-bottom: 2px; line-height: 1.3;   display: -webkit-box;   -webkit-line-clamp: 2;   line-clamp: 2;   -webkit-box-orient: vertical;   overflow: hidden;  word-wrap: break-word; }
.product-desc { font-size: 11px; color: #7A7A7A; margin: 0; margin-bottom: 8px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2;   line-clamp: 2;   -webkit-box-orient: vertical;   overflow: hidden; word-wrap: break-word; }
.product-footer { display: flex; justify-content: space-between; align-items: center; }

.text-price { font-weight: 700; color: #2E7DD6; font-size: 16px; font-family: 'JetBrains Mono', monospace; }
.text-soldout-price { font-weight: 600; color: #EF4444; font-size: 12px; }
.btn-add-circle { width: 28px; height: 28px; background: #2E7DD6; color: #FFFFFF; border: none; border-radius: 50%; font-size: 18px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: transform 0.1s ease; padding: 0;}
.btn-add-circle:active { transform: scale(0.9); }

.promo-requirement-text {
  font-size: 10px;
  color: #5A7A9A;
  font-style: italic;
  font-weight: 500;
  margin-top: 4px;
}

/* Cart Mengambang */
.floating-cart { position: fixed; bottom: 20px; left: 16px; right: 16px; max-width: 450px; margin: 0 auto; background: #2E7DD6; color: #FFFFFF; height: 25px; padding: 10px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(26, 35, 50, 0.2); z-index: 100; cursor: pointer; animation: slideUp 0.3s ease forwards; }
.cart-details { display: flex; align-items: center; }
.cart-qty { font-size: 13px; color: #FFFFFF; font-weight: 200; }
.cart-action { display: flex; align-items: center; gap: 12px; }
.cart-price { font-family: 'JetBrains Mono', monospace; font-weight: 500; font-size: 13px; }
.btn-go-to-cart { background: #FFFFFF; color: #2E7DD6; border: none; border-radius: 50%; width: 20px; height: 20px; font-weight: 600; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
.btn-go-to-cart:active { transform: scale(0.9); }

/* Utilities */
.state-center { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; padding: 20px; text-align: center; color: #5A7A9A; }
.loader { border: 3px solid #EBF3FB; border-top: 3px solid #2E7DD6; border-radius: 50%; width: 34px; height: 34px; animation: spin 1s linear infinite; margin-bottom: 16px; }
@keyframes spin { 100% { transform: rotate(360deg); } }
.error-box { background: #fff1f0; border: 1px solid #ffa39e; border-radius: 12px; padding: 20px; color: #cf1322; width: 100%; }
</style>