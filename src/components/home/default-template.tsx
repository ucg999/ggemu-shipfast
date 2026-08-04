import { Link } from '@tanstack/react-router'

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
      <section className="hidden bg-base-100 lg:block">
        <div className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
          <div className="w-full">
            <h1 className="rainbow-title hidden whitespace-nowrap text-[clamp(2rem,3.7vw,4rem)] font-bold leading-tight sm:block">
              {t.title}
            </h1>
          </div>
        </div>
      </section>

      <div className="hidden lg:block">
        <RecentPlayedGamesSection lang={lang} />
      </div>

      <nav
        aria-label="游戏平台导航"
        className="hidden border-y border-base-300 bg-base-100 px-4 sm:px-6 lg:block lg:px-8"
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
        gridClassName="game-mosaic-grid grid grid-flow-dense grid-cols-12 gap-1 sm:grid-cols-12 lg:grid-cols-7 lg:gap-2"
        mobileItemLimit={102}
        sectionClassName="flex w-full flex-col gap-3 p-1 lg:px-3 lg:py-3"
        showHeader={false}
      />

      <div className="hidden lg:block">
        <HomeLatestBlogPostsSection blogPosts={latestBlogPosts} lang={lang} />
        <HomeFaqSection lang={lang} />
      </div>
    </>
  )
}

function MobileQuickLinks({ lang }: { lang: HomeTemplateProps['lang'] }) {
  return (
    <section className="px-4 pb-4 sm:px-6 lg:hidden">
      <div className="rounded-2xl bg-base-100 p-3">
        <Link
          className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-base-200"
          params={{ locale: lang }}
          search={{}}
          to="/$locale/play-my-rom"
        >
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200">
            <i className="ri-cpu-line" />
          </span>
          超级模拟器
        </Link>

        <details>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-base-200">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200">
              <i className="ri-gift-line" />
            </span>
            <span className="flex-1">拿点有用的</span>
            <i className="ri-arrow-down-s-line" />
          </summary>
          <ul className="menu menu-sm ml-11">
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/TUxF4AQG" rel="noreferrer" target="_blank">
                PSP游戏库
              </a>
            </li>
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/RclPTyXd" rel="noreferrer" target="_blank">
                PSV游戏库
              </a>
            </li>
            <li>
              <a href="https://www.kdocs.cn/etapps/query/q/detUdefK" rel="noreferrer" target="_blank">
                Switch游戏库
              </a>
            </li>
            <li>
              <a
                href="https://www.kdocs.cn/etapps/query/q/zPCu5XAr?share_origin=re_share_conditionshome"
                rel="noreferrer"
                target="_blank"
              >
                街机库
              </a>
            </li>
            <li>
              <a href="https://kdocs.cn/l/cqE4v1WZxdnc" rel="noreferrer" target="_blank">
                热门游戏合集
              </a>
            </li>
          </ul>
        </details>

        <details>
          <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 font-medium hover:bg-base-200">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-base-200">
              <i className="ri-user-add-line" />
            </span>
            <span className="flex-1">找点新朋友</span>
            <i className="ri-arrow-down-s-line" />
          </summary>
          <div className="ml-11 grid grid-cols-2 gap-3 p-2">
            <details className="rounded-xl bg-base-200 p-2">
              <summary className="cursor-pointer list-none text-center text-sm font-medium">
                <i className="ri-wechat-fill mr-1 text-[#07c160]" />
                微信
              </summary>
              <img
                alt="游戏历险记微信二维码"
                className="mt-2 w-full rounded-lg bg-white object-contain"
                src="/wechat-qr.png"
              />
            </details>
            <details className="rounded-xl bg-base-200 p-2">
              <summary className="cursor-pointer list-none text-center text-sm font-medium">
                <i className="ri-qq-fill mr-1" />
                QQ
              </summary>
              <img
                alt="游戏历险记QQ二维码"
                className="mt-2 w-full rounded-lg object-contain"
                src="/qq-qr.jpg"
              />
            </details>
          </div>
        </details>
      </div>
    </section>
  )
}
