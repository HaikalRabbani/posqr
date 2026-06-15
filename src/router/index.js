import { createRouter, createWebHistory } from 'vue-router'
import menu from '../pages/menu.vue'
import cart from '../pages/cart.vue'
import status from '../pages/status.vue'
import payment from '../pages/payment.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/menu/:token', name: 'menu', component: menu },
    { path: '/cart', name: 'cart', component: cart },
    { path: '/status/:id', name: 'status', component: status },
    { path: '/', redirect: '/menu/demo-token' },
    { path: '/payment/:id', name: 'payment', component: payment },
  ]
})

export default router