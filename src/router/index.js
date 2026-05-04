import { createRouter, createWebHistory } from 'vue-router'
import menu from '../pages/menu.vue'
import cart from '../pages/cart.vue' // Tambahkan ini

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/menu/:token', name: 'menu', component: menu },
    { path: '/cart', name: 'cart', component: cart }, // Tambahkan ini
    { path: '/', redirect: '/menu/demo-token' }
  ]
})

export default router