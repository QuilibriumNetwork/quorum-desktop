# Docusaurus Setup & Implementation Task

**Created**: 2025-11-08
**Related**: See `docusaurus-blueprint-v2.md` for content strategy and structure
**GitHub Issue**: https://github.com/QuilibriumNetwork/quorum-desktop/issues/87

---

## Objective

Set up Docusaurus in the repository (`/docs` folder) with initial configuration, custom branding, and first content pages to create a developer-friendly documentation site.

---

## Environment Notes

**Package Manager**: This project uses **yarn**, not npm.

**WSL/Windows Setup**: If you're working on WSL with the repo on Windows filesystem (like `/mnt/d/`), commands need to be run via `cmd.exe`. See the root `CLAUDE.md` file for detailed WSL/Windows command patterns. The commands in this guide are written generically and should be adapted based on your environment.

---

## Table of Contents

1. [Branding & Design Requirements](#branding--design-requirements)
2. [Known Issues to Avoid](#known-issues-to-avoid)
3. [Implementation Phases](#implementation-phases)
4. [Technical Notes](#technical-notes)

---

## Branding & Design Requirements

### Colors
- **Brand/Accent Color**: `#0287f2` (Quorum blue)
- **Theme Support**: Both light and dark themes required
- Use brand color for:
  - Primary buttons and CTAs
  - Links and hover states
  - Active navigation items
  - Code highlights (accent)

### Typography
- **Headings**: AtAero font family (not in repo yet - to be added later)
  - Fallback to system fonts until AtAero is added
  - File location (future): `docs/static/fonts/AtAero/`
- **Body Text**: Inter font family
  - **Source**: `public/InterVariable.ttf` (already in repo)
  - **Action**: Copy to `docs/static/fonts/` for Docusaurus
  - Use variable font for optimal performance

### Homepage Design
- **Phase 1**: Use default Docusaurus homepage (functional, not "cool")
- **Phase 2** (Future): Create custom hero section with:
  - Eye-catching design
  - Developer-focused messaging
  - Quick start CTAs
  - Code examples or interactive demos
  - Links to key sections (Architecture, Quick Start, API Reference)
- **Inspiration**: Look at Algolia DocSearch, Dyte, Ionic, React Native docs

### Navigation & Footer Links
- **Navbar** (right side):
  - Website → https://www.quorummessenger.com/
  - App → https://app.quorummessenger.com/
  - GitHub → https://github.com/QuilibriumNetwork/quorum-desktop
- **Footer**:
  - Repeat nav links organized by sections
  - **Important**: Include Quilibrium Network link (https://quilibrium.com) in "Network" section
  - **Tagline**: "The world's first secure, peer-to-peer, E2EE group messenger."
  - **Context**: Mention "Built on the Quilibrium Network" to clarify relationship

---

## Known Issues to Avoid

### Critical Issues (Must Address)

**1. baseURL Misconfiguration** (Most Common Error)
- **Problem**: Incorrect `baseUrl` in `docusaurus.config.js` causes deployment failures
- **Solution**:
  - For root domain: `baseUrl: '/'`
  - For subdirectory (e.g., GitHub Pages): `baseUrl: '/quorum-desktop/'`
  - For subdomain: `baseUrl: '/'`
- **Test**: Always test build locally before deploying

**2. Build Failures with MDX**
- **Problem**: Empty preset errors, MDX parsing issues
- **Solution**:
  - Keep MDX syntax simple initially
  - Test builds frequently during content migration
  - Use `yarn build` to catch errors early

**3. Windows-Specific Issues**
- **Problem**: CSS cascade layers bug on Windows (fixed in v3.8.1+)
- **Solution**: Use Docusaurus v3.8.1 or later
- **Note**: We're on WSL/Windows, so test on both environments

**4. Custom Font Loading Issues**
- **Problem**: Fonts not loading in production builds
- **Solution**:
  - Use `woff2` format (best compression + browser support)
  - Place fonts in `static/fonts/` (not `src/`)
  - Use `@font-face` with proper paths
  - Preload fonts in `docusaurus.config.js` for performance

### Minor Issues (Be Aware)

**5. Cumulative Layout Shift (CLS) with Custom Fonts**
- **Problem**: Page layout shifts when custom fonts load
- **Solution**: Consider using `@fontsource/inter` package OR fontaine plugin
- **Monitoring**: Check Core Web Vitals after deployment

**6. Hot Reload Performance**
- **Problem**: Large docs sites can have slow hot reload
- **Solution**: Keep dev server running, close unused browser tabs
- **Note**: Docusaurus is fast, but React Native docs level = slower

---

## Implementation Phases

### Phase 1: Initial Setup & Configuration

**Goal**: Get Docusaurus running with basic configuration

#### 1.1 Installation
```bash
# From repo root
cd /mnt/d/GitHub/Quilibrium/quorum-desktop

# Install Docusaurus (latest stable version)
npx create-docusaurus@latest docs classic --typescript

# Or manual installation
cd docs
yarn add @docusaurus/core @docusaurus/preset-classic
```

#### 1.2 Folder Structure
```
docs/
├── docs/               # Markdown documentation files
│   ├── quick-start/
│   ├── core-concepts/
│   ├── architecture/
│   └── ...
├── src/
│   ├── components/     # Custom React components
│   ├── css/
│   │   └── custom.css  # Custom styles and CSS variables
│   └── pages/
│       └── index.tsx   # Homepage
├── static/
│   ├── img/           # Images, logos
│   └── fonts/         # Custom fonts
│       └── Inter/
│           └── InterVariable.woff2
├── docusaurus.config.ts
├── sidebars.ts
└── package.json
```

#### 1.3 Copy Fonts & Favicon
```bash
# Create directories
mkdir -p docs/static/fonts/Inter
mkdir -p docs/static/img

# Copy Inter font from public folder
cp public/InterVariable.ttf docs/static/fonts/Inter/

# Copy favicon (quorumicon-blue.svg is the source for all favicon variations)
cp public/quorumicon-blue.svg docs/static/img/favicon.svg

# Convert font to woff2 (optimal format)
# Use online converter or: yarn global add woff2
# woff2_compress docs/static/fonts/Inter/InterVariable.ttf
```

**Note**: Consider using `@fontsource/inter` package as alternative (easier, includes woff2)

#### 1.4 Basic docusaurus.config.ts
```typescript
import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Quorum Developer Docs',
  tagline: 'Build on the decentralized messenger platform',
  favicon: 'img/favicon.svg', // Using quorumicon-blue.svg copied from public/

  // CRITICAL: Set correct URL and baseUrl
  url: 'https://YOUR-DOMAIN.com', // Update this
  baseUrl: '/', // Update if deploying to subdirectory

  // GitHub pages deployment config (if using)
  organizationName: 'QuilibriumNetwork',
  projectName: 'quorum-desktop',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/QuilibriumNetwork/quorum-desktop/tree/main/docs/',
        },
        blog: false, // Disable blog for now
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    // SEO
    metadata: [
      {name: 'keywords', content: 'quorum, decentralized, messaging, developer, documentation, api'},
      {name: 'description', content: 'Developer documentation for Quorum - a decentralized messaging platform with end-to-end encryption'},
    ],

    // Navbar
    navbar: {
      title: 'Quorum',
      logo: {
        alt: 'Quorum Logo',
        src: 'img/logo.svg', // Or use Logo component (see Phase 2.2)
        // Note: srcDark not needed - Logo.tsx uses currentColor for automatic theme adaptation
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'tutorialSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://www.quorummessenger.com/',
          label: 'Website',
          position: 'right',
        },
        {
          href: 'https://app.quorummessenger.com/',
          label: 'App',
          position: 'right',
        },
        {
          href: 'https://github.com/QuilibriumNetwork/quorum-desktop',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },

    // Footer
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            {
              label: 'Quick Start',
              to: '/docs/quick-start/introduction',
            },
            {
              label: 'Architecture',
              to: '/docs/architecture/overview',
            },
            {
              label: 'API Reference',
              to: '/docs/api/overview',
            },
          ],
        },
        {
          title: 'Quorum',
          items: [
            {
              label: 'Website',
              href: 'https://www.quorummessenger.com/',
            },
            {
              label: 'Launch App',
              href: 'https://app.quorummessenger.com/',
            },
            {
              label: 'GitHub',
              href: 'https://github.com/QuilibriumNetwork/quorum-desktop',
            },
          ],
        },
        {
          title: 'Network',
          items: [
            {
              label: 'Quilibrium Network',
              href: 'https://quilibrium.com',
            },
          ],
        },
      ],
      copyright: `
        <div style="margin-top: 1rem;">
          <p style="margin-bottom: 0.5rem;">The world's first secure, peer-to-peer, E2EE group messenger.</p>
          <p style="margin-bottom: 0;">Built on the <a href="https://quilibrium.com" target="_blank" rel="noopener noreferrer">Quilibrium Network</a></p>
          <p style="margin-top: 0.5rem;">Copyright © ${new Date().getFullYear()} Quilibrium Network. Built with Docusaurus.</p>
        </div>
      `,
    },

    // Syntax highlighting theme
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'typescript', 'javascript', 'json', 'jsx', 'tsx'],
    },

    // Algolia search (configure later)
    // algolia: {
    //   appId: 'YOUR_APP_ID',
    //   apiKey: 'YOUR_API_KEY',
    //   indexName: 'YOUR_INDEX_NAME',
    // },

  } satisfies Preset.ThemeConfig,

  // Plugins
  plugins: [
    // Will add theme-mermaid, typedoc later
  ],

  // Markdown features
  markdown: {
    mermaid: true, // Enable after installing plugin
  },

  themes: [
    // '@docusaurus/theme-mermaid', // Add later
  ],
};

export default config;
```

### Phase 2: Branding & Styling

**Goal**: Apply Quorum brand colors, fonts, and light/dark themes

#### 2.1 Custom CSS (docs/src/css/custom.css)

```css
/**
 * Quorum Developer Documentation
 * Custom Styles
 */

/* ==========================================
   FONT SETUP
   ========================================== */

/* Inter Font (Body Text) - Local */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter/InterVariable.woff2') format('woff2-variations');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap;
}

/* AtAero Font (Headings) - To be added later */
/* @font-face {
  font-family: 'AtAero';
  src: url('/fonts/AtAero/AtAero-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}

@font-face {
  font-family: 'AtAero';
  src: url('/fonts/AtAero/AtAero-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
} */

/* ==========================================
   CSS VARIABLES - LIGHT THEME
   ========================================== */

:root {
  /* Brand Colors */
  --quorum-blue: #0287f2;
  --quorum-blue-dark: #0270cc;
  --quorum-blue-light: #3da3f5;

  /* Docusaurus Primary Color (Quorum Blue) */
  --ifm-color-primary: #0287f2;
  --ifm-color-primary-dark: #0279da;
  --ifm-color-primary-darker: #0272ce;
  --ifm-color-primary-darkest: #025ea9;
  --ifm-color-primary-light: #1d92f3;
  --ifm-color-primary-lighter: #2999f4;
  --ifm-color-primary-lightest: #4ea8f5;

  /* Typography */
  --ifm-font-family-base: 'Inter', system-ui, -apple-system, BlinkMacSystemFont,
    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

  /* Headings - Using Inter for now, will switch to AtAero later */
  --ifm-heading-font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont,
    'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;

  /* When AtAero is added, uncomment: */
  /* --ifm-heading-font-family: 'AtAero', var(--ifm-font-family-base); */

  --ifm-font-size-base: 16px;
  --ifm-line-height-base: 1.6;

  /* Heading sizes */
  --ifm-h1-font-size: 2.5rem;
  --ifm-h2-font-size: 2rem;
  --ifm-h3-font-size: 1.5rem;
  --ifm-h4-font-size: 1.25rem;
  --ifm-h5-font-size: 1rem;
  --ifm-h6-font-size: 0.875rem;

  /* Code blocks */
  --ifm-code-font-size: 0.9em;
  --docusaurus-highlighted-code-line-bg: rgba(2, 135, 242, 0.1);

  /* Spacing */
  --ifm-spacing-horizontal: 1.5rem;
  --ifm-navbar-height: 60px;

  /* Links */
  --ifm-link-color: var(--quorum-blue);
  --ifm-link-hover-color: var(--quorum-blue-dark);
}

/* ==========================================
   CSS VARIABLES - DARK THEME
   ========================================== */

[data-theme='dark'] {
  /* Adjust primary color for dark mode */
  --ifm-color-primary: #3da3f5;
  --ifm-color-primary-dark: #25f;
  --ifm-color-primary-darker: #1d92f3;
  --ifm-color-primary-darkest: #0f85e8;
  --ifm-color-primary-light: #5bb0f6;
  --ifm-color-primary-lighter: #67b5f7;
  --ifm-color-primary-lightest: #8ec7f9;

  /* Background colors */
  --ifm-background-color: #1a1a1a;
  --ifm-background-surface-color: #242424;

  /* Code blocks */
  --docusaurus-highlighted-code-line-bg: rgba(61, 163, 245, 0.15);

  /* Links */
  --ifm-link-color: var(--ifm-color-primary-light);
  --ifm-link-hover-color: var(--ifm-color-primary-lightest);
}

/* ==========================================
   CUSTOM COMPONENT STYLES
   ========================================== */

/* Hero section (for future custom homepage) */
.hero {
  background: linear-gradient(135deg, var(--quorum-blue) 0%, var(--quorum-blue-dark) 100%);
  color: white;
}

.hero__title {
  font-weight: 700;
}

.hero__subtitle {
  font-weight: 400;
  opacity: 0.9;
}

/* Buttons */
.button--primary {
  background-color: var(--quorum-blue);
  border-color: var(--quorum-blue);
}

.button--primary:hover {
  background-color: var(--quorum-blue-dark);
  border-color: var(--quorum-blue-dark);
}

/* Code blocks */
.prism-code {
  font-size: var(--ifm-code-font-size);
  border-radius: 8px;
}

/* Navbar */
.navbar {
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.navbar__logo {
  height: 32px;
}

/* Sidebar */
.menu__link--active {
  color: var(--quorum-blue);
  border-left: 3px solid var(--quorum-blue);
}

[data-theme='dark'] .menu__link--active {
  color: var(--ifm-color-primary-light);
  border-left-color: var(--ifm-color-primary-light);
}

/* Table of contents */
.table-of-contents__link--active {
  color: var(--quorum-blue);
  font-weight: 600;
}

[data-theme='dark'] .table-of-contents__link--active {
  color: var(--ifm-color-primary-light);
}

/* Admonitions (info boxes) */
.admonition {
  border-radius: 8px;
}

.admonition-note {
  border-left-color: var(--quorum-blue);
}

/* ==========================================
   RESPONSIVE ADJUSTMENTS
   ========================================== */

@media (max-width: 996px) {
  :root {
    --ifm-font-size-base: 15px;
  }

  .hero__title {
    font-size: 2rem;
  }
}

@media (max-width: 768px) {
  :root {
    --ifm-spacing-horizontal: 1rem;
  }
}

/* ==========================================
   ACCESSIBILITY IMPROVEMENTS
   ========================================== */

/* Focus states */
a:focus-visible,
button:focus-visible {
  outline: 2px solid var(--quorum-blue);
  outline-offset: 2px;
}

/* Smooth scrolling */
html {
  scroll-behavior: smooth;
}

/* Reduce motion for users who prefer it */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }

  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### 2.2 Logo Setup (Reuse Existing Logo Component)

The project already has a perfect logo component at `src/components/Logo.tsx` that we should reuse!

**Why it's perfect for Docusaurus:**
- ✅ Inline SVG React component
- ✅ Uses `currentColor` - automatically adapts to light/dark themes
- ✅ No separate SVG files needed
- ✅ Already optimized viewBox (694x132)

**Implementation approach:**

**Option A: Copy Logo Component to Docusaurus** (Recommended - Simplest)

```bash
# Copy the Logo component to Docusaurus src
mkdir -p docs/src/components
cp src/components/Logo.tsx docs/src/components/
```

Then create a custom navbar logo component by swizzling:

```bash
cd docs
yarn swizzle @docusaurus/theme-classic Logo -- --wrap
```

This creates `docs/src/theme/Logo/index.tsx`. Update it:

```typescript
import React from 'react';
import Logo from '@theme/Logo';
import { Logo as QuorumLogo } from '@site/src/components/Logo';
import useBaseUrl from '@docusaurus/useBaseUrl';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function LogoWrapper(props) {
  const {
    siteConfig: {title},
  } = useDocusaurusContext();

  return (
    <div className="navbar__logo">
      <QuorumLogo className="navbar__brand" style={{height: '32px', width: 'auto'}} />
    </div>
  );
}
```

**Option B: Export SVG from Component** (Alternative)

If you prefer static SVG files, extract the SVG from Logo.tsx:

```bash
# Create a script to export the SVG paths
# Save the SVG content from Logo.tsx to docs/static/img/logo.svg
```

Then update `docusaurus.config.ts`:
```typescript
navbar: {
  logo: {
    alt: 'Quorum Logo',
    src: 'img/logo.svg',
    // No srcDark needed - currentColor handles it!
  },
}
```

**Favicon: Reuse Existing Quorum Icon**

The project uses `public/quorumicon-blue.svg` as the source for all favicons (generated by `vite-plugin-favicons-inject` in web/vite.config.ts).

**Copy the existing favicon source:**
```bash
# Copy the source SVG to Docusaurus
cp public/quorumicon-blue.svg docs/static/img/favicon.svg
```

**Option A: Use Docusaurus favicon plugin** (Recommended - generates all sizes)
```bash
cd docs
yarn add @docusaurus/plugin-ideal-image
```

Then add to `docusaurus.config.ts`:
```typescript
themeConfig: {
  metadata: [
    {name: 'keywords', content: '...'},
  ],
  image: 'img/favicon.svg', // Open graph image
},
```

And update the `head` section:
```typescript
  favicon: 'img/favicon.svg',
```

**Option B: Convert to ICO manually** (If needed)
- Use the same favicon.svg
- Convert using: https://favicon.io/favicon-converter/
- Place result in `docs/static/img/favicon.ico`

**Note**: SVG favicons are supported by modern browsers and scale perfectly. ICO format is mainly for legacy browser support.

**Recommended**: Use Option A (copy component for logo, copy SVG for favicon) for consistency with the main app.

### Phase 3: Essential Plugins

**Goal**: Add plugins for diagrams, API docs, and search

#### 3.1 Mermaid Diagrams
```bash
cd docs
yarn add @docusaurus/theme-mermaid
```

Update `docusaurus.config.ts`:
```typescript
themes: ['@docusaurus/theme-mermaid'],
markdown: {
  mermaid: true,
},
```

#### 3.2 TypeDoc (API Documentation)
```bash
cd docs
yarn add docusaurus-plugin-typedoc typedoc
```

Update `docusaurus.config.ts`:
```typescript
plugins: [
  [
    'docusaurus-plugin-typedoc',
    {
      entryPoints: ['../src/services/*.ts', '../src/hooks/**/*.ts'],
      tsconfig: '../tsconfig.json',
      out: 'api',
      sidebar: {
        categoryLabel: 'API Reference',
        position: 10,
      },
    },
  ],
],
```

#### 3.3 Search

**Option A: Algolia DocSearch (Free for open source)**
1. Apply at https://docsearch.algolia.com/apply/
2. Wait for approval (usually a few days)
3. Add config to `docusaurus.config.ts`

**Option B: Local Search (Immediate)**
```bash
cd docs
yarn add @easyops-cn/docusaurus-search-local
```

Update `docusaurus.config.ts`:
```typescript
themes: [
  '@docusaurus/theme-mermaid',
  [
    require.resolve("@easyops-cn/docusaurus-search-local"),
    {
      hashed: true,
      language: ["en"],
      highlightSearchTermsOnTargetPage: true,
      explicitSearchResultPath: true,
    },
  ],
],
```

**Recommendation**: Start with local search, migrate to Algolia when approved.

### Phase 4: First Content Pages

**Goal**: Create initial documentation structure and migrate first docs

---

## ⚠️ CRITICAL: Documentation Review Required

**All existing docs in `.agents/docs/` were created via LLM and MUST be carefully reviewed and updated before migration to Docusaurus.**

**Before migrating any doc:**
1. **Review against current codebase** - Verify all information is still accurate
2. **Test code examples** - Ensure all code snippets work
3. **Check for outdated info** - Code may have changed since doc was written
4. **Verify technical accuracy** - Don't assume LLM-generated content is correct
5. **Update or rewrite** - Fix any issues found during review

**Priority for manual review:**
- **High**: Architecture docs, security, cross-platform, primitives
- **Medium**: Message features, mobile, API reference
- **Low**: UI/UX features, styling guides

**DO NOT** blindly copy docs from `.agents/docs/` to Docusaurus without thorough review.

---

#### 4.1 Folder Structure
```
docs/docs/
├── intro.md                           # Landing page
├── quick-start/
│   ├── _category_.json
│   ├── introduction.md
│   ├── 5-minute-quickstart.md
│   ├── development-environment.md
│   ├── your-first-contribution.md
│   └── running-tests.md
├── core-concepts/
│   ├── _category_.json
│   ├── what-is-quorum.md
│   ├── architecture-overview.md
│   ├── decentralized-messaging.md
│   ├── privacy-encryption.md
│   ├── cross-platform-strategy.md
│   └── technology-stack.md
└── architecture/
    ├── _category_.json
    └── overview.md
```

#### 4.2 Create Category Files

**docs/docs/quick-start/_category_.json**
```json
{
  "label": "🚀 Quick Start",
  "position": 1,
  "link": {
    "type": "generated-index",
    "description": "Get started with Quorum development in minutes."
  }
}
```

**docs/docs/core-concepts/_category_.json**
```json
{
  "label": "💡 Core Concepts",
  "position": 2,
  "link": {
    "type": "generated-index",
    "description": "Understand the fundamental concepts behind Quorum."
  }
}
```

#### 4.3 Initial Content Migration

**⚠️ REMEMBER: Review and update ALL docs before copying (see warning above)**

**Priority 1: Quick Start (Week 1)**
- [ ] `intro.md` - Overview and navigation hub (create new)
- [ ] `quick-start/5-minute-quickstart.md` - Review README.md setup → adapt for docs
- [ ] `quick-start/development-environment.md` - Review README + CLAUDE.md → update
- [ ] `quick-start/running-tests.md` - Review tasks/test-suite-plan.md → verify current

**Priority 2: Core Concepts (Week 1-2)**
- [ ] `core-concepts/what-is-quorum.md` - Review README.md → rewrite for developers
- [ ] `core-concepts/architecture-overview.md` - Review cross-platform-repository-implementation.md → validate
- [ ] `core-concepts/cross-platform-strategy.md` - Review cross-platform-components-guide.md → test examples

**Priority 3: First Architecture Doc (Week 2)**
- [ ] `architecture/overview.md` - High-level system architecture (create new or review existing)

#### 4.4 Homepage (docs/src/pages/index.tsx)

**Phase 1 - Simple/Functional:**
```typescript
import React from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import styles from './index.module.css';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">{siteConfig.title}</h1>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/quick-start/introduction">
            Get Started - 5 min ⏱️
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  return (
    <Layout
      title={`Hello from ${siteConfig.title}`}
      description="Developer documentation for Quorum - decentralized messaging platform">
      <HomepageHeader />
      <main>
        {/* Add feature sections here in Phase 2 */}
      </main>
    </Layout>
  );
}
```

**Phase 2 - Cool/Custom (Future):**
- Add feature cards (Architecture, API Reference, Tutorials)
- Code examples
- Interactive demos
- Testimonials/community highlights
- Quick links to popular docs
- GitHub stars/contributors showcase

### Phase 5: Build & Testing

**Goal**: Verify everything works in development and production builds

#### 5.1 Development Server
```bash
cd docs
yarn start

# Or from repo root (if needed for your environment)
cd /mnt/d/GitHub/Quilibrium/quorum-desktop/docs
yarn start
```

**Test checklist:**
- [ ] Site loads at http://localhost:3000
- [ ] Light/dark theme toggle works
- [ ] Inter font loads correctly
- [ ] Quorum blue color appears correctly
- [ ] Navigation works
- [ ] Search works (if enabled)
- [ ] Code blocks syntax highlight correctly
- [ ] Responsive design on mobile viewport

#### 5.2 Production Build
```bash
cd docs
yarn build

# Test the build
yarn serve
```

**Build checklist:**
- [ ] Build completes without errors
- [ ] No broken links warnings
- [ ] Fonts load in production
- [ ] CSS minified correctly
- [ ] Bundle size reasonable (<5MB initial load)

**Common build issues:**
- Missing images → Add to `static/img/`
- Broken MDX → Simplify syntax
- Large bundle → Check for unnecessary imports
- Use `yarn build` to catch errors early

#### 5.3 Update package.json Scripts

Add to root `package.json`:
```json
{
  "scripts": {
    "docs:start": "cd docs && yarn start",
    "docs:build": "cd docs && yarn build",
    "docs:serve": "cd docs && yarn serve",
    "docs:clear": "cd docs && yarn clear"
  }
}
```

### Phase 6: CI/CD & Deployment

**Goal**: Automate builds and deploy docs site

#### 6.1 GitHub Actions Workflow

Create `.github/workflows/deploy-docs.yml`:
```yaml
name: Deploy Docusaurus

on:
  push:
    branches:
      - main
      - develop
    paths:
      - 'docs/**'
      - '.github/workflows/deploy-docs.yml'
  pull_request:
    paths:
      - 'docs/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'
          cache-dependency-path: docs/yarn.lock

      - name: Install dependencies
        run: |
          cd docs
          yarn install --frozen-lockfile

      - name: Build
        run: |
          cd docs
          yarn build
        env:
          NODE_ENV: production

      - name: Deploy to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./docs/build
          cname: docs.quorum.network  # Optional: custom domain
```

#### 6.2 Deployment Options

**Option A: GitHub Pages (Recommended for open source)**
- Free hosting
- Easy setup
- URL: `quilibriumnetwork.github.io/quorum-desktop/`
- Custom domain supported

**Option B: Netlify**
- Free tier generous
- Deploy previews for PRs
- Better performance than GitHub Pages
- Custom domain included

**Option C: Vercel**
- Free for open source
- Excellent performance
- Automatic preview deployments

**Recommendation**: Start with GitHub Pages (simplest), migrate to Netlify/Vercel if needed.

#### 6.3 GitHub Pages Setup
1. Go to repo Settings → Pages
2. Source: Deploy from a branch
3. Branch: `gh-pages` / `root`
4. Update `docusaurus.config.ts`:
```typescript
url: 'https://quilibriumnetwork.github.io',
baseUrl: '/quorum-desktop/',
organizationName: 'QuilibriumNetwork',
projectName: 'quorum-desktop',
```

### Phase 7: Documentation & Handoff

**Goal**: Document the setup for future maintainers

#### 7.1 Add docs/README.md
```markdown
# Quorum Developer Documentation

This folder contains the Docusaurus-powered developer documentation for Quorum.

## Development

```bash
yarn start       # Start dev server at localhost:3000
yarn build       # Build for production
yarn serve       # Preview production build
yarn clear       # Clear cache
```

## Project Structure

- `docs/` - Markdown documentation files
- `src/` - React components and custom pages
- `static/` - Static assets (images, fonts)
- `docusaurus.config.ts` - Site configuration
- `sidebars.ts` - Sidebar navigation structure

## Adding Documentation

1. Create `.md` or `.mdx` file in `docs/`
2. Add frontmatter (title, sidebar_position, etc.)
3. Update `sidebars.ts` if needed
4. Test locally with `yarn start`
5. Submit PR

## Branding

- **Primary Color**: #0287f2 (Quorum Blue)
- **Fonts**: Inter (body), AtAero (headings - when added)
- **Themes**: Light and dark modes supported

See `src/css/custom.css` for customization.

## Deployment

Docs are automatically deployed via GitHub Actions when changes are pushed to `main` branch.

- Production: https://quilibriumnetwork.github.io/quorum-desktop/
- Staging: https://quorum-docs-dev.netlify.app (if configured)
```

#### 7.2 Update Root README.md

Add section to main README:
```markdown
## Documentation

Developer documentation is available at [docs.quorum.network](https://quilibriumnetwork.github.io/quorum-desktop/)

To work on the documentation locally:

```bash
yarn docs:start
```

See [docs/README.md](./docs/README.md) for more information.
```

---

## Technical Notes

### Font Conversion Tools

**Convert TTF to WOFF2:**
- Online: https://cloudconvert.com/ttf-to-woff2
- CLI: `woff2_compress` (yarn: `yarn global add woff2`)
- Recommended: Use both WOFF2 (modern) and WOFF (fallback)

**Font loading best practices:**
```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/Inter/InterVariable.woff2') format('woff2'),
       url('/fonts/Inter/InterVariable.woff') format('woff');
  font-weight: 100 900;
  font-style: normal;
  font-display: swap; /* Prevent invisible text during load */
}
```

### Alternative: Using @fontsource

Instead of hosting Inter locally, can use yarn package:
```bash
yarn add @fontsource-variable/inter
```

In `docusaurus.config.ts`:
```typescript
stylesheets: [
  {
    href: '/fonts/inter-variable.css',
    type: 'text/css',
  },
],
```

**Pros**: Pre-optimized, includes all formats
**Cons**: Less control, external dependency

### Performance Optimization

**Image optimization:**
- Use WebP format for images
- Add alt text for accessibility
- Consider lazy loading for large images

**Code splitting:**
- Docusaurus handles automatically
- Keep custom components small

**Bundle analysis:**
```bash
yarn build --bundle-analyzer
```

### Testing Checklist

Before merging docs setup PR:
- [ ] Dev server runs without errors
- [ ] Production build succeeds
- [ ] All links work (no 404s)
- [ ] Fonts load correctly (check Network tab)
- [ ] Light/dark theme toggle works
- [ ] Mobile responsive (test in DevTools)
- [ ] Search works (if enabled)
- [ ] Mermaid diagrams render
- [ ] Code blocks highlight correctly
- [ ] Brand colors match Quorum blue (#0287f2)

---

## Future Enhancements

### Short Term (Next 2-4 weeks)
- [ ] Add AtAero font when available
- [ ] Create custom homepage (Phase 2 design)
- [ ] Migrate 5-10 docs from `.agents/docs/`
- [ ] Add code playground for examples
- [ ] Set up Algolia DocSearch (when approved)

### Medium Term (1-3 months)
- [ ] Complete content migration (all 36 docs)
- [ ] Add interactive API explorer
- [ ] Video tutorials embedding
- [ ] Versioning for major releases
- [ ] Internationalization (i18n) support
- [ ] OpenAPI integration for REST API docs

### Long Term (3-6 months)
- [ ] Community contributions section
- [ ] Live code examples with CodeSandbox
- [ ] Tutorial series with step-by-step guides
- [ ] FAQ section with search
- [ ] Changelog automation
- [ ] Performance monitoring (Core Web Vitals)

---

## Resources

### Official Docs
- [Docusaurus Documentation](https://docusaurus.io/docs)
- [Docusaurus Showcase](https://docusaurus.io/showcase)
- [Markdown Features](https://docusaurus.io/docs/markdown-features)

### Examples (Inspiration)
- [React Native Docs](https://reactnative.dev/)
- [Ionic Docs](https://ionicframework.com/docs)
- [Algolia DocSearch](https://docsearch.algolia.com/)
- [Hasura Docs](https://hasura.io/docs/)

### Tools
- [Font Converter](https://cloudconvert.com/ttf-to-woff2)
- [Algolia DocSearch Application](https://docsearch.algolia.com/apply/)
- [Mermaid Live Editor](https://mermaid.live/)

---

_Document created: 2025-11-08_
_Last updated: 2025-11-08 (Added critical review warning for doc migration)_
