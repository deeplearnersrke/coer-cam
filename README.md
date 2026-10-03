# D-Cam 📸📍

**Tagline:** Capture • GeoTag • Document

A 100% static, client-side Progressive Web Application (PWA) customized for schools, colleges, universities, government inspections, infrastructure documentation, and field events.

---

## ✨ Features

- **100% Offline & Client-Side**: No backend, server database, or API keys required. Operates completely inside the browser using IndexedDB.
- **HTML5 Camera Module**: Live camera preview with front/rear device toggling, torch/flash support, synthesized shutter sound feedback, and live GPS/clock overlays.
- **Canvas Stamp Engine**: Generates high-resolution stamped photos featuring 5 customizable stamp styles (*GPS Classic*, *Government Inspection*, *Modern Glass*, *Minimal*, *School Branding*). Automatically hides empty fields!
- **Satellite GPS & Reverse Geocoding**: Captures Latitude, Longitude, Altitude, Accuracy, and Compass Heading. Automatically reverse geocodes addresses when online, and operates silently in offline mode without blocking photo capture.
- **IndexedDB Photo Storage**: Securely stores high-res original and stamped photos locally using Dexie.js.
- **Interactive GIS Map**: Plots photo pins on an interactive Leaflet OpenStreetMap view with thumbnail preview cards.
- **Comprehensive Reports Export**:
  - **PDF Reports**: Official inspection documentation with school header, photo table, GPS specs & signature block.
  - **CSV Metadata**: Downloadable spreadsheet with full photo telemetry.
  - **ZIP Archives**: Compressed photo packages.
- **PWA Ready**: Installable on iOS/Android home screens with Service Worker offline caching and GitHub Pages SPA route support (`404.html`).

---

## 🚀 GitHub Pages Deployment

To deploy this app directly to GitHub Pages:

1. Push your repository to GitHub.
2. Go to **Settings > Pages**.
3. Select `gh-pages` branch or configure GitHub Actions build for Vite (`dist/` output).
4. Access your live app at `https://<your-username>.github.io/<repository-name>/`.
