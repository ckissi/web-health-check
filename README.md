# Webpage Health Checker

A Node.js CLI tool to check webpage health and SEO factors.

## Features

This tool analyzes webpages for various health and SEO factors, including:

### Implemented Modules

1. **Branding & Social Sharing**
   - Favicon existence
   - Open Graph tags (og:title, og:description, og:image, og:url)
   - Twitter Card tags (twitter:card, twitter:title, twitter:description)
   - Apple Touch Icon for iOS devices

2. **Basic SEO**
   - Title tags: Checks for presence and optimal length
   - Meta descriptions: Checks for presence and optimal length
   - Header tags: Proper use of H1, H2, H3, etc. Only one H1 per page
   - Canonical tags: Checks if present

3. **Image Optimization**
   - Alt text: Checks if images have descriptive alt text
   - Lazy loading: Detects if images use lazy loading
   - Responsive images: Checks for srcset, sizes attributes or picture elements

4. **Security Checks**
   - HTTPS/SSL: Verifies site loads securely
   - Robots.txt: Checks if it exists and is set up correctly
   - XML Sitemap: Checks if it exists and is referenced in robots.txt
   - 404 Page: Checks for custom error page

5. **Mobile Responsiveness**
   - Viewport meta tag: Checks for proper responsive configuration
   - Responsive Design Techniques: Detects both traditional CSS media queries and Tailwind CSS responsive classes
   - Tap Target Size: Ensures interactive elements are large enough for mobile users
   - Responsive Images: Checks for mobile-friendly image techniques
   - Font Sizes: Ensures text is readable on mobile devices

## Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to the project directory
cd webpage-health-checker

# Install dependencies
npm install

# Make the CLI executable
chmod +x index.js

# Link the package globally (optional)
npm link
```

## Usage

```bash
# Basic usage
node index.js https://example.com

# Specify output format
node index.js https://example.com --output json

# Run specific modules
node index.js https://example.com --modules brandingAndSocialSharing,basicSeo
```

## Options

- `--output, -o`: Output format (console, json)
- `--modules, -m`: Specific modules to run (comma separated)

## Adding New Modules

To add a new health check module:

1. Create a new file in the `modules` directory (e.g., `myModule.js`)
2. Export a default async function that accepts `page` and `pageData` parameters
3. Return an array of test results with the format:
   ```js
   {
     test: 'Test Name',
     status: 'pass' | 'fail' | 'warning',
     message: 'Human-readable message',
     details: { /* Additional details */ }
   }
   ```

## Future Enhancements

The following features could be implemented in future versions:

- Page speed analysis
- Structured data/schema markup validation
- Broken link checking
- Redirect chain analysis
- More comprehensive mobile-friendly testing
- Integration with Google PageSpeed Insights API
- PDF report generation

## License

MIT
