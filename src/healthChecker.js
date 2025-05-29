import puppeteer from 'puppeteer';
import { loadModules } from './moduleLoader.js';

/**
 * Main function to run health checks on a webpage
 * @param {string} url - The URL to check
 * @param {string|string[]} modules - Modules to run ('all' or array of module names)
 * @returns {Object} - Results of all health checks
 */
export async function runHealthCheck(url, modules = 'all') {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  try {
    // Set viewport to desktop size
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate to the URL with a timeout of 30 seconds
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Get page content and metadata
    const pageData = {
      url,
      html: await page.content(),
      title: await page.title(),
      headers: await page.evaluate(() => {
        const headers = {};
        document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(header => {
          const tag = header.tagName.toLowerCase();
          if (!headers[tag]) headers[tag] = [];
          headers[tag].push(header.textContent.trim());
        });
        return headers;
      }),
      meta: await page.evaluate(() => {
        const metaTags = {};
        document.querySelectorAll('meta').forEach(meta => {
          // Get name or property attribute (Twitter can use either)
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');
          
          if (name && content) {
            // Store the meta tag value
            metaTags[name] = content;
            
            // For Twitter tags, store both with name and property format to ensure compatibility
            if (name.startsWith('twitter:')) {
              // If it was found with name="twitter:card", also store it as property="twitter:card"
              // and vice versa
              const altName = meta.hasAttribute('name') ? 'property' : 'name';
              if (!metaTags[name]) {
                metaTags[name] = content;
              }
            }
          }
        });
        
        // Debug log all meta tags
        console.log('Meta tags found:', Object.keys(metaTags));
        
        return metaTags;
      }),
      links: await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
          href: a.href,
          text: a.textContent.trim(),
          rel: a.getAttribute('rel')
        }));
      }),
      images: await page.evaluate(() => {
        return Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.getAttribute('alt') || '',
          width: img.width,
          height: img.height
        }));
      })
    };

    // Load and run modules
    const healthModules = await loadModules(modules);
    const results = {};

    for (const [moduleName, moduleFunc] of Object.entries(healthModules)) {
      results[moduleName] = await moduleFunc(page, pageData);
    }

    return results;
  } finally {
    await browser.close();
  }
}
