import { createRouter, createWebHistory } from 'vue-router'
import menu from '../pages/menu.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/menu/:token', // Tangkap token QR dari URL
      name: 'menu',
      component: menu
    },
    // Jika ada yang akses root URL, lempar ke halaman not found atau biarkan kosong
    {
      path: '/',
      redirect: '/menu/demo-token' // Sementara untuk testing lokal
    }
  ]
})

export default router