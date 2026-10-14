import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// BASE_PATH lets the same build live under a sub-path, e.g. "/swag-collector/"
// on GitHub Pages. Vercel/Netlify serve from "/" and need nothing.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
})
