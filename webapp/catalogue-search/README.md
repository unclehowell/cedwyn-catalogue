# Catalogue Search Gateway

A lightweight catalogue-styled front door for legacy BucklerFamily estate hostnames. It does not copy or fabricate catalogue records.

- Search requests go to the live canonical catalogue: https://bucklerfamily.estate/catalogue/
- Search query: `?q=...`
- Catalogue tabs: `?tab=all`, `web`, `images`, `videos`, `pdf`, `tbd`, `news`, `emails`, `books`, `blog`
- Sort values: `?sort=new` (newest added), `date-desc` (newest record date), `date` (oldest record date) and `id` (catalogue reference).
- Record pages use `?id=...`; archived source pages use `?src=...`.
- Actual results are rendered by the existing catalogue application from the live record service.
- `worker.js` is the source for Cloudflare Worker `bfe-catalogue-frontdoor`.
- The apex `@`, `www` and every `*-datro` hostname are excluded from front-door behaviour.

Cloudflare refused a new Pages project because the account has reached its Pages-project quota. The connected GitHub integration also does not expose repository creation. This app is a dedicated `webapp/catalogue-search/` directory in `unclehowell/cedwyn-catalogue`, served by its own Worker rather than a separate Pages project/repository.
