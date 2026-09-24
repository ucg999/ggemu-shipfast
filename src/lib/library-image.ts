import formats from './library-image-formats.json'

export function getLibraryImage(src: string) {
  return (formats as Record<string, string>)[src] ?? src
}
