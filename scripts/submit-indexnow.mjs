const siteOrigin = 'https://ucg999.com'
const host = 'ucg999.com'
const key = '4cd3d18da0a7c2e087b46d3f1c95f103'
const keyLocation = `${siteOrigin}/${key}.txt`
const endpoint = 'https://api.indexnow.org/indexnow'

function extractLocations(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map(match => match[1].trim())
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': 'ucg999-indexnow/1.0' } })
  if (!response.ok) throw new Error(`Unable to read ${url}: HTTP ${response.status}`)
  return response.text()
}

async function readSitemapUrls() {
  const indexUrl = `${siteOrigin}/sitemap.xml`
  const indexLocations = extractLocations(await fetchText(indexUrl))
  const sitemapUrls = indexLocations.filter(url => url.endsWith('.xml'))
  const pageGroups = await Promise.all(sitemapUrls.map(async url => extractLocations(await fetchText(url))))
  return [...new Set(pageGroups.flat().filter(url => url.startsWith(`${siteOrigin}/`)))]
}

function normalizeRequestedUrls(values) {
  return [...new Set(values.map(value => new URL(value, siteOrigin).toString()).filter(url => url.startsWith(`${siteOrigin}/`)))]
}

async function submitBatch(urlList) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key, keyLocation, urlList }),
  })
  if (!response.ok) throw new Error(`IndexNow rejected the submission: HTTP ${response.status}`)
}

const requested = process.argv.slice(2)
const submitAll = requested.includes('--all')
const urls = submitAll
  ? await readSitemapUrls()
  : normalizeRequestedUrls(requested.filter(value => value !== '--all'))

if (!urls.length) {
  console.error('Provide one or more changed URLs, or use --all for the initial submission.')
  process.exitCode = 1
} else {
  for (let offset = 0; offset < urls.length; offset += 10_000) {
    await submitBatch(urls.slice(offset, offset + 10_000))
  }
  console.log(`Submitted ${urls.length} URL(s) to IndexNow.`)
}
