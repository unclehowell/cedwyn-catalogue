# Catalogue Search Gateway

A lightweight, deliberately catalogue-styled front door for legacy BucklerFamily estate hostnames. It does not copy or fabricate catalogue records. It passes a submitted query to the canonical, live catalogue:

- Canonical search: https://bucklerfamily.estate/catalogue/
- Query: `?q=...`
- Filters: `?kind=evidence`, `?kind=email`, `?sort=new`
- Record pages: `?id=EV-...`

The front-door Worker serves this Pages deployment on legacy hostnames, while preserving `www.bucklerfamily.estate` and all `*-datro.bucklerfamily.estate` hosts. Any submitted query redirects to the real catalogue with its query parameters intact.

This app is kept in `webapp/catalogue-search/` within `unclehowell/cedwyn-catalogue` because the connected GitHub tools do not provide repository creation. It is a separate Pages project / deploy target, not a separately-created GitHub repository.
