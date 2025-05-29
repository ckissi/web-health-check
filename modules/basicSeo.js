/**
 * Basic SEO health check module
 * Checks for title tags, meta descriptions, and header tags
 * 
 * @param {Object} page - Puppeteer page object
 * @param {Object} pageData - Data extracted from the page
 * @returns {Array} - Array of test results
 */
export default async function basicSeoCheck(page, pageData) {
  const results = [];
  
  // Check title tag
  const title = pageData.title;
  const titleLength = title.length;
  
  results.push({
    test: 'Title Tag',
    status: !title ? 'fail' : (titleLength < 10 || titleLength > 60) ? 'warning' : 'pass',
    message: !title 
      ? 'No title tag found' 
      : (titleLength < 10) 
        ? `Title tag is too short (${titleLength} chars). Recommended: 10-60 chars.`
        : (titleLength > 60) 
          ? `Title tag is too long (${titleLength} chars). Recommended: 10-60 chars.`
          : `Title tag has good length (${titleLength} chars)`,
    details: { title, length: titleLength }
  });
  
  // Check meta description
  const metaDescription = pageData.meta['description'];
  const metaDescriptionLength = metaDescription ? metaDescription.length : 0;
  
  results.push({
    test: 'Meta Description',
    status: !metaDescription ? 'fail' : (metaDescriptionLength < 50 || metaDescriptionLength > 160) ? 'warning' : 'pass',
    message: !metaDescription 
      ? 'No meta description found' 
      : (metaDescriptionLength < 50) 
        ? `Meta description is too short (${metaDescriptionLength} chars). Recommended: 50-160 chars.`
        : (metaDescriptionLength > 160) 
          ? `Meta description is too long (${metaDescriptionLength} chars). Recommended: 50-160 chars.`
          : `Meta description has good length (${metaDescriptionLength} chars)`,
    details: { description: metaDescription, length: metaDescriptionLength }
  });
  
  // Check header tags
  const h1Count = pageData.headers.h1 ? pageData.headers.h1.length : 0;
  const hasHeaders = Object.keys(pageData.headers).length > 0;
  const headerStructure = Object.entries(pageData.headers).map(([tag, values]) => ({
    tag,
    count: values.length,
    values
  }));
  
  results.push({
    test: 'H1 Tag',
    status: h1Count === 0 ? 'fail' : h1Count > 1 ? 'warning' : 'pass',
    message: h1Count === 0 
      ? 'No H1 tag found' 
      : h1Count > 1 
        ? `Multiple H1 tags found (${h1Count}). Recommended: only one H1 per page.`
        : 'One H1 tag found (recommended)',
    details: { 
      count: h1Count,
      values: pageData.headers.h1 || []
    }
  });
  
  results.push({
    test: 'Header Structure',
    status: !hasHeaders ? 'fail' : 'pass',
    message: !hasHeaders 
      ? 'No header tags (h1-h6) found' 
      : `Found ${Object.values(pageData.headers).flat().length} header tags`,
    details: { structure: headerStructure }
  });
  
  // Check canonical tag
  const canonical = await page.evaluate(() => {
    const link = document.querySelector('link[rel="canonical"]');
    return link ? link.href : null;
  });
  
  results.push({
    test: 'Canonical Tag',
    status: canonical ? 'pass' : 'warning',
    message: canonical 
      ? `Canonical tag found: ${canonical}` 
      : 'No canonical tag found. This may lead to duplicate content issues.',
    details: { url: canonical }
  });
  
  return results;
}
