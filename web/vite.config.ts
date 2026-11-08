import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In development /api goes to the FastAPI server (uvicorn api.main:app --port 8010).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: { port: 5180, proxy: { '/api': 'http://127.0.0.1:8010' } },
  preview: { port: 5181, proxy: { '/api': 'http://127.0.0.1:8010' } },
  build: { chunkSizeWarningLimit: 2000 },
})
