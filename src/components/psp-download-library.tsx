import { DownloadLibrary } from '#/components/switch-download-library'
import type { Locale } from '#/lib/ggemu'

export function PspDownloadLibrary({ lang }: { lang: Locale }) {
  return <DownloadLibrary lang={lang} platform="psp" />
}
