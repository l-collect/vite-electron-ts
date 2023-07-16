import {fileURLToPath, URL} from 'node:url'

import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import electronLoader from "./plugins/electronLoader";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        vueJsx(),
        electronLoader({
            entry: 'src/background.ts',
        })
    ],
    base: './',
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        }
    }
})
