import { createFileRoute } from '@tanstack/react-router'

import { getSitemapSectionXml } from './sitemap[.]xml'

export const Route = createFileRoute('/sitemap-games-1.xml')({
  server: { handlers: { GET: ({ request }) => sitemapResponse(request, 'games-1') } },
})

async function sitemapResponse(request: Request, section: 'games-1') {
  const xml = await getSitemapSectionXml(new URL(request.url).origin, section)
  return new Response(xml, { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400', 'Content-Type': 'application/xml; charset=utf-8' } })
}
