import { createFileRoute } from '@tanstack/react-router'

import { normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks } from '#/lib/seo'
import { SITE_ORIGIN } from '#/lib/site-url'

export const Route = createFileRoute('/$locale/')({
  head: ({ params }) => ({
    links: getLocalizedSeoLinks({
      locale: normalizeLocale(params.locale),
      origin: SITE_ORIGIN,
      path: '/',
    }),
  }),
  component: HomeIndexRoute,
})

function HomeIndexRoute() {
  return null
}
