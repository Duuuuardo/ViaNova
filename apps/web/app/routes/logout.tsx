import { createFileRoute, redirect } from '@tanstack/react-router'
import { endGlobalSession } from '../lib/logout'

export const Route = createFileRoute('/logout')({
  validateSearch: (search: Record<string, unknown>) => ({
    post_logout_redirect_uri:
      typeof search.post_logout_redirect_uri === 'string'
        ? search.post_logout_redirect_uri
        : undefined,
  }),
  loaderDeps: ({ search }) => ({
    postLogoutRedirectUri: search.post_logout_redirect_uri,
  }),
  loader: async ({ deps }) => {
    const target = await endGlobalSession({
      data: { postLogoutRedirectUri: deps.postLogoutRedirectUri },
    })
    throw redirect({ href: target })
  },
})
