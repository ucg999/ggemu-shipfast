import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/react-router'

import { SiteLayout } from '#/components/site-layout'
import {
  searchBlogPosts,
  type BlogPost,
  type Locale,
} from '#/lib/ggemu'
import { getI18n, normalizeLocale } from '#/lib/i18n'
import { getLocalizedSeoLinks, getSeoOrigin } from '#/lib/seo'

const BLOG_PAGE_SIZE = 12

export const Route = createFileRoute('/$locale/blog')({
  loader: async () => {
    const [seoOrigin, result] = await Promise.all([
      getSeoOrigin(),
      searchBlogPosts({
        data: {
          limit: BLOG_PAGE_SIZE,
          page: 1,
        },
      }),
    ])

    return {
      ...result,
      seoOrigin,
    }
  },
  head: ({ loaderData, params }) => {
    const locale = normalizeLocale(params.locale)
    const t = getI18n(locale).blog

    return {
      links: loaderData?.seoOrigin
        ? getLocalizedSeoLinks({
            locale,
            origin: loaderData.seoOrigin,
            path: '/blog',
          })
        : undefined,
      meta: [
        { title: t.title },
        { name: 'description', content: t.description },
      ],
    }
  },
  component: BlogListPage,
})

function BlogListPage() {
  const { blogPosts, pagination } = Route.useLoaderData()
  const { locale } = Route.useParams()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const lang = normalizeLocale(locale)
  const t = getI18n(lang).blog

  if (pathname !== `/${locale}/blog`) {
    return <Outlet />
  }

  return (
    <SiteLayout locale={lang}>
      <section className="bg-base-100">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary">
            {t.eyebrow}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
            {t.title}
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-base-content/70">
            {t.subtitle}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {blogPosts.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {blogPosts.map((blogPost) => (
              <BlogPostCard blogPost={blogPost} key={getBlogPostKey(blogPost)} lang={lang} />
            ))}
          </div>
        ) : (
          <div className="rounded-box border border-base-300 bg-base-100 p-8 text-center text-base-content/65">
            {t.empty}
          </div>
        )}

        {pagination.pages > 1 ? (
          <p className="mt-8 text-sm text-base-content/55">
            {t.total.replace('{total}', String(pagination.total))}
          </p>
        ) : null}
      </section>
    </SiteLayout>
  )
}

function BlogPostCard({
  blogPost,
  lang,
}: {
  blogPost: BlogPost
  lang: Locale
}) {
  const id = getBlogPostRouteId(blogPost)

  if (!id) {
    return null
  }

  return (
    <Link
      className="group flex aspect-square flex-col overflow-hidden rounded-xl bg-base-200"
      params={{ blogId: id, locale: lang }}
      to="/$locale/blog/$blogId"
    >
      <div className="h-1/2 shrink-0 bg-base-300">
        {blogPost.cover_image_url ? (
          <img
            alt={blogPost.title ?? 'Blog cover'}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            loading="lazy"
            src={blogPost.cover_image_url}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-base-content/40">
            Blog
          </div>
        )}
      </div>
      <div className="flex h-1/2 flex-col px-5 py-4">
        <p className="text-xs text-base-content/50">
          {formatDate(blogPost.created_at, lang)}
        </p>
        <h2 className="mt-2 line-clamp-2 text-lg font-semibold leading-tight text-base-content">
          {blogPost.title}
        </h2>
        {blogPost.excerpt ? (
          <p className="mt-3 line-clamp-3 text-sm leading-5 text-base-content/60">
            {blogPost.excerpt}
          </p>
        ) : null}
      </div>
    </Link>
  )
}

function getBlogPostRouteId(blogPost: BlogPost) {
  return blogPost.slug?.trim() || blogPost._id?.trim() || ''
}

function getBlogPostKey(blogPost: BlogPost) {
  return getBlogPostRouteId(blogPost) || blogPost.title || 'blog-post'
}

function formatDate(value: string | undefined, locale: Locale) {
  if (!value) {
    return ''
  }

  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
