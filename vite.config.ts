import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig(({ mode }) => ({
 plugins: [react(), tailwindcss()],
 base: './',
 build: mode === 'staging' ? { outDir: 'dist-staging', rollupOptions: { input: 'staging.html' } } : {},
 test: { environment: 'jsdom', exclude: ['**/node_modules/**', '**/functions/**', '**/scripts/**'] },
}))
