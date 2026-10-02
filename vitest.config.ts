import { defineConfig } from 'vitest/config'
import path from 'path'

// Permite que os testes importem o código do app com o atalho "@/", como o próprio app faz.
export default defineConfig({ esbuild: { jsx: 'automatic' }, resolve: { alias: { '@': path.resolve(__dirname, 'src') } } })
