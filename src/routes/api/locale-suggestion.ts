import { createFileRoute } from '@tanstack/react-router'

const CHINESE_REGIONS = new Set(['CN', 'HK', 'MO', 'TW'])

export const Route = createFileRoute('/api/locale-suggestion')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const country = (request.headers.get('cf-ipcountry') || request.headers.get('x-vercel-ip-country') || '').trim().toUpperCase()
        const acceptLanguage = request.headers.get('accept-language') || ''
        const suggestEnglish = country
          ? !CHINESE_REGIONS.has(country)
          : Boolean(acceptLanguage && !/^zh(?:-|,|;|$)/i.test(acceptLanguage))
        return Response.json({ country: country || null, suggestEnglish }, { headers: { 'cache-control': 'private, no-store' } })
      },
    },
  },
})
