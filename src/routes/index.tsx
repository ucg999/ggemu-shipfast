import { createFileRoute, redirect } from '@tanstack/react-router'

import { normalizeSiteTemplate } from '#/lib/site-config'
import { SITE_ORIGIN } from '#/lib/site-url'

export const Route = createFileRoute('/')({
  validateSearch: (search) => ({
    template: normalizeSiteTemplate(search.template),
  }),
  beforeLoad: ({ search }) => {
    const target = new URL('/zh-CN', SITE_ORIGIN)

    if (search.template) {
      target.searchParams.set('template', search.template)
    }

    throw redirect({
      href: target.toString(),
      statusCode: 301,
    })
  },
})
