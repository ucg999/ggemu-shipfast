import {
  GamesSection,
  HomeFaqSection,
  HomeLatestBlogPostsSection,
} from './shared'
import { RecentPlayedGamesSection } from './recent-played-games'
import type { HomeTemplateProps } from './types'
import { getPlatformLabel } from '#/lib/platform-label'

export function DefaultHomeTemplate(props: HomeTemplateProps) {
  const {
    filterOptions,
    filters,
    lang,
    latestBlogPosts,
    onFilterChange,
    t,
  } = props

  return (
    <>
      <section className="bg-base-100">
        <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full">
            <h1 className="rainbow-title hidden whitespace-nowrap text-[clamp(1.5rem,3vw,3rem)] font-bold leading-tight sm:block">
              {t.title}
            </h1>
          </div>
        </div>
      </section>

      <RecentPlayedGamesSection lang={lang} />

      <nav
        aria-label="游戏平台导航"
        className="border-y border-base-300 bg-base-100 px-4 sm:px-6 lg:px-8"
      >
        <div className="flex items-center gap-1 overflow-x-auto py-2">
          <button
            className={`btn btn-sm shrink-0 rounded-full border-0 px-4 ${
              filters.platform
                ? 'btn-ghost text-base-content/65'
                : 'bg-base-content text-base-100'
            }`}
            onClick={() => onFilterChange('platform', '')}
            type="button"
          >
            首页推荐
          </button>

          {filterOptions.platforms.map((platform) => {
            const isActive = filters.platform === platform.name

            return (
              <button
                className={`btn btn-sm shrink-0 rounded-full border-0 px-4 ${
                  isActive
                    ? 'bg-base-content text-base-100'
                    : 'btn-ghost text-base-content/65'
                }`}
                key={platform.name}
                onClick={() => onFilterChange('platform', platform.name)}
                type="button"
              >
                {getPlatformLabel(platform.name, lang)}
              </button>
            )
          })}
        </div>
      </nav>

      <GamesSection
        {...props}
        gridClassName="grid grid-cols-3 gap-2 sm:gap-4 lg:grid-cols-7"
        mobileItemLimit={30}
        sectionClassName="flex w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8"
        showHeader={false}
      />

      <HomeLatestBlogPostsSection blogPosts={latestBlogPosts} lang={lang} />
      <HomeFaqSection lang={lang} />
    </>
  )
}
