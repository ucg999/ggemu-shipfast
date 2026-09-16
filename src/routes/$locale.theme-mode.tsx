import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/$locale/theme-mode')({
  beforeLoad: ({ params }) => {
    throw redirect({
      params: { locale: params.locale },
      replace: true,
      search: { platform: undefined },
      to: '/$locale/PRO',
    })
  },
})
