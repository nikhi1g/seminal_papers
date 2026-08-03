# Seminal Papers

A searchable archive of notable papers, essays, memos, decks, reports, and other influential writing.

The archive is published at [nikhi1g.github.io/seminal_papers](https://nikhi1g.github.io/seminal_papers/) and accepts additions through its GitHub issue submission flow.

## Development

Build the deployable site locally:

```sh
node .github/scripts/build-site.mjs _site
```

The generated `_site` directory contains the archive, approved submissions, and commit metadata used by GitHub Pages.

## Metadata API

The submission form calls a Cloudflare Worker that reads public source context and uses Cerebras structured outputs to populate reviewable metadata. The Cerebras key is stored only as an encrypted Worker secret.

```sh
npm install
npx wrangler secret put CEREBRAS_API_KEY
npm run worker:deploy
```

For local Worker development, create an ignored `.dev.vars` file containing `CEREBRAS_API_KEY`, then run `npm run worker:dev`. Never commit either API token.
