<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const router = useRouter()

const qrUrl = ref(route.query.qr || '')
const expiryTime = ref(route.query.expiry || '')
const isExpired = ref(false)
const remaining = ref(0)
const isChecking = ref(false)
const isDownloading = ref(false)

let countdownInterval = null
let pollingInterval = null

const formatTime = (secs) => {
  if (secs <= 0) return '00:00'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const startCountdown = () => {
  if (!expiryTime.value) return
  // Midtrans Core API mengirim expiry_time dalam zona waktu WIB (GMT+7) tanpa
  // info offset eksplisit di string-nya, jadi offset wajib ditambahkan manual
  // di sini agar tidak salah diasumsikan sebagai UTC/local time browser.
  const target = new Date(expiryTime.value.replace(' ', 'T') + '+07:00').getTime()

  const tick = () => {
    const now = Date.now()
    const diff = Math.floor((target - now) / 1000)
    if (diff <= 0) {
      remaining.value = 0
      isExpired.value = true
      clearInterval(countdownInterval)
      stopPolling()
      
      localStorage.removeItem('posqr_last_order_id')
      localStorage.removeItem(`payment_method_${route.params.id}`)
    } else {
      remaining.value = diff
    }
  }

  tick()
  countdownInterval = setInterval(tick, 1000)
}

const checkStatus = async () => {
  if (isExpired.value) return
  isChecking.value = true
  try {
    const response = await api.get(`/public/order/${route.params.id}`)
    const order = response.data?.data || response.data

    if (order?.status === 'paid') {
      stopPolling()
      clearInterval(countdownInterval)
      router.replace(`/status/${route.params.id}`)
    } else if (order?.status === 'cancelled') {
      stopPolling()
      clearInterval(countdownInterval)
      isExpired.value = true
      
      localStorage.removeItem('posqr_last_order_id')
      localStorage.removeItem(`payment_method_${route.params.id}`)
    }
  } catch (err) {
    console.error('Gagal cek status order:', err)
  } finally {
    isChecking.value = false
  }
}

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval)
    pollingInterval = null
  }
}

const goBackToCart = () => {
  router.push('/cart')
}

const downloadQRCode = async () => {
  if (!qrUrl.value) return
  isDownloading.value = true
  try {
    const response = await fetch(qrUrl.value)
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `QR-Pembayaran-${route.params.id}.png`
    link.click()
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Gagal mengunduh QR:', error)
    alert('Gagal mengunduh QR code. Silakan coba lagi.')
  } finally {
    isDownloading.value = false
  }
}

onMounted(() => {
  if (!qrUrl.value) {
    // QR ga ada, lempar balik ke cart
    router.replace('/cart')
    return
  }
  startCountdown()
  checkStatus()
  pollingInterval = setInterval(checkStatus, 4000)
})

onUnmounted(() => {
  stopPolling()
  if (countdownInterval) clearInterval(countdownInterval)
})
</script>

<template>
  <div class="page-wrapper">
    <div v-if="!isExpired" class="qr-card">
      <div class="card-accent"></div>

      <div class="qr-frame">
        <img :src="qrUrl" alt="QR Code Pembayaran" class="qr-image" />
      </div>

      <div class="timer-box" :class="{ urgent: remaining <= 60 }">
        <span class="timer-label">Sisa Waktu</span>
        <span class="timer-value">{{ formatTime(remaining) }}</span>
      </div>

      <p class="instruction">
        Buka aplikasi e-wallet (GoPay, OVO, Dana, dll) lalu scan QR di atas untuk menyelesaikan pembayaran.
      </p>

      <button class="btn-download-qr" :disabled="isDownloading" @click="downloadQRCode">
        <svg v-if="!isDownloading" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
        </svg>
        {{ isDownloading ? 'Mengunduh...' : 'Unduh QR Code' }}
      </button>

      <div class="status-pill">
        <span class="dot"></span>
        Menunggu pembayaran...
      </div>
    </div>

    <div v-else class="expired-card">
      <div class="error-icon">⏰</div>
      <h3>QR Sudah Kedaluwarsa</h3>
      <p>Waktu pembayaran sudah habis. Silakan buat pesanan ulang.</p>
      <button class="btn-retry" @click="goBackToCart">Kembali ke Keranjang</button>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Poppins:wght@400;500;600;700&display=swap');

.page-wrapper {
  font-family: 'Poppins', sans-serif;
  color: #1A2332;
  background-color: #FFFFFF;
  min-height: 100vh;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.qr-card {
  position: relative;
  background: #FFFFFF;
  border: 1px solid #D4E4F4;
  border-radius: 20px;
  padding: 28px 20px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 8px 24px rgba(46, 125, 214, 0.08);
  overflow: hidden;
  width: 100%;
  max-width: 360px;
}

.card-accent {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 6px;
  background: linear-gradient(90deg, #2E7DD6, #6FB1F0);
}

.qr-frame {
  background: #EBF3FB;
  border: 1px solid #D4E4F4;
  border-radius: 16px;
  padding: 16px;
  margin-top: 12px;
  width: 100%;
  max-width: 240px;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
}

.qr-image { width: 100%; max-width: 208px; height: auto; aspect-ratio: 1 / 1; object-fit: contain; display: block; border-radius: 8px; }

.timer-box {
  margin-top: 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 24px;
  border-radius: 14px;
  background: #EBF3FB;
  transition: background 0.3s, color 0.3s;
}
.timer-box.urgent { background: #FFF1ED; }
.timer-box.urgent .timer-value { color: #E0612B; }

.timer-label { font-size: 11px; color: #5A7A9A; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
.timer-value { font-family: 'JetBrains Mono', monospace; font-size: 30px; font-weight: 700; color: #2E7DD6; line-height: 1.3; transition: color 0.3s; }

.instruction { margin-top: 18px; font-size: 13px; color: #5A7A9A; text-align: center; line-height: 1.6; max-width: 280px; }

.btn-download-qr {
  width: 100%;
  max-width: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: #FFFFFF;
  color: #2E7DD6;
  border: 2px solid #2E7DD6;
  padding: 10px 20px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  font-family: 'Poppins', sans-serif;
  transition: background 0.2s, color 0.2s;
  margin-top: 16px;
}
.btn-download-qr:hover { background: #EBF3FB; }
.btn-download-qr:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-download-qr:active:not(:disabled) { transform: scale(0.97); }

.status-pill {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  background: #FFFBEB;
  color: #C4860A;
  padding: 8px 18px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.dot { width: 8px; height: 8px; border-radius: 50%; background: #C4860A; animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }

.expired-card { text-align: center; padding: 40px 20px; color: #5A7A9A; width: 100%; max-width: 360px; }
.error-icon { font-size: 40px; margin-bottom: 12px; }
.expired-card h3 { color: #1A2332; margin-bottom: 4px; }
.btn-retry {
  margin-top: 20px;
  background: #2E7DD6;
  color: #FFF;
  border: none;
  padding: 12px 28px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
  font-family: 'Poppins', sans-serif;
  transition: background 0.2s, transform 0.1s;
}
.btn-retry:hover { background: #2569B8; }
.btn-retry:active { transform: scale(0.97); }

@media (min-width: 480px) {
  .qr-frame { max-width: 260px; }
  .qr-image { max-width: 228px; }
}
</style>