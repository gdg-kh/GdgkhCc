# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static website for "DevFest Kaohsiung X S. TW Communities Gathering 2025" - a tech conference event. The site is built with vanilla HTML, CSS, and JavaScript without any build system or package manager, featuring a modern dynamic content management system.

**Base URL**: `gdgkh.cc` - All URLs and links should use this canonical domain.

**IMPORTANT**: The site uses a **year-based directory structure**. Each year's content is organized in its own subdirectory (e.g., `/2025/`, `/2026/`). The root `index.html` automatically redirects to the current year's site.

## Project Structure

```
/
├── index.html                    # Root redirect page (auto-redirects to /2025/)
├── CNAME                         # Domain configuration for GitHub Pages
├── 2025/                         # 2025 年活動網站目錄
│   ├── index.html                # Main HTML file with all page content
│   ├── json-editor.html          # Visual JSON content editor
│   ├── og-image-generator.html   # OG image creator tool
│   ├── css/
│   │   └── style.css            # All styles, Material 3 design system
│   ├── js/
│   │   ├── main.js              # Core JavaScript with i18n and navigation
│   │   └── dynamic-content.js   # Dynamic content management system
│   ├── data/                    # JSON data files for dynamic content
│   │   ├── speakers.json        # Speaker information
│   │   ├── twm.json             # Tech creation market booths
│   │   ├── thanks.json          # Thanks list information
│   │   ├── community.json       # Community participants
│   │   ├── staff.json           # Staff and volunteer information
│   │   ├── about.json           # About us information
│   │   └── carousel.json        # Homepage carousel slides
│   ├── images/                  # Event images and assets
│   ├── share/                   # Generated pages directory (organized by type)
│   │   ├── speakers/            # Individual speaker pages with OG meta tags
│   │   ├── thanks/              # Individual thanks list pages with OG meta tags
│   │   ├── community/           # Individual community pages with OG meta tags
│   │   ├── staff/               # Individual staff pages with OG meta tags
│   │   ├── twm/                 # Individual tech creation market booth pages with OG meta tags
│   │   └── about/               # Individual about pages with OG meta tags
│   ├── generate-*.js            # Node.js scripts for generating individual pages
│   ├── *-template.html          # HTML templates for generated pages
│   └── favicon.svg              # Site favicon
├── 2026/                         # (Future) 2026 年活動網站目錄
├── package.json                  # NPM dependencies (shared across all years)
├── eslint.config.js              # ESLint configuration (shared)
└── README-DYNAMIC-CONTENT.md     # Dynamic content system documentation
```

### Year-Based Architecture

- **Root Directory**: Contains only the redirect `index.html` and configuration files
- **Year Subdirectories** (e.g., `/2025/`): Each contains a complete, self-contained website
- **URL Structure**:
  - Root: `https://gdgkh.cc/` → Auto-redirects to current year
  - Current Year: `https://gdgkh.cc/2025/`
  - Generated Pages: `https://gdgkh.cc/2025/share/speakers/speaker-id/`
- **For Next Year**: Copy the current year's directory (e.g., `/2025/`) to `/2026/`, update content, and modify the root `index.html` redirect target

## Development Commands

This is a static website with no build system. Development workflow:

```bash
# IMPORTANT: Always work from within the year directory (e.g., 2025/)
cd 2025

# Serve the site locally (required for JSON loading due to CORS)
python -m http.server 8000
# or
npm run serve
# or
npx serve .

# Then open http://localhost:8000 in your browser
# To test the root redirect: http://localhost:8000/../
```

**Code Quality Commands**:

```bash
# Lint JavaScript and HTML files
npm run lint

# Lint and auto-fix issues
npm run lint:fix

# Format all code (HTML, CSS, JS, JSON, MD)
npm run format

# Check formatting without modifying files
npm run format:check
```

**Page Generation Commands** (creates individual pages for SEO and social sharing):

```bash
# IMPORTANT: Run these commands from the year directory (e.g., cd 2025)
cd 2025

# Generate individual speaker pages with dynamic OG meta tags
node generate-speaker-pages.js

# Generate OG images for speakers (opens browser tool)
node generate-og-images.js

# Generate individual thanks list pages
node generate-thanks-pages.js

# Generate OG images for thanks list
node generate-thanks-og-images.js

# Generate individual community pages
node generate-community-pages.js

# Generate individual staff pages
node generate-staff-pages.js

# Generate individual tech creation market booth pages
node generate-twm-pages.js

# Generate individual about pages
node generate-about-pages.js

# You can also use npm scripts from the root directory:
# npm run generate:speakers (runs: cd 2025 && node generate-speaker-pages.js)
```

**Important**:

- Due to CORS restrictions, you must use a local server to test the dynamic content features. Opening `index.html` directly in a browser will not load the JSON data files.
- ESLint is configured with Prettier integration - run `npm run lint:fix` and `npm run format` before committing changes.
- **NEVER manually edit generated pages**: Files in `2025/share/speakers/`, `2025/share/thanks/`, `2025/share/community/`, `2025/share/staff/`, `2025/share/twm/`, and `2025/share/about/` directories are auto-generated from templates and JSON data. Any manual edits will be overwritten. Always edit the source JSON files in `2025/data/` and the template files (`2025/*-template.html`), then regenerate using the appropriate generation script.

## Architecture

### Core Architecture

- **Single Page Application (SPA)**: JavaScript-based page switching using `data-page` attributes
- **Multi-language Support**: Built-in i18n system with Traditional Chinese (zh-Hant), English, and Japanese
- **Material Design 3**: Uses Google's Material Web Components and expressive color system
- **Responsive Design**: Mobile-first approach with hamburger navigation
- **Dynamic Content Management**: JSON-based content system for speakers, thanks list, and other dynamic data
- **Static Page Generation**: Node.js scripts generate individual pages from templates for SEO optimization

### Key Systems

1. **Navigation System** (`js/main.js:400+`):
   - Page switching via `data-page` attributes without actual navigation
   - Mobile hamburger menu with overlay
   - Active state management across pages

2. **Internationalization System** (`js/main.js:1-200`):
   - Translation objects with nested language keys
   - Dynamic text replacement using `data-i18n-key` attributes
   - Language switcher with localStorage persistence
   - Support for zh-Hant, en, and ja languages
   - **Important**: Language codes differ between `main.js` (uses `zh-Hant`) and JSON files (uses `zh`)

3. **Dynamic Content Management** (`js/dynamic-content.js`):
   - `DynamicContentManager` class handles all dynamic content
   - JSON-based data loading from `/data` directory
   - Multi-language content support in JSON files
   - Automatic rendering of speakers, thanks list, community booths, etc.
   - Content validation and error handling

4. **Static Page Generation System** (`generate-*.js` scripts):
   - Node.js scripts read JSON data and generate individual HTML pages
   - Each page uses a template (`*-template.html`) that dynamically loads its data
   - Pages include proper Open Graph meta tags for social sharing
   - OG images can be generated using browser-based canvas tools
   - Generated pages provide SEO benefits and shareable URLs

5. **Event Information Structure**:
   - Multi-day schedule with track-based organization
   - Speaker cards with expandable bio sections organized by category
   - Five speaker categories with distinct colors (see `js/dynamic-content.js:221-252`)
   - Thanks list tier system with partner and company types
   - Tech creation market booth displays

### Content Management Architecture

The site features two content management approaches:

**Static Content** (`js/main.js`):

- Navigation labels, event metadata, static page content
- Managed via `translations` object with language keys

**Dynamic Content** (`data/*.json` + `js/dynamic-content.js`):

- Speakers, thanks list, community participants, staff
- JSON files with multi-language objects
- Dynamically loaded and rendered
- Structured data format with validation

## Git Workflow

**Main Branch**: `master`

**Branch Naming Conventions**:

- Feature branches: `feature/description`
- Hotfix branches: `hotfix/description`
- Development branch: `develop` (for staging changes before merge to master)

**Important Git Considerations**:

- Generated files in `share/` directories should be committed after regeneration
- Always run `npm run generate:all` after updating JSON data files before committing
- Run `npm run lint:fix` and `npm run format` before creating commits
- When updating content, commit both the source JSON files and the regenerated pages together

**Typical Workflow**:

1. Create feature/hotfix branch from `master` or `develop`
2. Make changes to source files (JSON data, templates, or core code)
3. If JSON data changed, run `npm run generate:all`
4. Run `npm run lint:fix` and `npm run format`
5. Commit both source changes and generated files
6. Merge to `develop` for testing, then to `master` for production

## CSS Architecture

The CSS follows Material 3 design principles:

- **Color System**: Expressive Material 3 colors with CSS custom properties
- **Google Fonts**: Roboto font family integration
- **Responsive Design**: Mobile-first breakpoints and flexible layouts
- **Material Components**: Integration with Material Web Components
- **Custom Properties**: Extensive use of CSS variables for theming

Key color system variables:

- Core colors: `--color-blue`, `--color-green`, `--color-yellow`, `--color-red`
- Material 3 tokens: `--md-sys-color-primary`, `--md-sys-color-secondary`, etc.

## JavaScript Architecture

- **Pure ES6**: No frameworks or build tools required
- **Class-based**: `DynamicContentManager` class for content management
- **Promise-based**: Async/await for JSON loading
- **Event-driven**: Event listeners for user interactions
- **Modular structure**: Separate concerns between static and dynamic content
- **Error handling**: Comprehensive error handling for JSON loading and rendering

### Critical Functions

- `DynamicContentManager.loadAllData()`: Loads all JSON data files (`js/dynamic-content.js:36`)
- `DynamicContentManager.renderSpeakers()`: Renders speaker cards (`js/dynamic-content.js:214`)
- `DynamicContentManager.enhanceScheduleWithSpeakers()`: Links schedule to speaker data (`js/dynamic-content.js:790`)
- `DynamicContentManager.initHashNavigation()`: Enables URL hash-based navigation to specific items (`js/dynamic-content.js:1068`)
- `setLanguage()`: Updates language and re-renders content
- Navigation event handlers for page switching

### Page Generation Scripts

Each `generate-*.js` script follows a similar pattern:

1. Reads JSON data from `data/*.json`
2. Creates a directory for each item (e.g., `share/speakers/speaker-id/`)
3. Copies the template file (`*-template.html`) as `index.html` in each directory
4. Templates dynamically load data from JSON files at runtime
5. Some scripts also generate OG image creator tools

## Code Quality

The project uses ESLint and Prettier for code quality:

- **ESLint Config** (`eslint.config.js`): Flat config format with browser globals
- **HTML Linting**: ESLint plugin for inline JavaScript in HTML files
- **Prettier Integration**: Ensures consistent formatting across all file types
- **Key ESLint Rules**:
  - No `var` declarations (use `const`/`let`)
  - Prefer template literals over string concatenation
  - Arrow functions preferred for callbacks
  - No unused variables (except those prefixed with `_`)
  - Console statements limited to `warn` and `error`

## Content Management

### Static Content

- Navigation labels and static text in `translations` object (`js/main.js`)
- Event schedules and metadata hardcoded in translations

### Dynamic Content

- **Speakers**: `data/speakers.json` - Speaker profiles with sessions and bios
- **Thanks**: `data/thanks.json` - Thanks list information with tiers
- **Community**: `data/community.json` - Participating community groups
- **Staff**: `data/staff.json` - Volunteer and staff information
- **TWM (Tech Creation Market)**: `data/twm.json` - Tech creation market booth information
- **About**: `data/about.json` - About us and organization information
- **Carousel**: `data/carousel.json` - Homepage carousel slides

Each JSON file follows a structured format with multi-language support. See `README-DYNAMIC-CONTENT.md` for detailed format specifications.

### JSON Editor Tool

The project includes a visual JSON editor (`json-editor.html`) for non-technical content management:

- Access at `http://localhost:8000/json-editor.html` (requires local server)
- Provides tabbed interface for editing all content types
- Supports file upload for existing JSON data
- Generates downloadable JSON files
- No technical knowledge required for content updates

## Data File Structure

All JSON files follow this pattern:

```json
{
  "dataType": [
    {
      "id": "unique-identifier",
      "field": {
        "zh": "Traditional Chinese text",
        "en": "English text",
        "ja": "Japanese text"
      }
    }
  ]
}
```

Required fields vary by content type but all support multi-language text objects.

## Key Features

### Schedule Enhancement System

The system automatically enhances the event schedule with speaker information (`js/dynamic-content.js:790+`):

- Links schedule items to speaker data via `schedule.session_id` field in speaker JSON
- Displays speaker photo, name, and organization inline in schedule
- Shows session tags and expandable abstract
- Clickable schedule items navigate to full speaker details
- Mobile: Click to expand/collapse; Desktop: Click to navigate to speaker page

### URL Hash Navigation

Supports direct linking to specific content items (`js/dynamic-content.js:1026+`):

- Format: `#speaker-id`, `#booth-id`, `#thanks-id`, etc.
- Automatically switches to correct page and scrolls to item
- Highlights the target item briefly for user feedback

### Static Page Generation for SEO

Individual pages are generated for each content item to improve SEO and social sharing:

- Each item gets its own URL (e.g., `/share/speakers/speaker-id/`)
- Pages include proper meta tags for social media preview
- OG images can be generated using browser-based tools
- Templates dynamically load data from JSON files, ensuring consistency with main site

## Common Development Tasks

### Adding New Speakers

1. Edit `2025/data/speakers.json`
2. Add speaker photo to `2025/images/` directory
3. Assign `topic_category` to one of the five predefined categories:
   - "Gemini AI 的生成式實踐" (Gemini AI in Practice) - Blue
   - "Google Cloud 的雲端實踐" (Google Cloud in Practice) - Green
   - "科技向善的實踐之路" (Goodness in Practice) - Yellow
   - "中午說書人" (Midday Storyteller) - Red
   - "第二屆 AI 生成大賽" (The 2nd AI Generative Contest) - Black
4. If linking to schedule, add `schedule.session_id` field matching the schedule item's `data-i18n-key`
5. Follow the JSON schema in `README-DYNAMIC-CONTENT.md`
6. Run `cd 2025 && node generate-speaker-pages.js` to create individual speaker pages
7. Optionally generate OG images with `cd 2025 && node generate-og-images.js`

### Adding New Thanks List Items

1. Edit `2025/data/thanks.json`
2. Add logo to `2025/images/` directory
3. Specify `type` (company/partner) and `category` for proper styling
4. Run `cd 2025 && node generate-thanks-pages.js` to create individual thanks pages

### Modifying Event Schedule

- Edit the schedule translations in `2025/js/main.js`
- To link a speaker to a schedule item, ensure the speaker's `schedule.session_id` matches the schedule's `data-i18n-key`
- Schedule items with matching speakers will automatically display speaker info and become clickable

### Multi-language Content

- All new content must include zh, en, and ja language variants (zh-Hant in `main.js`, zh in JSON files)
- Use the `DynamicContentManager.getText()` method for consistent language handling
- Language codes: `zh-Hant` (Traditional Chinese), `en` (English), `ja` (Japanese)
- In JSON files, use `zh`, `en`, `ja` as keys

### Regenerating Pages After Content Changes

After editing JSON files, regenerate the individual pages:

```bash
# Change to the year directory
cd 2025

# Regenerate specific content type
node generate-speaker-pages.js

# Or regenerate everything by running all generation scripts
node generate-speaker-pages.js && \
node generate-thanks-pages.js && \
node generate-community-pages.js && \
node generate-staff-pages.js && \
node generate-twm-pages.js && \
node generate-about-pages.js
```

This ensures that the individual pages stay in sync with the main site data.

### Preparing for Next Year's Event

When it's time to create next year's website (e.g., 2026):

1. **Copy the Current Year's Directory**:

   ```bash
   # Copy the entire 2025 directory to 2026
   cp -r 2025 2026
   ```

2. **Update Content in the New Directory**:
   - Edit `2026/data/*.json` files with new event data
   - Replace images in `2026/images/` as needed
   - Update event details in `2026/js/main.js`
   - Update the year references in `2026/index.html`

3. **Update Open Graph URLs** (if needed):
   - Update baseUrl in all `2026/generate-*.js` scripts from `/2025` to `/2026`
   - Update meta tags in `2026/index.html` if needed

4. **Update Root Redirect**:
   - Edit the root `index.html` file
   - Change the redirect URL from `/2025/` to `/2026/`:
     ```javascript
     window.location.href = '/2026/';
     ```
   - Update the backup link as well

5. **Regenerate All Pages**:

   ```bash
   cd 2026
   node generate-speaker-pages.js && \
   node generate-thanks-pages.js && \
   node generate-community-pages.js && \
   node generate-staff-pages.js && \
   node generate-twm-pages.js && \
   node generate-about-pages.js
   ```

6. **Test Everything**:
   - Test the root redirect: `http://localhost:8000/` → should redirect to `/2026/`
   - Test the main site: `http://localhost:8000/2026/`
   - Verify all dynamic content loads correctly
   - Check generated pages: `http://localhost:8000/2026/share/speakers/...`

7. **Commit and Deploy**:
   - The 2025 site will remain accessible at `https://gdgkh.cc/2025/`
   - The new 2026 site will be at `https://gdgkh.cc/2026/`
   - Root domain will automatically redirect to the latest year
