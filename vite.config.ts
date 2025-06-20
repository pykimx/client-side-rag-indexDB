
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // You can specify a port for the dev server
    open: true   // Automatically open the app in the browser
  },
  build: {
    outDir: 'dist' // Specify the output directory for the build
  },
  define: {
    // Vite does not polyfill process.env like Webpack/Create React App.
    // If your app or its dependencies rely on process.env, you might need to define them.
    // However, for API keys, we'll use import.meta.env.VITE_ prefixes.
    // 'process.env': {} // Keep this empty or define specific fallbacks if truly needed by a lib
  }
})
