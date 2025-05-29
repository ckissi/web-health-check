/**
 * Link Analysis health check module
 * Analyzes links on the page, including dofollow/nofollow status
 * 
 * @param {Object} page - Puppeteer page object
 * @param {Object} pageData - Data extracted from the page
 * @returns {Array} - Array of test results
 */
export default async function linkAnalysisCheck(page, pageData) {
  const results = [];
  
  // Get all links on the page with their attributes
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]')).map(a => ({
      href: a.href,
      text: a.textContent.trim(),
      rel: a.getAttribute('rel') || '',
      isExternal: a.href.startsWith('http') && !a.href.includes(window.location.hostname),
      isInternal: a.href.includes(window.location.hostname) || 
                  (a.href.startsWith('/') && !a.href.startsWith('//'))
    }));
  });
  
  // Filter out links that are not valid URLs or are anchors
  const validLinks = links.filter(link => {
    try {
      new URL(link.href);
      return !link.href.endsWith('#') && !link.href.startsWith('javascript:');
    } catch (e) {
      return false;
    }
  });
  
  // Analyze dofollow/nofollow status
  const internalLinks = validLinks.filter(link => link.isInternal);
  const externalLinks = validLinks.filter(link => link.isExternal);
  
  const nofollowLinks = validLinks.filter(link => 
    link.rel.includes('nofollow') || 
    link.rel.includes('ugc') || 
    link.rel.includes('sponsored')
  );
  
  const dofollowLinks = validLinks.filter(link => 
    !link.rel.includes('nofollow') && 
    !link.rel.includes('ugc') && 
    !link.rel.includes('sponsored')
  );
  
  const nofollowExternal = externalLinks.filter(link => 
    link.rel.includes('nofollow') || 
    link.rel.includes('ugc') || 
    link.rel.includes('sponsored')
  );
  
  const dofollowExternal = externalLinks.filter(link => 
    !link.rel.includes('nofollow') && 
    !link.rel.includes('ugc') && 
    !link.rel.includes('sponsored')
  );
  
  // Add link count result
  results.push({
    test: 'Link Count',
    status: 'pass', // This is informational, not a pass/fail test
    message: `Found ${validLinks.length} links: ${internalLinks.length} internal, ${externalLinks.length} external`,
    details: {
      total: validLinks.length,
      internal: internalLinks.length,
      external: externalLinks.length
    }
  });
  
  // Add dofollow/nofollow analysis
  results.push({
    test: 'Dofollow/Nofollow Analysis',
    status: 'pass', // This is informational, not a pass/fail test
    message: `${dofollowLinks.length} dofollow links, ${nofollowLinks.length} nofollow links`,
    details: {
      dofollow: {
        total: dofollowLinks.length,
        internal: dofollowLinks.filter(link => link.isInternal).length,
        external: dofollowExternal.length
      },
      nofollow: {
        total: nofollowLinks.length,
        internal: nofollowLinks.filter(link => link.isInternal).length,
        external: nofollowExternal.length
      }
    }
  });
  
  // Add external link analysis with warning if external links are dofollow
  const externalLinkStatus = dofollowExternal.length > 0 ? 'warning' : 'pass';
  results.push({
    test: 'External Link Analysis',
    status: externalLinkStatus,
    message: dofollowExternal.length > 0
      ? `${dofollowExternal.length} external links are dofollow. Consider adding rel="nofollow" to external links.`
      : 'All external links have appropriate rel attributes.',
    details: {
      externalDofollow: dofollowExternal.length,
      externalNofollow: nofollowExternal.length
    }
  });
  
  // List all nofollow links
  results.push({
    test: 'Nofollow Links List',
    status: 'pass', // This is informational, not a pass/fail test
    message: `${nofollowLinks.length} nofollow links found`,
    details: {
      nofollowLinks: nofollowLinks.map(link => ({
        url: link.href,
        text: link.text,
        rel: link.rel,
        isExternal: link.isExternal
      }))
    }
  });
  
  return results;
}
