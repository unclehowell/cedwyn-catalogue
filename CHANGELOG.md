# Changelog

## 0.3.0 — 2026-11-06
- The catalogue list is now a minimal search page: one centred search box with tabs beneath it — All · Web · Images · Videos · Blog · Books — each tab showing its own count for the current search.
- Every result carries a preview image (lazy-loaded; a small icon stands in when no picture exists or an image fails to load). Images opens as a picture grid.
- Web: archived website captures and archived PDFs. Images: image, photo, map and artifact records plus the artist reconstruction sketches. Videos: the documentary and published YouTube films. Blog: Cedwyn blog posts. Books: the e-books and quoted book findings. Records that fit no single type appear under All.
- `sources.json` is a display and classification map only (which tab a record appears in, and the outside items listed beside the catalogue). Catalogue records are still read live and are never edited here; records added later are placed by the same rules.
- URL keeps `?q=` and `sort=` and adds `&tab=` (all, web, images, videos, blog, books). `?id=` record pages are unchanged, with a link back to the search you came from.
- Light and dark themes follow the device; layout checked at 390 px wide.

## 0.2.1
- Earlier releases: live catalogue list, record pages with artifact, transcript and interpretation sections.
