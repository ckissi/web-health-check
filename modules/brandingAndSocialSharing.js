/**
 * Branding and Social Sharing health check module
 * Checks for favicon, Open Graph tags, Twitter Card tags, and Apple Touch Icon
 * 
 * @param {Object} page - Puppeteer page object
 * @param {Object} pageData - Data extracted from the page
 * @returns {Array} - Array of test results
 */
export default async function brandingAndSocialSharingCheck(page, pageData) {
  const results = [];
  
  // Check for favicon (multiple methods)
  const faviconResult = await page.evaluate(() => {
    const result = {
      found: false,
      url: null,
      method: null
    };
    
    // Method 1: Check for link rel="icon" or rel="shortcut icon"
    const faviconLink = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    if (faviconLink) {
      let href = faviconLink.href || faviconLink.getAttribute('href');
      
      // Handle relative paths
      if (href && href.startsWith('/') && !href.startsWith('//')) {
        href = window.location.origin + href;
      } else if (href && !href.startsWith('http') && !href.startsWith('/')) {
        href = window.location.origin + '/' + href;
      }
      
      result.found = true;
      result.url = href;
      result.method = 'link tag';
      return result;
    }
    
    // Method 2: Check for favicon.ico at root
    const rootFaviconUrl = window.location.origin + '/favicon.ico';
    return {
      found: true, // We'll verify this with a fetch in the next step
      url: rootFaviconUrl,
      method: 'root location'
    };
  });
  
  // If favicon was detected at root, verify it actually exists
  if (faviconResult.method === 'root location') {
    try {
      // Try to fetch the favicon to verify it exists
      const response = await page.goto(faviconResult.url, { timeout: 5000 }).catch(() => null);
      // Go back to the original page
      await page.goBack();
      
      // Update found status based on response
      faviconResult.found = response && response.status() === 200;
    } catch (error) {
      faviconResult.found = false;
    }
  }
  
  results.push({
    test: 'Favicon',
    status: faviconResult.found ? 'pass' : 'fail',
    message: faviconResult.found 
      ? `Favicon found (${faviconResult.method})` 
      : 'No favicon found',
    details: faviconResult.found ? { url: faviconResult.url, method: faviconResult.method } : {}
  });
  
  // Check for Apple Touch Icon
  const appleTouchIcon = await page.evaluate(() => {
    const icon = document.querySelector('link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]');
    return icon ? icon.href : null;
  });
  
  results.push({
    test: 'Apple Touch Icon',
    status: appleTouchIcon ? 'pass' : 'warning',
    message: appleTouchIcon ? 'Apple Touch Icon found' : 'No Apple Touch Icon found for iOS devices',
    details: appleTouchIcon ? { url: appleTouchIcon } : {}
  });
  
  // Check for Open Graph tags
  const requiredOgTags = ['og:title', 'og:description', 'og:image', 'og:url'];
  const ogTags = {};
  
  for (const tag of requiredOgTags) {
    ogTags[tag] = pageData.meta[tag] || null;
  }
  
  const missingOgTags = requiredOgTags.filter(tag => !ogTags[tag]);
  
  results.push({
    test: 'Open Graph Tags',
    status: missingOgTags.length === 0 ? 'pass' : missingOgTags.length < requiredOgTags.length / 2 ? 'warning' : 'fail',
    message: missingOgTags.length === 0 
      ? 'All required Open Graph tags are present' 
      : `Missing ${missingOgTags.length} Open Graph tags: ${missingOgTags.join(', ')}`,
    details: { 
      present: requiredOgTags.filter(tag => ogTags[tag]),
      missing: missingOgTags,
      values: ogTags
    }
  });
  
  // Check for Twitter Card tags directly in the HTML
  const twitterCardResult = await page.evaluate(() => {
    // Required Twitter Card tags to check for
    const requiredTags = ['twitter:card', 'twitter:title', 'twitter:description'];
    const foundTags = {};
    const allTwitterTags = [];
    
    // Get all meta tags on the page
    const metaTags = document.querySelectorAll('meta');
    
    // Check each meta tag for Twitter Card properties
    metaTags.forEach(meta => {
      // Check both name and property attributes
      const nameAttr = meta.getAttribute('name');
      const propertyAttr = meta.getAttribute('property');
      const content = meta.getAttribute('content');
      
      // If this is a Twitter tag, record it
      if (nameAttr && nameAttr.includes('twitter:')) {
        foundTags[nameAttr] = content;
        allTwitterTags.push({ name: nameAttr, content, attribute: 'name' });
      }
      
      if (propertyAttr && propertyAttr.includes('twitter:')) {
        foundTags[propertyAttr] = content;
        allTwitterTags.push({ name: propertyAttr, content, attribute: 'property' });
      }
    });
    
    // Check which required tags are present/missing
    const present = [];
    const missing = [];
    
    for (const tag of requiredTags) {
      if (foundTags[tag]) {
        present.push(tag);
      } else {
        // Try case-insensitive matching as a fallback
        const matchingTag = Object.keys(foundTags).find(key => 
          key.toLowerCase() === tag.toLowerCase());
        
        if (matchingTag) {
          present.push(tag);
          foundTags[tag] = foundTags[matchingTag]; // Map to the standard name
        } else {
          missing.push(tag);
        }
      }
    }
    
    return {
      foundTags,
      present,
      missing,
      allTwitterTags
    };
  });
  
  // Add Twitter Card tags test result
  results.push({
    test: 'Twitter Card Tags',
    status: twitterCardResult.missing.length === 0 ? 'pass' : 
            twitterCardResult.missing.length < 2 ? 'warning' : 'fail',
    message: twitterCardResult.missing.length === 0 
      ? 'All required Twitter Card tags are present' 
      : `Missing ${twitterCardResult.missing.length} Twitter Card tags: ${twitterCardResult.missing.join(', ')}`,
    details: { 
      present: twitterCardResult.present,
      missing: twitterCardResult.missing,
      values: twitterCardResult.foundTags,
      allTwitterTags: twitterCardResult.allTwitterTags,
      rawHtml: twitterCardResult.allTwitterTags.map(tag => 
        `<meta ${tag.attribute}="${tag.name}" content="${tag.content}">`).join('\n')
    }
  });
  
  return results;
}
