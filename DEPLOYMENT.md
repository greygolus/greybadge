# Vercel deployment

The production project is deployed from this repository with Vite.

## First-time link

```bash
npx vercel link --yes --project greybadge --scope greygolus
```

The generated `.vercel/` directory is intentionally ignored because it contains local project linkage metadata.

## Production deployment

```bash
npm test
npm run build
npx vercel deploy --prod --yes
```

Every push to the connected production branch can also create a deployment through Vercel’s Git integration.

## Web Analytics

The app imports `inject` from `@vercel/analytics`, and Vite bundles the supported analytics client during production builds. Web Analytics must also be enabled for the Vercel project from its Analytics page. After enabling it, redeploy so Vercel adds the project’s analytics routes.

Verify analytics by loading the production page and confirming that the analytics script is requested successfully. Visitor reports appear in the project’s **Analytics** tab after traffic is received.

## Rollback

List recent deployments and promote a known-good one:

```bash
npx vercel ls greybadge
npx vercel promote <deployment-url>
```
