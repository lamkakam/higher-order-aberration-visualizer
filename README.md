# Higher-Order Aberration Simulator

A front-end-only browser app for visualizing how higher-order aberrations (HOAs) affect simulated images. All optics computation runs locally in the browser through Pyodide and a Web Worker. No backend service is required. Initial loading can take a moment while the Web Worker for Pyodide initializes.

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

## License

This project is licensed under the MIT License. See the [LICENSE](https://github.com/lamkakam/higher-order-aberration-visualizer/blob/main/LICENSE) file.
