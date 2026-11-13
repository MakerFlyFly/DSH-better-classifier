import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'], maxWorkers: 2, server: { deps: { inline: ['@deepseek-ai/dsh-client-ui-primitives'] } } } })
