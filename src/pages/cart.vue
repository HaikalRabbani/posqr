<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCartStore } from '../stores/cart.js'
import api from '../services/api.js'

const router = useRouter()
const cartStore = useCartStore()

const paymentMethod = ref('cash') // Default: Bayar di Kasir
const isSubmitting = ref(false)

const formatRupiah = (angka) => {
  return new Intl.NumberFormat('id-ID').format(angka)
}

const handleCheckout = async () => {
  if (!cartStore.customerName) {
    alert('Mohon isi nama kamu terlebih dahulu.')
    return
  }

  // Pastikan data meja sudah tersimpan di Pinia
  if (!cartStore.tableInfo) {
    alert('Data meja tidak valid. Silakan scan ulang QR Code.')
    return
  }

  isSubmitting.value = true
  try {
    // Susun data sesuai dengan kebutuhan API publicOrder Laravel
    const payload = {
      outlet_id: cartStore.tableInfo.outlet_id,
      table_id: cartStore.tableInfo.id,
      customer_name: cartStore.customerName,
      payment_method: paymentMethod.value,
      items: cartStore.items.map(item => ({
        product_id: item.product_id,
        qty: item.qty,
        price: item.price // Kirim harga agar sinkron
      }))
    }

    const response = await api.post('/public/order', payload)
    
    // Jika API merespons dengan URL Pembayaran Midtrans (Online)
    if (paymentMethod.value === 'midtrans' && response.data.payment_url) {
      cartStore.clearCart() // Kosongkan keranjang sebelum pindah halaman
      window.location.href = response.data.payment_url // Lempar pelanggan ke Midtrans
    } else {
      // Jika pelanggan memilih bayar di kasir (Cash)
      alert('Pesanan berhasil dikirim ke dapur! Silakan lakukan pembayaran di kasir.')
      cartStore.clearCart()
      router.push(`/menu/${cartStore.tableToken}`)
    }
  } catch (err) {
    console.error('Checkout error:', err)
    // Tangkap pesan error spesifik dari Laravel (misal: stok habis)
    const errorMsg = err.response?.data?.message || 'Terjadi kesalahan saat membuat pesanan.'
    alert(errorMsg)
  } finally {
    isSubmitting.value = false
  }
}

</script>

<template>
  <div class="page-wrapper">
    <div class="back-nav" @click="router.back()">
      <span>← Kembali ke Menu</span>
    </div>

    <h2 class="section-title">Pesanan Kamu</h2>

    <div v-if="cartStore.items.length > 0" class="cart-list">
      <div v-for="item in cartStore.items" :key="item.product_id" class="cart-item">
        <div class="item-info">
          <p class="item-name">{{ item.name }}</p>
          <p class="item-price">Rp {{ formatRupiah(item.price) }}</p>
        </div>
        <div class="item-qty-control">
          <button @click="cartStore.removeItem(item.product_id)">-</button>
          <span>{{ item.qty }}</span>
          <button @click="cartStore.addItem(item)">+</button>
        </div>
      </div>
    </div>
    <div v-else class="empty-state">
      <p>Keranjang kamu masih kosong.</p>
    </div>

    <div class="checkout-form">
      <div class="form-group">
        <label>Nama Pelanggan</label>
        <input 
          v-model="cartStore.customerName" 
          type="text" 
          placeholder="Masukkan nama kamu..."
          class="input-minimal"
        />
      </div>

      <div class="form-group">
        <label>Metode Pembayaran</label>
        <div class="payment-options">
          <div 
            class="pay-pill" 
            :class="{ active: paymentMethod === 'cash' }"
            @click="paymentMethod = 'cash'"
          >
            Bayar di Kasir
          </div>
          <div 
            class="pay-pill" 
            :class="{ active: paymentMethod === 'midtrans' }"
            @click="paymentMethod = 'midtrans'"
          >
            Online (QRIS/Transfer)
          </div>
        </div>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-row">
        <span>Total Bayar</span>
        <span class="total-amount">Rp {{ formatRupiah(cartStore.totalPrice) }}</span>
      </div>
      <button 
        class="btn-primary checkout-btn" 
        :disabled="cartStore.items.length === 0 || isSubmitting"
        @click="handleCheckout"
      >
        {{ isSubmitting ? 'Memproses...' : 'Pesan Sekarang' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.back-nav {
  color: var(--color-blue);
  font-size: 14px;
  cursor: pointer;
  margin-bottom: 24px;
}

.section-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--color-ink);
  margin-bottom: 24px;
}

.cart-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 32px;
}

.cart-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
}

.item-name {
  font-weight: 500;
  margin: 0;
  font-size: 15px;
}

.item-price {
  font-family: var(--font-mono);
  color: var(--color-muted);
  font-size: 13px;
  margin: 4px 0 0 0;
}

.item-qty-control {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--color-ice);
  padding: 4px 8px;
  border-radius: 8px;
}

.item-qty-control button {
  background: none;
  border: none;
  color: var(--color-navy);
  font-weight: bold;
  font-size: 18px;
  cursor: pointer;
}

.checkout-form {
  margin-bottom: 40px;
}

.form-group {
  margin-bottom: 24px;
}

.form-group label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-muted);
  margin-bottom: 8px;
}

.input-minimal {
  width: 100%;
  border: none;
  border-bottom: 2px solid var(--color-border);
  padding: 8px 0;
  font-family: var(--font-ui);
  font-size: 16px;
  outline: none;
  transition: border-color 0.3s;
}

.input-minimal:focus {
  border-color: var(--color-blue);
}

.payment-options {
  display: flex;
  gap: 10px;
}

.pay-pill {
  flex: 1;
  text-align: center;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  font-size: 13px;
  cursor: pointer;
  color: var(--color-muted);
}

.pay-pill.active {
  background: var(--color-navy);
  color: white;
  border-color: var(--color-navy);
}

.summary-card {
  background: var(--color-white);
  padding-top: 20px;
  border-top: 1px dashed var(--color-border);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.total-amount {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--color-blue);
}

.checkout-btn {
  height: 50px;
  font-size: 15px;
}
</style>