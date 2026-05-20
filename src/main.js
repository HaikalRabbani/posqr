import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

const app = createApp(App)
const pinia = createPinia()

pinia.use(({ store }) => {
  if (store.$id === 'cart') {

    const savedState = sessionStorage.getItem('posqr_cart')
    if (savedState) {
      store.$patch(JSON.parse(savedState))
    }

    store.$subscribe((mutation, state) => {
      sessionStorage.setItem('posqr_cart', JSON.stringify(state))
    }, { detached: true })
  }
})

app.use(pinia)
app.use(router)

app.mount('#app')