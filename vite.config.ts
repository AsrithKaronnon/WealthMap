import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/WealthMap/',
  plugins: [
    react(), 
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.png', 'logo-maskable.png'],
      manifest: {
        name: 'WealthMap',
        short_name: 'WealthMap',
        description: 'Modern Personal Finance Tracker',
        start_url: '/WealthMap/',
        orientation: 'portrait',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        theme_color: '#0d1117',
        background_color: '#0d1117',
        icons: [
          { src: 'logo.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'logo-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ],
})
