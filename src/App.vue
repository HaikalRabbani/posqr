<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <main class="app-container">
    <RouterView />
  </main>
</template>

<style scoped>
.app-container {
  max-width: 480px; 
  margin: 0 auto;
  min-height: 100vh;
  background-color: #ffffff;
  position: relative;
  box-shadow: 0 0 10px rgba(0,0,0,0.05); /* Sedikit bayangan biar kelihatan batas HP-nya */
}
</style>