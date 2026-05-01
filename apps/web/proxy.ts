import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/forgot-password(.*)',
  '/api/v1/webhooks(.*)',
])

// Next.js 16: proxy.ts replaces middleware.ts. Function name is `proxy`, not `middleware`.
// This rewrite enables the /@username URL convention (D-01 from CONTEXT.md):
// /@sarah          → /sarah         (profile page)
// /@sarah/followers → /sarah/followers (followers list)
// /@sarah/following → /sarah/following (following list)
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/@')) {
    // Remove the leading / and the @: /@sarah/followers → sarah/followers
    const withoutLeadingSlash = pathname.slice(1)   // @sarah/followers
    const withoutAt = withoutLeadingSlash.slice(1)   // sarah/followers
    return NextResponse.rewrite(new URL(`/${withoutAt}`, request.url))
  }

  return NextResponse.next()
}

// Clerk auth protection wraps proxy so both rewrites and auth run together.
// /@username paths are rewritten to /username, then auth protection is applied.
export default clerkMiddleware(async (auth, request: NextRequest) => {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/@')) {
    // Run auth check on the rewritten path before issuing the rewrite
    const withoutLeadingSlash = pathname.slice(1)
    const withoutAt = withoutLeadingSlash.slice(1)
    const rewrittenUrl = new URL(`/${withoutAt}`, request.url)

    // Build a synthetic request with the rewritten pathname for route matching
    const rewrittenRequest = new NextRequest(rewrittenUrl, request)
    if (!isPublicRoute(rewrittenRequest)) {
      await auth.protect()
    }

    return NextResponse.rewrite(rewrittenUrl)
  }

  if (!isPublicRoute(request)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    '/@:path*',
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
