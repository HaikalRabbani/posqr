<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const router = useRouter()
const order = ref(null)
const isLoading = ref(true)
const fetchError = ref(false)

const fetchOrderStatus = async () => {
  isLoading.value = true
  fetchError.value = false
  try {
    const response = await api.get(`/public/order/${route.params.id}`)
    // Ambil data dari response.data.data (standard resource Laravel)
    order.value = response.data.data || response.data
  } catch (error) {
    console.error('Gagal mengambil status pesanan:', error)
    fetchError.value = true
  } finally {
    isLoading.value = false
  }
}

const formatRupiah = (angka) => new Intl.NumberFormat('id-ID').format(angka)

// Fungsi untuk membersihkan angka desimal pada persentase pajak (misal 11.0000 -> 11)
const cleanRate = (rate) => parseFloat(rate)

onMounted(() => {
  fetchOrderStatus()
})
</script>

<template>
  <div class="page-wrapper">
    <div class="back-nav" @click="router.push('/')">
      <span>← Buat Pesanan Baru</span>
    </div>

    <h2 class="section-title">Status Pesanan</h2>

    <div v-if="isLoading" class="state-container">
      <div class="loader"></div>
      <p>Memperbarui status...</p>
    </div>

    <div v-else-if="fetchError || !order" class="state-container">
      <div class="error-icon">⚠️</div>
      <p>Pesanan tidak ditemukan atau terjadi kesalahan.</p>
      <button class="btn-retry" @click="fetchOrderStatus">Coba Lagi</button>
    </div>

    <div v-else class="order-container">
      <div class="status-card">
        <div class="card-header">
          <p class="invoice-num">{{ order.invoice_number || 'PROSES GENERATE' }}</p>
          <span class="status-badge" :class="order.status.toLowerCase()">
            {{ order.status.toUpperCase() }}
          </span>
        </div>
        
        <div class="customer-info">
          <div class="info-row">
            <span class="label">Atas Nama</span>
            <span class="value">{{ order.customer_name }}</span>
          </div>
          <div class="info-row">
            <span class="label">Metode Bayar</span>
            <span class="value text-capitalize">{{ order.payment_method === 'midtrans' ? 'Online (QRIS)' : 'Bayar di Kasir' }}</span>
          </div>
        </div>

        <div class="items-section">
          <h4>Rincian Menu</h4>
          <div v-for="item in order.items" :key="item.id" class="order-item">
            <div class="item-desc">
              <span class="item-qty">{{ item.qty }}x</span>
              <div class="item-name-group">
                <span class="item-name">{{ item.product?.name || 'Menu Terhapus' }}</span>
                <span v-if="item.notes" class="item-note">"{{ item.notes }}"</span>
              </div>
            </div>
            <span class="item-total">Rp {{ formatRupiah(item.total_price) }}</span>
          </div>
        </div>

        <div class="billing-section">
          <div class="bill-row">
            <span>Subtotal</span>
            <span>Rp {{ formatRupiah(order.total_price - (order.tax_amount || 0) + (order.discount_amount || 0)) }}</span>
          </div>
          
          <div v-if="order.discount_amount > 0" class="bill-row discount">
            <span>Diskon</span>
            <span>- Rp {{ formatRupiah(order.discount_amount) }}</span>
          </div>

          <div v-for="(tax, index) in order.tax_breakdown" :key="index" class="bill-row">
            <span>{{ tax.name }} ({{ cleanRate(tax.rate) }}{{ tax.type === 'percentage' ? '%' : '' }})</span>
            <span>Rp {{ formatRupiah(tax.amount) }}</span>
          </div>

          <div class="bill-row total">
            <span>Total Bayar</span>
            <span class="grand-total">Rp {{ formatRupiah(order.total_price) }}</span>
          </div>
        </div>
      </div>

      <div class="footer-note">
        <p v-if="order.status === 'pending' && order.payment_method === 'cash'">
          Silakan tunjukkan layar ini ke kasir untuk melakukan pembayaran.
        </p>
        <p v-else-if="order.status === 'pending' && order.payment_method === 'midtrans'">
          Menunggu verifikasi pembayaran online...
        </p>
        <p v-else>
          Terima kasih! Pesanan kamu sedang kami siapkan.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Poppins:wght@400;500;600&display=swap');

.page-wrapper { font-family: 'Poppins', sans-serif; color: #1A2332; background-color: #FFFFFF; min-height: 100vh; padding: 20px; }
.back-nav { color: #2E7DD6; font-size: 14px; cursor: pointer; margin-bottom: 24px; font-weight: 500; }
.section-title { font-size: 22px; font-weight: 600; margin-bottom: 24px; }

.status-card { background: #EBF3FB; padding: 20px; border-radius: 16px; border: 1px solid #D4E4F4; }
.card-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #D4E4F4; padding-bottom: 16px; margin-bottom: 20px; }

.invoice-num { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #1B4F8A; margin: 0; font-size: 15px; }

.status-badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.status-badge.pending { background: rgba(196, 134, 10, 0.15); color: #C4860A; }
.status-badge.paid { background: rgba(42, 122, 75, 0.15); color: #2A7A4B; }
.status-badge.cancelled { background: rgba(220, 38, 38, 0.15); color: #DC2626; }

.info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
.info-row .label { color: #5A7A9A; }
.info-row .value { font-weight: 500; }

.items-section { margin-top: 24px; }
.items-section h4 { font-size: 13px; color: #5A7A9A; font-weight: 600; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
.order-item { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
.item-desc { display: flex; gap: 10px; }
.item-qty { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #1B4F8A; }
.item-name-group { display: flex; flex-direction: column; }
.item-name { font-weight: 500; }
.item-note { font-size: 11px; color: #8AAFCC; font-style: italic; margin-top: 2px; }
.item-total { font-family: 'JetBrains Mono', monospace; color: #1A2332; }

.billing-section { margin-top: 20px; padding-top: 16px; border-top: 1px dashed #8AAFCC; }
.bill-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: #5A7A9A; }
.bill-row.discount { color: #DC2626; }
.bill-row.total { margin-top: 12px; color: #1A2332; font-weight: 600; font-size: 15px; }
.grand-total { font-family: 'JetBrains Mono', monospace; font-size: 18px; color: #2E7DD6; }

.footer-note { margin-top: 30px; text-align: center; font-size: 12px; color: #5A7A9A; line-height: 1.6; padding: 0 20px; }

.state-container { text-align: center; padding: 60px 0; color: #5A7A9A; }
.loader { border: 3px solid #EBF3FB; border-top: 3px solid #2E7DD6; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 16px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.btn-retry { background: #2E7DD6; color: white; border: none; padding: 8px 20px; border-radius: 8px; margin-top: 16px; cursor: pointer; }
</style>