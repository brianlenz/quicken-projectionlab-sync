# Quicken ProjectionLab Sync - Chrome Extension

A Chrome extension built with TypeScript for syncing Quicken data with ProjectionLab.

## Project Structure

```
quicken-projectionlab-sync/
├── src/
│   ├── content.ts       # Content script (runs on web pages)
│   └── popup.ts         # Popup UI logic
├── dist/                # Built files (generated)
├── manifest.json        # Chrome extension manifest
├── popup.html           # Popup UI
├── package.json         # Node dependencies
├── tsconfig.json        # TypeScript configuration
└── webpack.config.js    # Webpack build configuration
```

## Setup

This project uses **Yarn Modern (Berry)** with ESM modules.

1. **Enable Corepack (if not already enabled):**
   ```bash
   corepack enable
   ```

2. **Install dependencies:**
   ```bash
   yarn install
   ```

3. **Build the extension:**
   ```bash
   yarn build
   ```

   Or for development with auto-rebuild:
   ```bash
   yarn dev
   ```

4. **Load the extension in Chrome:**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `dist` folder from this project

## Development

- **Build for production:** `yarn build`
- **Build for development (watch mode):** `yarn dev`
- **Type checking:** `yarn type-check`

## Extension Components

### Content Script (`src/content.ts`)
- Runs on web pages matching the patterns in manifest.json
- Can access and modify the DOM

### Popup (`src/popup.ts` + `popup.html`)
- UI that appears when clicking the extension icon
- Can interact with the current tab

## Technology Stack

- **TypeScript** - Type-safe JavaScript
- **Yarn Modern (Berry 4.10.3)** - Fast, reliable package manager with node-modules linker
- **ESM Modules** - Modern JavaScript module system (`"type": "module"`)
- **Webpack 5** - Module bundler
- **Chrome Manifest V3** - Latest extension platform

## Resources

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/mv3/intro/)
- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Yarn Berry Documentation](https://yarnpkg.com/)
