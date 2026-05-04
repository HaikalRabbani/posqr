import { defineStore } from 'pinia'

export const useCartStore = defineStore('cart', {
  state: () => ({
    tableToken: null,
    tableInfo: null,
    items: [],
    customerName: '', // Simpan nama di sini
  }),
  getters: {
    totalItems: (state) => state.items.reduce((total, item) => total + item.qty, 0),
    totalPrice: (state) => state.items.reduce((total, item) => total + (item.price * item.qty), 0),
  },
  actions: {
    setTable(token, info) {
      this.tableToken = token
      this.tableInfo = info
    },
    addItem(product) {
      const price = product.price || product.pivot?.price || 0
      const existingItem = this.items.find(item => item.product_id === product.id)
      if (existingItem) {
        existingItem.qty++
      } else {
        this.items.push({
          product_id: product.id,
          name: product.name,
          price: price,
          qty: 1
        })
      }
    },
    removeItem(productId) {
      const index = this.items.findIndex(item => item.product_id === productId)
      if (index !== -1) {
        if (this.items[index].qty > 1) {
          this.items[index].qty--
        } else {
          this.items.splice(index, 1)
        }
      }
    },
    clearCart() {
      this.items = []
      this.customerName = ''
    }
  }
})