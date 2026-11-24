# Catalogue Search Gateway

A lightweight catalogue-styled front door for legacy BucklerFamily estate hostnames. It does not copy or fabricate catalogue records.

- Search requests go to the live canonical catalogue: https://bucklerfamily.estate/catalogue/
- Query parameters `q`, `kind`, `sort`, `id`, `src` and `tab` are preserved.
- Actual results are rendered by the existing catalogue application from the live record service.
- `worker.js` is the source for Cloudflare Worker `bfe-catalogue-frontdoor`.
- The apex `@`, `www` and every `*-datro` hostname are excluded from front-door behaviour.

Cloudflare refused a new Pages project because the account has reached its Pages-project quota. The connected GitHub integration also does not expose repository creation. This app is a dedicated `webapp/catalogue-search/` directory in `unclehowell/cedwyn-catalogue`, served by its own Worker rather than a separate Pages project/repository.
