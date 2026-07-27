import {
  GamesSection,
  HomeFaqSection,
  HomeLatestBlogPostsSection,
  SearchForm,
} from './shared'
import { RecentPlayedGamesSection } from './recent-played-games'
import type { HomeTemplateProps } from './types'

export function DefaultHomeTemplate(props: HomeTemplateProps) {
  const { lang, latestBlogPosts, t } = props

  return (
    <>
      <section className="bg-base-100">
        <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full max-w-4xl">
            <SearchForm {...props} mode="default" />
          </div>

          <div className="max-w-3xl">
            <h1 className="text-4xl font-semibold leading-tight text-base-content sm:text-5xl">
              {t.title}
            </h1>
          </div>
        </div>
      </section>

      <RecentPlayedGamesSection lang={lang} />

      <GamesSection
        {...props}
        gridClassName="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-7"
        sectionClassName="flex w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8"
        showHeader={false}
      />

      <HomeLatestBlogPostsSection blogPosts={latestBlogPosts} lang={lang} />
      <HomeFaqSection lang={lang} />
    </>
  )
}
