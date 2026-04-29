<script setup>
import { ref, onMounted } from 'vue'

// Nanti kita akan panggil API Axios di sini
onMounted(() => {
  console.log('Halaman Menu dimuat')
})
</script>

<template>
  <div class="menu-container">
    <p>Daftar Menu Kosong</p>
  </div>
</template>

<style scoped>
.menu-container {
  padding: 24px;
}
</style>