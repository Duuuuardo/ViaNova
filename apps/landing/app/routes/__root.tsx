import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  ScrollRestoration,
} from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Vianova — Uma conta para todos os seus produtos' },
      {
        name: 'description',
        content:
          'A Vianova conecta sua equipe aos produtos Naia com uma única conta, cobrança centralizada e controle total.',
      },
      { name: 'theme-color', content: '#C466FF' },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'Vianova' },
      {
        property: 'og:description',
        content:
          'A Vianova conecta sua equipe aos produtos Naia com uma única conta, cobrança centralizada e controle total.',
      },
      { property: 'og:url', content: 'https://vianova.software' },
      { property: 'og:image', content: 'https://vianova.software/og-image.png' },
      { property: 'og:locale', content: 'pt_BR' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: 'Vianova' },
      {
        name: 'twitter:description',
        content:
          'A Vianova conecta sua equipe aos produtos Naia com uma única conta, cobrança centralizada e controle total.',
      },
      { name: 'twitter:image', content: 'https://vianova.software/og-image.png' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/site.webmanifest' },
      { rel: 'canonical', href: 'https://vianova.software' },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Vianova',
          url: 'https://vianova.software',
          logo: 'https://vianova.software/og-image.png',
          description: 'Plataforma de identidade e billing centralizado para equipes que crescem.',
        }),
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}
