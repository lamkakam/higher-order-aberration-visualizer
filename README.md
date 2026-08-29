# Higher-Order Aberration Simulator

A front-end-only browser app for visualizing how higher-order aberrations (HOAs) affect simulated images. All optics computation runs locally in the browser through Pyodide and a Web Worker. No backend service is required. Initial loading can take a moment while the Web Worker for Pyodide initializes. The optics computation uses [prysm 0.21.1](https://github.com/brandondube/prysm).

**Live Demo:** [https://lamkakam.github.io/higher-order-aberration-visualizer/](https://lamkakam.github.io/higher-order-aberration-visualizer/)

## Disclaimer

This simulator is provided for educational and informational use only. It is **not** medical advice, diagnosis, treatment, or a substitute for a qualified eye-care professional. **Use the results at your own risk.**

## Features

- Visualize image degradation from lower- and higher-order optical aberrations (Zernike coefficients).
- Set aperture (entrance pupil) diameter, target type, and aberration coefficients interactively.
- Currently three languages are supported: English, Traditional Chinese and Simplified Chinese.
- Use Basic mode for a simplified workflow or Advanced mode for more optical controls.
- Compare simulated target images, point spread functions, and wavefront maps.
- Explore monochromatic and polychromatic simulations.
- Configure aperture masks with a circular, square, or regular hexagonal pupil, central obstruction, spider vanes, and Gaussian apodization.

## Basic Mode Usage

1. Open the app in a browser.
2. Select an optical target. For simulating human eyes, you may choose Eye Chart (first 6 lines) or the Snellen Chart letter E (on the line of 20/20). For better illustation of higher order aberrations, you may choose the reverse contrast version (bright texts over dark background) of those two targets.
3. Set aperture diameter and Zernike aberration coefficients.
4. Review the simulated image.

## Advanced Mode Usage

1. Open the app in a browser.
2. Click Settings and choose Advanced in Display.
3. Select an optical target.
4. Set aperture diameter and optional aperture mask (entrance pupil shape, central obstruction, spider vanes, Gaussian apodization standard deviation).
5. Choose monochromatic (550nm) or polychromatic mode with 3 colours, namely green (550nm), red (656nm) and blue (486nm)
6. Set Zernike aberration coefficients. For polychromatic mode, you may set Zernike coefficients separately for each wavelength with **Sync wavelengths** off. If you would like to have some of the coefficients applied to all wavelengths, switch on **Sync wavelengths**.
7. Review the simulated image, point spread function (PSF) and wavefront map.


## Development Setup

Install dependencies:

```sh
npm ci
```

Run the local Vite dev server:

```sh
npm run dev
```

Build the production bundle:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

Run checks and tests:

```sh
npm run typecheck
npm run lint
npm test
npm run e2e
```

The `dev` and `build` scripts automatically build the app's internal Python wheel for Pyodide before starting Vite or producing the production bundle.

## Deployment

Pushes to `main` run all quality gates, build with the base path `/higher-order-aberration-visualizer/`, and deploy `dist` unchanged to the existing GitHub Pages site. They do not deploy Cloudflare Pages. Pushing a tag that matches `v*` runs the release workflow and promotes that exact tagged commit to Cloudflare, regardless of which branch contains the commit. Pull requests and manual workflow runs do not deploy Cloudflare.

The release workflow first keeps the root-based Vite build used for the GitHub Release ZIP, then rebuilds with the static subpath. For Cloudflare Pages, `npm run prepare:cloudflare` creates a separate `cloudflare-pages` upload directory whose layout is:

```text
cloudflare-pages/
├── _headers
├── _redirects
└── higher-order-aberration-visualizer/
    ├── index.html
    ├── 404.html
    ├── assets/
    ├── locales/
    ├── pyodide/
    └── sw.js
```

This physical nesting matches the Vite base path, including the locale, service-worker, and Pyodide wheel URLs. Cloudflare Pages reads the root `_redirects` file to redirect `/` to `/higher-order-aberration-visualizer/` with status 302. Its root `_headers` file applies the app's cross-origin and permissions policies throughout the application subpath.

The Cloudflare deployment job uses these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Create a custom Cloudflare API token restricted to the target account with only `Account` → `Cloudflare Pages` → `Edit`. DNS permissions are not needed by the deployment workflow because custom-domain and DNS setup are one-time external operations.

One-time Cloudflare setup:

1. Ensure the `vestibulum.xyz` zone is active in the intended Cloudflare account.
2. Create a Direct Upload Pages project named `higher-order-aberration-visualizer` with production branch `main`. With Wrangler authenticated outside this repository, the recommended explicit command is `npx wrangler pages project create higher-order-aberration-visualizer --production-branch=main`. If the project is instead created through Workers & Pages → Create application → Pages → Direct Upload, note that Cloudflare currently does not expose production-branch controls for Direct Upload projects in the dashboard; use the Pages Update Project API to set `production_branch` to `main` before CI deploys.
3. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository or `cloudflare-pages` environment secrets in GitHub Actions.
4. Allow the first `v*` tag workflow to deploy, then open the Pages project in Cloudflare and add `vestibulum.xyz` under Custom domains. Complete Cloudflare's ownership validation if prompted.
5. Optionally create a GitHub Actions environment named `cloudflare-pages`, set its deployment URL to `https://vestibulum.xyz/higher-order-aberration-visualizer/`, and add any desired protection rules. The workflow already targets that environment name and URL.

This design assumes the Pages project owns the entire `vestibulum.xyz` hostname. If `vestibulum.xyz` must serve a different origin or application outside `/higher-order-aberration-visualizer/`, this hostname-dedicated Pages approach is not appropriate. That configuration needs separately designed edge routing, such as a Cloudflare Worker/router or eligible Cloudflare Origin Rules; do not silently adapt this deployment to share the hostname.

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/lamkakam/higher-order-aberration-visualizer/blob/main/LICENSE) file.
