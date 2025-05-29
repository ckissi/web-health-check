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
          const name = meta.getAttribute('name') || meta.getAttribute('property');
          const content = meta.getAttribute('content');
          if (name && content) metaTags[name] = content;
        });
        return metaTags;
      }),
      links: await page.evaluate(() => {
        // Get all anchor elements
        const anchors = Array.from(document.querySelectorAll('a'));
        
        return anchors.map(a => {
          // Handle href attribute - some frameworks might not use standard href
          let href = a.href || '';
          
          // If href is empty or just '#', check for other possible href locations
          if (!href || href === '#' || href === 'javascript:void(0)') {
            // Check for href in dataset
            if (a.dataset && a.dataset.href) {
              href = a.dataset.href;
            }
            
            // Check for href in aria-label
            if (!href && a.getAttribute('aria-label')) {
              const ariaLabel = a.getAttribute('aria-label');
              if (ariaLabel && ariaLabel.startsWith('http')) {
                href = ariaLabel;
              }
            }
            
            // Check for nested link in attributes
            if (!href) {
              for (const attr of a.attributes) {
                if (attr.value && attr.value.startsWith('http')) {
                  href = attr.value;
                  break;
                }
              }
            }
          }
          
          // Make relative URLs absolute
          if (href && href.startsWith('/') && !href.startsWith('//')) {
            href = window.location.origin + href;
          }
          
          return {
            href: href,
            text: a.textContent.trim(),
            rel: a.getAttribute('rel'),
            outerHTML: a.outerHTML.substring(0, 500) // Store a snippet of the HTML for debugging
          };
        }).filter(link => link.href && link.href.trim() !== '' && 
                          !link.href.startsWith('javascript:') && 
                          !link.href.startsWith('mailto:') && 
                          !link.href.startsWith('tel:'));
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
