<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../services/api.js'

const route = useRoute()
const router = useRouter()
const order = ref(null)
const isLoading = ref(true)

const fetchOrderStatus = async () => {
  try {
    const response = await api.get(`/public/order/${route.params.id}`)
    order.value = response.data.data || response.data
  } catch (error) {
    console.error('Gagal mengambil status pesanan', error)
  } finally {
    isLoading.value = false
  }
}

const formatRupiah = (angka) => {
  return new Intl.NumberFormat('id-ID').format(angka)
}

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

    <div v-if="isLoading" class="loading-state">
      <p>Memuat status pesanan...</p>
    </div>

    <div v-else-if="order" class="status-card">
      <div class="status-header">
        <p class="invoice">{{ order.invoice_number || 'Menunggu Invoice' }}</p>
        <span class="badge" :class="order.status.toLowerCase()">
          {{ order.status.toUpperCase() }}
        </span>
      </div>
      
      <div class="order-details">
        <p><strong>Nama:</strong> <span>{{ order.customer_name }}</span></p>
        <p>
          <strong>Total:</strong> 
          <span class="amount">Rp {{ formatRupiah(order.total_price) }}</span>
        </p>
      </div>

      <div class="items-list">
        <h4>Item Pesanan:</h4>
        <div v-for="item in order.items" :key="item.id" class="item">
          <span class="qty-name">{{ item.qty }}x {{ item.product?.name }}</span>
          <span class="price">Rp {{ formatRupiah(item.total_price) }}</span>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>Pesanan tidak ditemukan.</p>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Poppins:wght@400;500;600&display=swap');

.page-wrapper {
  font-family: 'Poppins', sans-serif;
  color: #1A2332; /* Ink */
  background-color: #FFFFFF;
  min-height: 100vh;
  padding: 20px;
}

.back-nav {
  color: #2E7DD6; /* Blue */
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 24px;
  font-weight: 500;
}

.section-title {
  font-size: 22px;
  font-weight: 600;
  color: #1A2332; /* Ink */
  margin-bottom: 24px;
}

.status-card {
  background: #EBF3FB; /* Ice */
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #D4E4F4; /* Border */
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #D4E4F4; /* Border */
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.invoice {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: #1B4F8A; /* Navy */
  margin: 0;
  font-size: 15px;
}

.badge {
  padding: 4px 10px;
  border-radius: 20px;
  font-size: 11px; /* Minimum font size kasir */
  font-weight: 600;
  letter-spacing: 0.5px;
}

/* Translucent fill pattern sesuai panduan */
.badge.pending {
  background: rgba(196, 134, 10, 0.15); /* Pending amber bg */
  color: #C4860A; /* Pending amber text */
}

.badge.paid {
  background: rgba(42, 122, 75, 0.15); /* Paid green bg */
  color: #2A7A4B; /* Paid green text */
}

.badge.cancelled {
  background: rgba(220, 38, 38, 0.15);
  color: #DC2626;
}

.order-details p {
  display: flex;
  justify-content: space-between;
  color: #5A7A9A; /* Muted */
  font-size: 14px;
  margin-bottom: 8px;
}

.order-details strong {
  color: #5A7A9A; /* Muted */
  font-weight: 400;
}

.order-details span {
  color: #1A2332; /* Ink */
  font-weight: 500;
}

.amount {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
}

.items-list {
  margin-top: 16px;
  border-top: 1px solid #D4E4F4; /* Border */
  padding-top: 16px;
}

.items-list h4 {
  font-size: 13px;
  color: #5A7A9A; /* Muted */
  font-weight: 500;
  margin-bottom: 12px;
}

.item {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  margin-bottom: 10px;
}

.item .qty-name {
  color: #1A2332; /* Ink */
  font-weight: 500;
}

.item .price {
  font-family: 'JetBrains Mono', monospace;
  color: #5A7A9A; /* Muted */
}

.loading-state, .empty-state {
  text-align: center;
  color: #5A7A9A; /* Muted */
  font-size: 14px;
  padding: 40px 0;
}
</style>