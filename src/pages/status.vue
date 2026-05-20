<script setup>
// 1. Tambahkan onUnmounted untuk membersihkan memori websocket
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api.js'
// 2. Import instansi Echo yang sudah kita buat sebelumnya
import echo from '../services/echo.js'
import html2canvas from 'html2canvas'
// --- TAMBAHAN: Import cart store untuk akses token ---
import { useCartStore } from '../stores/cart.js'

const route = useRoute()
const router = useRouter()
const cartStore = useCartStore() // Inisialisasi store
const order = ref(null)
const isLoading = ref(true)
const fetchError = ref(false)

const receiptRef = ref(null)
const isDownloading = ref(false)

// --- TAMBAHAN: Variabel penampung untuk timer interval auto-refresh ---
let pollingInterval = null

// --- TAMBAHAN: Fungsi untuk mematikan interval ---
const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

// --- TAMBAHAN: Fungsi kembali ke menu sesuai token ---
const goBackToMenu = () => {
  if (cartStore.tableToken) {
    router.push(`/menu/${cartStore.tableToken}`)
  } else {
    router.push('/') // Fallback kalau token gak ada
  }
}

const fetchOrderStatus = async () => {
  // Hanya tampilkan loading penuh jika data order belum ada sama sekali
  if (!order.value) isLoading.value = true
  fetchError.value = false
  
  try {
    const response = await api.get(`/public/order/${route.params.id}`)
    order.value = response.data.data || response.data

    // --- TAMBAHAN: Hentikan auto-refresh jika status sudah lunas/batal ---
    if (order.value?.status === 'paid' || order.value?.status === 'cancelled') {
      stopPolling()
    }
  } catch (error) {
    console.error('Gagal mengambil status pesanan:', error)
    fetchError.value = true
  } finally {
    isLoading.value = false
  }
}

const formatRupiah = (angka) => new Intl.NumberFormat('id-ID').format(angka || 0)
const cleanRate = (rate) => parseFloat(rate || 0)

const handleDownloadImage = async () => {
  if (!receiptRef.value) return
  
  isDownloading.value = true
  try {
    const canvas = await html2canvas(receiptRef.value, {
      scale: 2, 
      backgroundColor: '#EBF3FB', 
      useCORS: true
    })
    
    const image = canvas.toDataURL("image/png")
    
    const link = document.createElement('a')
    link.download = `Struk-${order.value?.invoice_number || 'Pesanan'}.png`
    link.href = image
    link.click()
  } catch (error) {
    console.error('Gagal mengunduh gambar:', error)
    alert('Terjadi kesalahan saat menyimpan gambar.')
  } finally {
    isDownloading.value = false
  }
}

onMounted(() => {
  // Ambil data pertama kali saat halaman dibuka
  fetchOrderStatus()

  // --- TAMBAHAN: Mulai auto-refresh setiap 5 detik sebagai BACKUP realtime ---
  pollingInterval = setInterval(() => {
    fetchOrderStatus()
  }, 5000)

  // 3. MULAI MENDENGARKAN REALTIME REVERB (TETAP DIPERTAHANKAN)
  const orderId = route.params.id
  echo.channel(`customer-order.${orderId}`)
    .listen('.PaymentPaid', (e) => {
      console.log('Sinyal Realtime: Pesanan Lunas!', e)
      fetchOrderStatus()
    })
    .listen('.OrderUpdated', (e) => {
      console.log('Sinyal Realtime: Pesanan Diubah Kasir!', e)
      fetchOrderStatus()
    })
})

// 4. PUTUSKAN KONEKSI SAAT PELANGGAN PINDAH HALAMAN
onUnmounted(() => {
  const orderId = route.params.id
  
  // (Perbaikan kecil: samakan nama channel leave dengan yang di-listen agar benar-benar terputus)
  echo.leaveChannel(`customer-order.${orderId}`)
  
  // --- TAMBAHAN: Pastikan interval auto-refresh dimatikan ---
  stopPolling()
})
</script>

<template>
  <div class="page-wrapper">
    <div class="back-nav" @click="goBackToMenu">
      <span>← Buat Pesanan Baru</span>
    </div>

    <h2 class="section-title">Status Pesanan</h2>

    <div v-if="isLoading" class="state-container">
      <div class="loader"></div>
      <p>Memperbarui status...</p>
    </div>

    <div v-else-if="fetchError || !order" class="state-container">
      <div class="error-icon">⚠️</div>
      <p>Pesanan tidak ditemukan.</p>
      <button class="btn-retry" @click="fetchOrderStatus">Coba Lagi</button>
    </div>

    <div v-else class="order-container">
      <div ref="receiptRef" class="status-card">
        <div class="card-header">
          <div class="brand-info">
            <h3 class="brand-name">ETRES POS</h3>
            <p class="invoice-num">{{ order?.invoice_number || 'PROSES GENERATE' }}</p>
          </div>
          <span class="status-badge" :class="order?.status?.toLowerCase() || 'pending'">
            {{ order?.status === 'pending' ? 'MENUNGGU KONFIRMASI' : (order?.status?.toUpperCase() || 'PENDING') }}
          </span>
        </div>
        
        <div class="customer-info">
          <div class="info-row">
            <span class="label">Atas Nama</span>
            <span class="value">{{ order?.customer_name }}</span>
          </div>
          <div class="info-row">
            <span class="label">Tanggal</span>
            <span class="value">{{ new Date(order?.created_at).toLocaleString('id-ID') }}</span>
          </div>
          <div class="info-row">
            <span class="label">Metode Bayar</span>
            <span class="value text-capitalize">{{ order?.payment_method === 'midtrans' ? 'Online (QRIS)' : 'Bayar di Kasir' }}</span>
          </div>
        </div>

        <div class="items-section">
          <h4>Rincian Menu</h4>
          <div v-for="item in order?.items" :key="item.id" class="order-item">
            <div class="item-desc">
              <span class="item-qty">{{ item.qty }}x</span>
              <div class="item-name-group">
                <span class="item-name">{{ item.product?.name || 'Menu' }}</span>
                <span v-if="item.notes" class="item-note">"{{ item.notes }}"</span>
              </div>
            </div>
            <span class="item-total">Rp {{ formatRupiah(item.total_price) }}</span>
          </div>
        </div>

        <div class="billing-section">
          <div class="bill-row">
            <span>Subtotal</span>
            <span>Rp {{ formatRupiah((order?.total_price || 0) - (order?.tax_amount || 0) + (order?.discount_amount || 0)) }}</span>
          </div>
          
          <div v-if="order?.discount_amount > 0" class="bill-row discount">
            <span>Diskon</span>
            <span>- Rp {{ formatRupiah(order.discount_amount) }}</span>
          </div>

          <div v-for="(tax, index) in order?.tax_breakdown" :key="index" class="bill-row">
            <span>{{ tax.name }} ({{ cleanRate(tax.rate) }}{{ tax.type === 'percentage' ? '%' : '' }})</span>
            <span>Rp {{ formatRupiah(tax.amount) }}</span>
          </div>

          <div class="bill-row total">
            <span>TOTAL AKHIR</span>
            <span class="grand-total">Rp {{ formatRupiah(order?.total_price) }}</span>
          </div>
        </div>
        
        <div class="print-footer">
          <p style="text-align: center; font-size: 11px; color: #8AAFCC; margin-top: 16px; border-top: 1px dashed #8AAFCC; padding-top: 16px;">Terima kasih telah berkunjung!<br>Sudah termasuk Pajak & Layanan</p>
        </div>
      </div>

      <div class="action-buttons">
        <button v-if="order?.status === 'paid'" class="btn-print" :disabled="isDownloading" @click="handleDownloadImage">
          <svg v-if="!isDownloading" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          {{ isDownloading ? 'Menyimpan...' : 'Simpan Struk ke Galeri' }}
        </button>
      </div>

      <div class="footer-note">
        <p v-if="order?.status === 'pending' && order?.payment_method === 'cash'">
          Silakan tunjukkan layar atau gambar struk ini ke kasir untuk melakukan pembayaran.
        </p>
        
        <div v-else-if="order?.status === 'pending' && order?.payment_method === 'midtrans'" class="note-online-pending">
          <span class="note-title">Pembayaran Sedang Diproses ⏳</span>
          <span class="note-desc">Jangan khawatir, pesananmu sudah masuk dan akan segera dikonfirmasi oleh kasir kami.</span>
        </div>
        
        <p v-else-if="order?.status === 'paid'">
          Yeay! Pembayaran berhasil dan pesanan kamu sedang kami siapkan.
        </p>
        <p v-else-if="order?.status === 'cancelled'">
          Pesanan telah dibatalkan.
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
.card-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #D4E4F4; padding-bottom: 16px; margin-bottom: 20px; }

.brand-name { font-weight: 700; color: #1B4F8A; margin: 0 0 4px 0; font-size: 18px; }
.invoice-num { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #5A7A9A; margin: 0; font-size: 13px; }

.status-badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; }
.status-badge.pending { background: rgba(196, 134, 10, 0.15); color: #C4860A; }
.status-badge.paid { background: rgba(42, 122, 75, 0.15); color: #2A7A4B; }
.status-badge.cancelled { background: rgba(220, 38, 38, 0.15); color: #DC2626; }

.info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
.info-row .label { color: #5A7A9A; }
.info-row .value { font-weight: 500; }

.items-section { margin-top: 24px; }
.items-section h4 { font-size: 12px; color: #5A7A9A; font-weight: 600; margin-bottom: 12px; text-transform: uppercase; }
.order-item { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 14px; }
.item-desc { display: flex; gap: 10px; }
.item-qty { font-family: 'JetBrains Mono', monospace; font-weight: 600; color: #1B4F8A; }
.item-name { font-weight: 500; }
.item-note { font-size: 11px; color: #8AAFCC; font-style: italic; margin-top: 2px; display: block; }
.item-total { font-family: 'JetBrains Mono', monospace; }

.billing-section { margin-top: 20px; padding-top: 16px; border-top: 1px dashed #8AAFCC; }
.bill-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: #5A7A9A; }
.bill-row.discount { color: #DC2626; }
.bill-row.total { margin-top: 12px; color: #1A2332; font-weight: 600; font-size: 15px; }
.grand-total { font-family: 'JetBrains Mono', monospace; font-size: 20px; color: #2E7DD6; }

.action-buttons { margin-top: 20px; }
.btn-print { width: 100%; display: flex; align-items: center; justify-content: center; background: #2E7DD6; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 600; cursor: pointer; font-family: 'Poppins', sans-serif; transition: background 0.2s; }
.btn-print:disabled { background: #8AAFCC; cursor: not-allowed; }

.footer-note { margin-top: 30px; text-align: center; font-size: 12px; color: #5A7A9A; line-height: 1.6; }

.note-online-pending {
  background: #FAFCFF;
  border: 1px solid #D4E4F4;
  padding: 12px;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.note-title {
  font-weight: 700;
  color: #1B4F8A; /* Warna Navy yang meyakinkan */
  font-size: 13px;
}
.note-desc {
  color: #5A7A9A;
  font-size: 11px;
  line-height: 1.4;
}
/* State Handlers */
.state-container { text-align: center; padding: 60px 0; color: #5A7A9A; }
.loader { border: 3px solid #EBF3FB; border-top: 3px solid #2E7DD6; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 0 auto 16px; }
@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
</style>