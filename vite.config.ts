import { defineConfig, type Plugin } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import { libraryUpdatesPlugin } from './scripts/library-updates.mjs'

function cloudflareWorkersClientShim(localPreview = false): Plugin {
  const moduleId = '\0cloudflare-workers-client-shim'

  return {
    name: 'cloudflare-workers-client-shim',
    enforce: 'pre' as const,
    resolveId(id: string) {
      if (
        id === 'cloudflare:workers' &&
        (localPreview || this.environment?.name !== 'ssr')
      ) {
        return moduleId
      }
    },
    load(id: string) {
      if (id === moduleId) {
        return 'export const env = {}'
      }
    },
  }
}

const config = defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  plugins: [
    libraryUpdatesPlugin(),
    cloudflareWorkersClientShim(mode === 'local-preview'),
    ...(['test', 'local-preview'].includes(mode) ? [] : [cloudflare({ viteEnvironment: { name: 'ssr' } })]),
    tanstackStart(),
    tailwindcss(),
    viteReact(),
  ],
}))

export default config
