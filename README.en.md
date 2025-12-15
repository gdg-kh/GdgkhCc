# DevFest Kaohsiung X S. TW Communities Gathering 2025 Official Website

This is the official website for the DevFest 2025 event, featuring a modern static website architecture with
multilingual support and dynamic content management.

**Languages**: [繁體中文](README.md) | **English** | [日本語](README.ja.md)

## 🌟 Project Features

- **Multilingual Support**: Traditional Chinese, English, and Japanese language switching
- **Responsive Design**: Material Design 3 system supporting all devices
- **Dynamic Content Management**: JSON-driven content management system
- **Visual Editor**: Built-in JSON editor for content management without programming skills
- **Zero Build Tools**: Pure HTML/CSS/JavaScript with no complex build process required

## 🏗️ Project Architecture

This project uses a **year-based directory structure**, with each year's event website managed independently:

```
/
├── index.html                    # Root redirect page (auto-redirects to current year)
├── CNAME                         # Domain configuration
├── 2025/                         # 2025 event website
│   ├── index.html                # Main website page
│   ├── json-editor.html          # JSON content management tool
│   ├── css/
│   │   └── style.css            # Stylesheet (Material 3 Design System)
│   ├── js/
│   │   ├── main.js              # Core functionality and internationalization
│   │   └── dynamic-content.js   # Dynamic content management system
│   ├── data/                    # JSON data files
│   │   ├── speakers.json        # Speaker information
│   │   ├── thanks.json          # Thanks list information
│   │   ├── community.json       # Community participants
│   │   ├── twm.json             # Tech Creation Market
│   │   ├── staff.json           # Staff information
│   │   └── about.json           # About us
│   ├── images/                  # Image resources
│   ├── share/                   # Generated static pages (SEO optimized)
│   └── favicon.svg              # Website icon
├── SantaCode2025/                # 2025 SantaCode Programmer's Event
│   ├── website/                  # Event landing page
│   ├── submissions/              # Participant submissions
│   └── core/                     # Verification and execution core
├── 2026/                         # (Future) 2026 event website
└── package.json                  # Project configuration (shared across years)
```

### Year and Project Architecture

- **Root Directory (`index.html`)**: Auto-redirects to the current year's website
- **Year Subdirectories (`/2025/`, `/2026/`, ...)**: Complete independent website for each year
- **SantaCode (`/SantaCode2025/`)**: Christmas special event with independent verification logic
- **URL Structure**:
  - Root domain: `https://gdgkh.cc` → Auto-redirects to latest year
  - Current year: `https://gdgkh.cc/2025/`
  - SantaCode: `https://gdgkh.cc/SantaCode2025/website/`
  - Static pages: `https://gdgkh.cc/2025/share/speakers/{id}/`

Benefits of this architecture:

- ✅ Each year's event is managed independently without interference
- ✅ Historical event websites remain permanently accessible
- ✅ Next year only requires copying the directory and updating content
- ✅ Root domain always points to the latest event

## 🚀 Quick Start

### Local Development

Due to browser CORS security restrictions, you must use a local server to properly load JSON data:

```bash
# Important: Enter the year directory first
cd 2025

# Method 1: Python built-in server
python -m http.server 8000

# Method 2: Node.js serve package
npx serve .

# Method 3: Other static file servers
# Such as Live Server (VS Code extension)
```

Then open your browser and visit `http://localhost:8000`

**Test root redirect**: Visit `http://localhost:8000/../` to test the auto-redirect functionality

## 📝 Content Management

### Using JSON Editor (json-editor.html)

This project provides a visual JSON editor that allows you to manage website content without programming skills.

#### Accessing the Editor

1. Start a local server (refer to the Quick Start steps above)
2. Open `http://localhost:8000/json-editor.html` in your browser

#### Editor Features

The editor provides six tabs corresponding to different content types:

##### 1. 📢 Speaker Management (Speakers)

- **Function**: Manage event speaker information
- **Data File**: `2025/data/speakers.json`
- **Supported Fields**:
  - Speaker name (trilingual)
  - Job title (trilingual)
  - Bio (trilingual)
  - Session information (trilingual)
  - Photo filename
  - Social links

##### 2. 🤝 Thanks List Management (Thanks)

- **Function**: Manage event thanks list information
- **Data File**: `2025/data/thanks.json`
- **Supported Fields**:
  - Name (trilingual)
  - Classification level (Gold/Silver/Bronze)
  - Company description (trilingual)
  - Logo filename
  - Official website link

##### 3. 🏘️ Community Management (Community)

- **Function**: Manage participating community organizations
- **Data File**: `2025/data/community.json`
- **Supported Fields**:
  - Community name (trilingual)
  - Community description (trilingual)
  - Logo filename
  - Official website link

##### 4. 🛍️ Tech Creation Market (TWM)

- **Function**: Manage tech creation market booths
- **Data File**: `2025/data/twm.json`
- **Supported Fields**:
  - Booth name (trilingual)
  - Booth description (trilingual)
  - Creator bio (trilingual)
  - Product image filename
  - Contact information

##### 5. 👥 Staff Management (Staff)

- **Function**: Manage staff and volunteer information
- **Data File**: `2025/data/staff.json`
- **Supported Fields**:
  - Name (trilingual)
  - Position (trilingual)
  - Department (trilingual)
  - Photo filename
  - Contact information

##### 6. ℹ️ About Us (About)

- **Function**: Manage organization and event information
- **Data File**: `2025/data/about.json`
- **Supported Fields**:
  - Organization information (trilingual)
  - Event description (trilingual)
  - Contact information

#### Editor Operation Steps

1. **Select Tab**: Click on the tab above to choose the content type to edit
2. **Load Existing Data**: Click the "Load File" button to upload existing JSON files
3. **Edit Content**:
   - Fill in or modify data in the form
   - All text fields support Traditional Chinese, English, and Japanese
   - For image fields, enter the filename (images should be placed in the `2025/images/` folder)
4. **Preview Data**: Preview the JSON format below after editing
5. **Download File**: Click "Download JSON" to download the edited data locally
6. **Update Website**: Replace the corresponding files in the `2025/data/` folder with the downloaded JSON files

#### Multilingual Content Format

All text content uses the following format:

```json
{
  "field_name": {
    "zh": "Traditional Chinese content",
    "en": "English content",
    "ja": "Japanese content"
  }
}
```

### Manual JSON File Editing

If you're familiar with JSON format, you can also directly edit files in the `2025/data/` folder:

- `2025/data/speakers.json` - Speaker information
- `2025/data/thanks.json` - Thanks list information
- `2025/data/community.json` - Community information
- `2025/data/twm.json` - Tech Creation Market
- `2025/data/staff.json` - Staff
- `2025/data/about.json` - About us

For detailed data format specifications, please refer to `README-DYNAMIC-CONTENT.md`.

## 🎨 Design System

- **Material Design 3**: Adopts Google's latest design system
- **Responsive Layout**: Supports mobile, tablet, and desktop screen sizes
- **Brand Colors**: Uses event theme colors
- **Roboto Font**: Unified font system

## 🌐 Multilingual Support

The website supports three languages:

- 🇹🇼 Traditional Chinese (default)
- 🇺🇸 English
- 🇯🇵 Japanese

Language switching functionality automatically saves user preferences.

## 📱 Features

### Main Features

- **Single Page Application (SPA)**: Smooth page switching experience
- **Event Schedule**: Complete event agenda
- **Speaker Showcase**: Speaker introductions and presentation topics
- **Thanks Display**: Multi-tier thanks list showcase support
- **Community Participation**: Participating community organization display
- **Creator Market**: Booth information display
- **Responsive Navigation**: Mobile hamburger menu

### Technical Features

- **Zero Dependencies**: No npm packages or build tools required
- **Modern JavaScript**: Uses ES6+ syntax
- **CSS Custom Properties**: Flexible theme system
- **Asynchronous Loading**: Dynamic JSON data loading
- **Error Handling**: Comprehensive error handling mechanisms

## 🛠️ Development Guide

### Adding New Content Types

To add new content types:

1. Create a new JSON file in `data/`
2. Add corresponding loading and rendering functions in `js/dynamic-content.js`
3. Add corresponding edit forms in `json-editor.html`

### Adding Language Support

1. Add language to the `translations` object in `js/main.js`
2. Update multilingual fields in all JSON files
3. Add options to the language switching menu

### Custom Styling

All styles are centralized in `css/style.css`, using CSS custom properties for easy theme switching:

```css
:root {
  --color-primary: #667eea;
  --color-secondary: #764ba2;
  /* Other custom properties... */
}
```

## 📄 License

This project is open-sourced under the MIT License.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

For detailed license content, please refer to the [LICENSE](./LICENSE) file.

## 🤝 Contributing

If you have suggestions or find issues, please feel free to submit Issues or Pull Requests.

---

**Development Team**: DevFest 2025 Technical Team
**Last Updated**: 2025
