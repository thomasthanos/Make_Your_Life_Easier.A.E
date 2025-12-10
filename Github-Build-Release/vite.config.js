import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // <--- ΠΟΛΥ ΣΗΜΑΝΤΙΚΟ: Αυτό λύνει το πρόβλημα της άσπρης οθόνης στο build
  server: {
    port: 5173,
    strictPort: true,
  }
})