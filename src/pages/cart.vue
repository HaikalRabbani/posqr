<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '../stores/cart.js'
import api from '../services/api.js'

const router = useRouter()
const cartStore = useCartStore()

const goBackToMenu = () => {
  if (cartStore.tableToken) {
    router.push(`/menu/${cartStore.tableToken}`)
  } else {
    router.push('/') // Fallback kalau token gak ada (mis. /cart diakses langsung)
  }
}

const paymentMethod = ref('cash') 
const isSubmitting = ref(false)
const showDiscountModal = ref(false) 
const nameError = ref(false) 

const availableTaxes = ref([])
const availableDiscounts = ref([])

const fetchTaxesAndDiscounts = async () => {
  try {
    const [taxRes, discRes] = await Promise.all([
      api.get('/public/taxes'),
      api.get('/public/discounts')
    ])
    availableTaxes.value = (taxRes.data.data || taxRes.data).filter(t => t.active)
    
    let discountsData = (discRes.data.data || discRes.data)

    // urutkan dari nilai value diskon terbesar ke terkecil
    discountsData.sort((a, b) => Number(b.value) - Number(a.value))

    availableDiscounts.value = discountsData

    // Sekarang, .find() pasti bakal nemu diskon murni yang nilainya paling gede dan eligible!
    const autoSelect = discountsData.find(d => isDiscountEligible(d))
    
    if (autoSelect && !cartStore.appliedDiscount) {
      cartStore.applyDiscount(autoSelect)
    }
  } catch (error) {
    console.error('Gagal memuat data:', error)
  }
}

onMounted(() => { 
  fetchTaxesAndDiscounts() 
})

watch(
  () => cartStore.items, 
  () => {
    if (availableDiscounts.value.length > 0) {
      // Jika voucher yang lagi aktif tiba-tiba jadi GA lolos syarat, langsung lepas.
      if (cartStore.appliedDiscount && !isDiscountEligible(cartStore.appliedDiscount)) {
        cartStore.removeDiscount()
      }
    }
  }, 
  { deep: true }
)

const activeDiscount = computed(() => cartStore.appliedDiscount)
const discountAmount = computed(() => cartStore.discountAmount)
const isDiscountEligible = (d) => cartStore.isDiscountEligible(d)

const selectDiscount = (discountItem) => {
  if (activeDiscount.value?.id === discountItem.id) {
    cartStore.removeDiscount() // Jika diklik ulang voucher yang sama, batalkan voucher global
  } else {
    cartStore.applyDiscount(discountItem) // Jika diklik voucher baru, pasang voucher global & override promo produk
  }
  showDiscountModal.value = false
}

// --- LOGIKA MULTI-PAJAK (METODE BERTINGKAT / SEKUENSIAL) ---
// FIX BESAR: Pakai grandTotal dari cartStore yang sudah akurat
const amountAfterDiscount = computed(() => cartStore.grandTotal)

const taxBreakdown = computed(() => {
  let currentBaseAmount = amountAfterDiscount.value; 

  return availableTaxes.value.map(tax => {
    let amount = 0
    if (tax.type === 'percentage') {
      amount = Math.round(currentBaseAmount * (tax.rate / 100))
    } else {
      amount = tax.rate
    }
    
    currentBaseAmount += amount; 

    return { 
      id: tax.id, 
      name: tax.name, 
      rate: parseFloat(tax.rate), 
      type: tax.type, 
      amount: amount 
    }
  })
})

const totalTaxAmount = computed(() => taxBreakdown.value.reduce((sum, item) => sum + item.amount, 0))

// FIX BESAR: Final Total
const grandTotal = computed(() => amountAfterDiscount.value + totalTaxAmount.value)

const formatRupiah = (angka) => new Intl.NumberFormat('id-ID').format(angka)

const handleCheckout = async () => {
  if (!cartStore.customerName) {
    nameError.value = true
    return
  }
  nameError.value = false

  if (!cartStore.tableInfo) return alert('Data meja tidak ditemukan. Silakan scan ulang.')

  isSubmitting.value = true
  try {
    const payload = {
      outlet_id: cartStore.tableInfo.outlet_id,
      table_id: cartStore.tableInfo.id,
      customer_name: cartStore.customerName,
      payment_method: paymentMethod.value,
      tax_amount: totalTaxAmount.value,
      tax_breakdown: taxBreakdown.value,
      discount_id: activeDiscount.value?.id || null,
      previous_order_id: localStorage.getItem('posqr_last_order_id') || null,
      items: cartStore.items.map(item => ({
        product_id: item.product_id,
        qty: item.qty,
        price: item.price,
        notes: item.notes || null
      }))
    }

    const response = await api.post('/public/order', payload)
    const paymentUrl = response.data?.data?.redirect_url || response.data?.payment_url
    const qrUrl = response.data?.data?.qr_url
    const expiryTime = response.data?.data?.expiry_time
    const orderId = response.data?.data?.order?.id || response.data?.order?.id || response.data?.data?.id || response.data?.id

    if (paymentMethod.value === 'qris' && qrUrl) {
      if (orderId) {
        localStorage.setItem('posqr_last_order_id', orderId)
        localStorage.setItem(`payment_method_${orderId}`, 'qris')
      }
      cartStore.clearCart()
      router.push({ name: 'payment', params: { id: orderId }, query: { qr: qrUrl, expiry: expiryTime } })
    } else if (paymentMethod.value === 'qris' && paymentUrl) {
      if (orderId) {
        localStorage.setItem('posqr_last_order_id', orderId)
        localStorage.setItem(`payment_method_${orderId}`, 'qris')
      }
      cartStore.clearCart()
      window.location.href = paymentUrl
    } else {
      cartStore.clearCart()
      if (orderId) {
        router.push(`/status/${orderId}`)
      } else {
        alert('Pesanan berhasil dikirim ke dapur!')
        router.push('/')
      }
    }
  } catch (err) {
    alert(err.response?.data?.message || 'Gagal mengirim pesanan.')
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="page-wrapper">
    <div class="back-nav" @click="goBackToMenu">
      <span>← Kembali ke Menu</span>
    </div>

    <h2 class="section-title">Pesanan Kamu</h2>

    <div v-if="cartStore.items.length > 0" class="cart-list">
      <div v-for="item in cartStore.items" :key="item.product_id" class="cart-item">
        <div class="item-main">
          <div class="item-info">
            <p class="item-name">{{ item.name }}</p>
            <p class="item-price">Rp {{ formatRupiah(item.price) }}</p>
          </div>
          <div class="item-qty-control">
            <button @click="cartStore.removeItem(item.product_id)">-</button>
            <span class="qty-text">{{ item.qty }}</span>
            <button :disabled="item.qty >= (item.stock ?? Infinity)" @click="cartStore.addItem(item)">+</button>
          </div>
        </div>
        <div class="item-note-wrapper">
          <input v-model="item.notes" type="text" class="input-note" placeholder="Tambahkan catatan (opsional)..." />
        </div>
      </div>
    </div>
    <div v-else class="empty-state">
      <p>Keranjang masih kosong.</p>
    </div>

    <div class="checkout-form">
      <div class="form-group">
        <label :class="{ 'label-error': nameError }">Nama Pelanggan *</label>
        <input 
          v-model="cartStore.customerName" 
          type="text" 
          placeholder="Siapa nama kamu?" 
          class="input-minimal"
          :class="{ 'input-error': nameError }"
          @input="nameError = false"
        />
        <span v-if="nameError" class="error-text">Nama pelanggan wajib diisi sebelum memesan.</span>
      </div>

      <div class="voucher-section" @click="showDiscountModal = true">
        <div class="voucher-left">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"/>
          </svg>
          <span v-if="!activeDiscount">Pilih Promo / Diskon</span>
          <span v-else class="active-promo-name">{{ activeDiscount.name }}</span>
        </div>
        <div class="voucher-right">
          <span v-if="!activeDiscount" class="voucher-hint">Gunakan Voucher</span>
          <span v-else class="voucher-price">-Rp {{ formatRupiah(discountAmount) }}</span>
          <span class="arrow">›</span>
        </div>
      </div>

      <div class="form-group">
        <label>Metode Pembayaran</label>
        <div class="payment-options">
          <div class="pay-pill" :class="{ active: paymentMethod === 'cash' }" @click="paymentMethod = 'cash'">Cash</div>
          <div class="pay-pill" :class="{ active: paymentMethod === 'qris' }" @click="paymentMethod = 'qris'">QRIS</div>
        </div>

        <div v-if="paymentMethod === 'cash'" class="cash-warning-alert">
          <svg class="icon-warning" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
          </svg>
          <div class="warning-text">
            <strong>Pembayaran di Kasir</strong>
            Metode ini tidak dapat diubah lagi. Silakan menuju kasir setelah pesanan dibuat.
          </div>
        </div>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-row">
        <span class="muted-label">Subtotal</span>
        <span class="mono-value">Rp {{ formatRupiah(cartStore.totalPrice) }}</span>
      </div>

      <div v-if="discountAmount > 0" class="summary-row">
        <span class="muted-label">Diskon ({{ activeDiscount?.name }})</span>
        <span class="mono-value diskon-text">- Rp {{ formatRupiah(discountAmount) }}</span>
      </div>

      <div v-for="tax in taxBreakdown" :key="tax.id" class="summary-row">
        <span class="muted-label">{{ tax.name }} ({{ tax.rate }}{{ tax.type === 'percentage' ? '%' : '' }})</span>
        <span class="mono-value">Rp {{ formatRupiah(tax.amount) }}</span>
      </div>

      <div class="summary-row total-row">
        <span class="total-label">Total Bayar</span>
        <span class="total-amount">Rp {{ formatRupiah(grandTotal) }}</span>
      </div>

      <button class="btn-primary checkout-btn" :disabled="cartStore.items.length === 0 || isSubmitting" @click="handleCheckout">
        {{ isSubmitting ? 'Sedang Memproses...' : 'Buat Pesanan Sekarang' }}
      </button>
    </div>

    <div v-if="showDiscountModal" class="modal-overlay" @click.self="showDiscountModal = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>Pilih Voucher</h3>
          <span class="close-btn" @click="showDiscountModal = false">✕</span>
        </div>
        <div class="modal-body">
          <div v-if="availableDiscounts.length === 0" class="empty-promo">Tidak ada promo tersedia.</div>
          <!-- FIX LOGIKA MODAL: Sesuaikan dengan cartStore -->
          <div v-for="d in availableDiscounts" :key="d.id" 
               class="promo-card" :class="{ disabled: !isDiscountEligible(d), active: activeDiscount?.id === d.id }"
               @click="isDiscountEligible(d) ? selectDiscount(d) : null">
            <div class="promo-info">
              <span class="promo-name">{{ d.name }}</span>
              <span class="promo-desc">{{ d.type === 'percentage' ? 'Diskon ' + d.value + '%' : 'Potongan Rp ' + formatRupiah(d.value) }}</span>
              <span class="promo-min">Min. Belanja Rp {{ formatRupiah(d.min_purchase) }}</span>
            </div>
            <div class="promo-radio">
              <div class="radio-circle"><div v-if="activeDiscount?.id === d.id" class="radio-inner"></div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Poppins:wght@400;500;600&display=swap');

/* Base Styles */
.page-wrapper { font-family: 'Poppins', sans-serif; color: #1A2332; background: #FFF; min-height: 100vh; padding: 20px; }
.back-nav { color: #2E7DD6; font-size: 14px; font-weight: 500; cursor: pointer; margin-bottom: 24px; }
.section-title { font-size: 22px; font-weight: 600; margin-bottom: 24px; }

/* Item List */
.cart-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 30px; }
.cart-item { border-bottom: 1px solid #D4E4F4; padding-bottom: 16px; }
.item-main { display: flex; justify-content: space-between; align-items: center; }
.item-name { font-weight: 500; margin: 0; }
.item-price { font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #5A7A9A; margin-top: 4px; }
.item-qty-control { display: flex; align-items: center; gap: 10px; background: #EBF3FB; padding: 4px 10px; border-radius: 8px; }
.item-qty-control button { border: none; background: none; color: #1B4F8A; font-weight: bold; font-size: 18px; cursor: pointer; }
.item-qty-control button:disabled { color: #8AAFCC; cursor: not-allowed; opacity: 0.5; }
.qty-text { font-family: 'JetBrains Mono', monospace; font-weight: 600; min-width: 20px; text-align: center; }
.input-note { width: 100%; border: 1px dashed #D4E4F4; background: #FAFCFF; padding: 8px; border-radius: 6px; font-size: 12px; margin-top: 8px; outline: none; }

/* Checkout Form */
.form-group { margin-bottom: 24px; }
.form-group label { display: block; font-size: 13px; font-weight: 600; color: #5A7A9A; margin-bottom: 8px; }
.input-minimal { width: 100%; border: none; border-bottom: 2px solid #D4E4F4; padding: 8px 0; font-size: 16px; outline: none; transition: 0.3s; }
.input-minimal:focus { border-color: #2E7DD6; }

/* Error Styling */
.label-error { color: #DC2626 !important; }
.input-error { border-bottom-color: #DC2626 !important; }
.error-text { color: #DC2626; font-size: 11px; margin-top: 4px; display: block; font-weight: 500; }

/* Voucher Section Style Shopee */
.voucher-section { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #FAFCFF; border: 1px solid #D4E4F4; border-radius: 10px; margin-bottom: 24px; cursor: pointer; }
.voucher-left { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #1A2332; font-weight: 500; }
.voucher-left svg { color: #2E7DD6; }
.active-promo-name { color: #2E7DD6; font-weight: 600; }
.voucher-right { display: flex; align-items: center; gap: 8px; }
.voucher-hint { font-size: 13px; color: #8AAFCC; }
.voucher-price { font-family: 'JetBrains Mono', monospace; color: #DC2626; font-weight: 700; font-size: 13px; }
.arrow { color: #8AAFCC; font-size: 20px; }

/* Payment Selection */
.payment-options { display: flex; gap: 10px; }
.pay-pill { flex: 1; text-align: center; padding: 12px; border: 1px solid #D4E4F4; border-radius: 10px; font-size: 13px; cursor: pointer; color: #5A7A9A; transition: 0.3s; }
.pay-pill.active { background: #1B4F8A; color: #FFF; border-color: #1B4F8A; }

/* Summary Card */
.summary-card { background: #EBF3FB; padding: 20px; border-radius: 12px; border: 1px solid #D4E4F4; }
.summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
/* Batasi lebar label diskon agar tidak merusak harga */
.summary-row .muted-label {
  max-width: 65%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.muted-label { color: #5A7A9A; }
.mono-value { font-family: 'JetBrains Mono', monospace; font-weight: 500; }
.diskon-text { color: #DC2626; font-weight: 700; }
.total-row { border-top: 1px dashed #8AAFCC; padding-top: 16px; margin-top: 12px; }
.total-label { font-weight: 600; font-size: 16px; }
.total-amount { font-family: 'JetBrains Mono', monospace; font-size: 20px; font-weight: 700; color: #2E7DD6; }
.checkout-btn { width: 100%; height: 52px; background: #2E7DD6; color: #FFF; border: none; border-radius: 8px; font-weight: 600; font-size: 15px; margin-top: 15px; cursor: pointer; }
.checkout-btn:disabled { background: #8AAFCC; cursor: not-allowed; }

/* Alert Voucher Terkunci */
.voucher-locked-alert { display: flex; align-items: flex-start; gap: 8px; padding: 12px 16px; background: #FFFBEB; border: 1px solid #FEF3C7; color: #B45309; border-radius: 10px; margin-bottom: 24px; font-size: 12px; line-height: 1.4; font-weight: 500; }
.icon-alert { width: 16px; height: 16px; color: #D97706; flex-shrink: 0; margin-top: 1px; }

/* Modal Styles */
.modal-overlay { position: fixed; inset: 0; background: rgba(26, 35, 50, 0.6); display: flex; align-items: flex-end; z-index: 1000; }
.modal-content { background: #FFF; width: 100%; border-radius: 20px 20px 0 0; max-height: 80vh; overflow-y: auto; padding: 20px; }
.modal-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #D4E4F4; padding-bottom: 15px; margin-bottom: 15px; }
.modal-header h3 { font-size: 18px; margin: 0; }
.close-btn { font-size: 20px; color: #8AAFCC; cursor: pointer; }
.promo-card { display: flex; justify-content: space-between; align-items: center; border: 1px solid #D4E4F4; border-radius: 12px; padding: 15px; margin-bottom: 12px; cursor: pointer; transition: 0.2s; }
.promo-card.active { border-color: #2E7DD6; background: #FAFCFF; }
.promo-card.disabled { opacity: 0.5; background: #F8FAFC; cursor: not-allowed; }
.promo-info { display: flex; flex-direction: column; gap: 4px; }
.promo-name { font-weight: 600; font-size: 15px; }
.promo-desc { color: #2E7DD6; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; }
.promo-min { font-size: 11px; color: #5A7A9A; }
.radio-circle { width: 20px; height: 20px; border: 2px solid #D4E4F4; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.promo-card.active .radio-circle { border-color: #2E7DD6; }
.radio-inner { width: 10px; height: 10px; background: #2E7DD6; border-radius: 50%; }

/* Alert Pembayaran Cash */
.cash-warning-alert { 
  display: flex; 
  align-items: flex-start; 
  gap: 10px; 
  padding: 12px 14px; 
  background: #FFFBEB; 
  border: 1px solid #FDE68A; 
  color: #92400E; 
  border-radius: 10px; 
  margin-top: 14px; 
  font-size: 12px; 
  line-height: 1.4; 
}
.icon-warning { 
  width: 20px; 
  height: 20px; 
  color: #D97706; 
  flex-shrink: 0; 
  margin-top: 2px; 
}
.warning-text strong { 
  font-weight: 600; 
  color: #92400E; 
  display: block; 
  margin-bottom: 3px; 
}
</style>