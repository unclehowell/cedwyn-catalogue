# Catalogue Search Gateway

This lightweight webapp is the public catalogue-search front door for legacy BucklerFamily estate hostnames. It deliberately resembles the catalogue search page, but it does not store or fabricate catalogue records.

- Search requests are handed to the live canonical catalogue: https://bucklerfamily.estate/catalogue/
- Query parameters `q`, `kind`, `sort`, `id`, `src` and `tab` are preserved.
- Actual results are rendered by the existing catalogue application from the live record service.
- The Cloudflare Worker source is `worker.js`; it serves this page from the raw file in this repository.
- Root `@`, `www` and every `*-datro` hostname are excluded from the public gateway behaviour.

The connected GitHub integration does not expose repository creation, and Cloudflare refused another Pages project because the account has reached its Pages-project quota. Accordingly, this webapp is a dedicated `webapp/catalogue-search/` directory in `unclehowell/cedwyn-catalogue`, deployed by the dedicated Worker `bfe-catalogue-frontdoor` rather than a new Pages project or a separately created GitHub repository.
