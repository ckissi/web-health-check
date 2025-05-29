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
  
  // Check for favicon
  const favicon = await page.evaluate(() => {
    const favicon = document.querySelector('link[rel="icon"], link[rel="shortcut icon"]');
    return favicon ? favicon.href : null;
  });
  
  results.push({
    test: 'Favicon',
    status: favicon ? 'pass' : 'fail',
    message: favicon ? 'Favicon found' : 'No favicon found',
    details: favicon ? { url: favicon } : {}
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
  
  // Check for Twitter Card tags
  const requiredTwitterTags = ['twitter:card', 'twitter:title', 'twitter:description'];
  const twitterTags = {};
  
  for (const tag of requiredTwitterTags) {
    twitterTags[tag] = pageData.meta[tag] || null;
  }
  
  const missingTwitterTags = requiredTwitterTags.filter(tag => !twitterTags[tag]);
  
  results.push({
    test: 'Twitter Card Tags',
    status: missingTwitterTags.length === 0 ? 'pass' : missingTwitterTags.length < requiredTwitterTags.length / 2 ? 'warning' : 'fail',
    message: missingTwitterTags.length === 0 
      ? 'All required Twitter Card tags are present' 
      : `Missing ${missingTwitterTags.length} Twitter Card tags: ${missingTwitterTags.join(', ')}`,
    details: { 
      present: requiredTwitterTags.filter(tag => twitterTags[tag]),
      missing: missingTwitterTags,
      values: twitterTags
    }
  });
  
  return results;
}
