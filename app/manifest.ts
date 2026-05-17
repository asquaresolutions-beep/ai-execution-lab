import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'AI Execution Lab',
    short_name:       'AI Lab',
    description:      'Real AI workflows, systems, and research by A Square Solutions.',
    start_url:        '/',
    display:          'standalone',
    background_color: '#05080f',
    theme_color:      '#f97316',
    icons: [
      {
        src:   '/icon?size=192',
        sizes: '192x192',
        type:  'image/png',
      },
      {
        src:   '/icon?size=512',
        sizes: '512x512',
        type:  'image/png',
      },
    ],
  }
}
