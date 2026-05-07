<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api.js'
import { useCartStore } from '../stores/cart.js' // Import Pinia

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore() // Aktifkan keranjang

const products = ref([])
const tableInfo = ref(null)
const loading = ref(true)
const error = ref(null)

// --- STATE KATEGORI ---
const activeCategory = ref('ALL')

// Mengekstrak kategori unik dari data produk
const categories = computed(() => {
  const cats = []
  products.value.forEach(p => {
    // Jika backend me-load relasi (product.category.name), kita pakai itu.
    // Jika tidak, kita tampilkan sementara "Kategori + ID".
    const catName = p.category?.name || `Kategori ${p.category_id}`
    const catId = p.category_id
    
    if (catId && !cats.find(c => c.id === catId)) {
      cats.push({ id: catId, name: catName })
    }
  })
  return cats
})

// Filter produk berdasarkan kategori aktif
const filteredProducts = computed(() => {
  if (activeCategory.value === 'ALL') return products.value
  return products.value.filter(p => p.category_id === activeCategory.value)
})

// --- FUNGSI HELPER ---
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

// --- FETCH DATA ---
const fetchMenu = async () => {
  try {
    const token = route.params.token
    const response = await api.get(`/public/menu/${token}`)
    
    products.value = response.data.products
    tableInfo.value = response.data.table
    
    // Simpan data meja ke keranjang untuk proses checkout nanti
    cartStore.setTable(token, response.data.table)
    
  } catch (err) {
    error.value = 'Gagal memuat menu. Pastikan QR meja valid.'
    console.error('Fetch error:', err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchMenu()
})
</script>

<template>
  <div class="page-wrapper">
    <header v-if="tableInfo" class="menu-header">
      <h1 class="outlet-name">Selamat Datang</h1>
      <p class="table-label">Meja {{ tableInfo.name }}</p>
    </header>

    <div v-if="loading" class="state-center">
      <div class="loader"></div>
      <p>Menyiapkan menu terbaik...</p>
    </div>

    <div v-else-if="error" class="state-center error-box">
      <p>{{ error }}</p>
    </div>

    <template v-else>
      <div class="category-scroll">
        <button 
          class="category-pill" 
          :class="{ active: activeCategory === 'ALL' }"
          @click="activeCategory = 'ALL'"
        >
          Semua
        </button>
        <button 
          v-for="cat in categories" 
          :key="cat.id"
          class="category-pill"
          :class="{ active: activeCategory === cat.id }"
          @click="activeCategory = cat.id"
        >
          {{ cat.name }}
        </button>
      </div>

      <div class="product-grid">
        <div v-for="product in filteredProducts" :key="product.id" class="product-card">
          <div class="product-image-container">
            <img :src="getImageUrl(product.image)" :alt="product.name" @error="onImageError" loading="lazy" />
          </div>
          
          <div class="product-details">
            <h3 class="product-title">{{ product.name }}</h3>
            <p class="text-price">Rp {{ formatRupiah(product.price) }}</p>
          </div>

          <button class="btn-primary" @click="cartStore.addItem(product)">
            Tambah
          </button>
        </div>
      </div>
    </template>

    <div v-if="cartStore.totalItems > 0" class="floating-cart">
      <div class="cart-info">
        <span class="cart-qty">{{ cartStore.totalItems }} Item</span>
        <span class="cart-price">Rp {{ formatRupiah(cartStore.totalPrice) }}</span>
      </div>
      <button class="btn-checkout" @click="router.push('/cart')">
        Keranjang
      </button>
    </div>

    <div style="height: 120px;"></div>
  </div>
</template>

<style scoped>
/* CSS bawaan sebelumnya */
.menu-header { margin-bottom: 24px; }
.outlet-name { font-size: 20px; font-weight: 600; color: var(--color-ink); margin: 0; }
.table-label { font-size: 14px; color: var(--color-muted); margin: 4px 0 0 0; }
.loader { border: 3px solid var(--color-ice); border-top: 3px solid var(--color-blue); border-radius: 50%; width: 24px; height: 24px; animation: spin 1s linear infinite; margin-bottom: 12px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.error-box { background-color: #fff1f0; border: 1px solid #ffa39e; border-radius: 8px; padding: 16px; color: #cf1322; text-align: center; }
.product-details { display: flex; flex-direction: column; gap: 4px; flex-grow: 1; }
.product-image-container { width: 100%; aspect-ratio: 1 / 1; background-color: var(--color-ice); border-radius: 12px; border: 1px solid var(--color-border); overflow: hidden; }
.product-image-container img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease; }
.product-card:active .product-image-container img { transform: scale(1.05); }

/* === TAMBAHAN CSS KATEGORI & KERANJANG === */

/* Scroll menyamping yang disembunyikan scrollbar-nya */
.category-scroll {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding-bottom: 16px;
  margin-bottom: 16px;
  scrollbar-width: none; /* Firefox */
}
.category-scroll::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

.category-pill {
  padding: 8px 16px;
  border-radius: 20px;
  border: 1px solid var(--color-border); /* #D4E4F4 */
  background: var(--color-white);
  color: var(--color-muted); /* #5A7A9A */
  font-size: 13px;
  font-family: var(--font-ui);
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
}

/* Saat kategori dipilih (Warna Navy) */
.category-pill.active {
  background: var(--color-navy); /* #1B4F8A */
  color: var(--color-white);
  border-color: var(--color-navy);
}

/* Kotak Hitam Melayang di Bawah Layar */
.floating-cart {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 48px);
  max-width: 432px; 
  background-color: var(--color-ink); /* #1A2332 */
  color: var(--color-white);
  border-radius: 16px;
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 8px 24px rgba(26, 35, 50, 0.25);
  z-index: 100;
  animation: slideUp 0.3s ease forwards;
}

@keyframes slideUp {
  from { bottom: -100px; opacity: 0; }
  to { bottom: 24px; opacity: 1; }
}

.cart-info {
  display: flex;
  flex-direction: column;
}

.cart-qty {
  font-size: 12px;
  color: var(--color-hint); /* #8AAFCC */
}

.cart-price {
  font-family: var(--font-mono);
  font-weight: 600;
  font-size: 16px;
}

.btn-checkout {
  background-color: var(--color-blue); /* #2E7DD6 */
  color: var(--color-white);
  border: none;
  padding: 10px 20px;
  border-radius: 8px;
  font-weight: 500;
  font-family: var(--font-ui);
  cursor: pointer;
}
.btn-checkout:active {
  opacity: 0.8;
}
</style>