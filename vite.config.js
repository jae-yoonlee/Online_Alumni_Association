import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // 지도 라이브러리는 별도 청크로 분리해 첫 화면을 빠르게 띄운다
        manualChunks(id) {
          if (id.includes('leaflet')) return 'leaflet'
        },
      },
    },
  },
})
