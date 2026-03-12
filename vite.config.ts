import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages friendly: use HashRouter in app.
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: true,
  },
})
