This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.


## Authorized video sources for clip processing

VOD processing uses the direct HTTPS media URL saved in the VOD's `vodUrl` field. It does not download Twitch VODs through private playback GraphQL endpoints. Configure `VIDEO_SOURCE_ALLOWED_HOSTS` as a comma-separated list of exact hostnames that serve media files you are authorized to process (for example, your own object-storage or CDN hostname). The source URL host must match one of these entries exactly. Do not add Twitch watch-page hosts or arbitrary domains. A normal Twitch VOD page URL is not a direct media URL.

Historical Twitch VOD chat replay is not retrieved from third-party services or the retired v5 API. When no chat messages are available, analysis completes with zero automatically detected highlights; it does not invent timestamps. Prospective live chat collection can be implemented separately through Twitch EventSub.
