/**
 * Image Optimization health check module
 * Checks for image alt text, dimensions, and lazy loading
 * 
 * @param {Object} page - Puppeteer page object
 * @param {Object} pageData - Data extracted from the page
 * @returns {Array} - Array of test results
 */
export default async function imageOptimizationCheck(page, pageData) {
  const results = [];
  
  // Get all images on the page
  const images = pageData.images;
  const imageCount = images.length;
  
  // Check if there are any images
  if (imageCount === 0) {
    results.push({
      test: 'Image Presence',
      status: 'warning',
      message: 'No images found on the page',
      details: { count: 0 }
    });
    return results;
  }
  
  // Check for alt text
  const imagesWithAlt = images.filter(img => img.alt && img.alt.trim() !== '');
  const imagesWithoutAlt = images.filter(img => !img.alt || img.alt.trim() === '');
  const altTextPercentage = Math.round((imagesWithAlt.length / imageCount) * 100);
  
  results.push({
    test: 'Image Alt Text',
    status: altTextPercentage === 100 ? 'pass' : altTextPercentage >= 80 ? 'warning' : 'fail',
    message: altTextPercentage === 100 
      ? 'All images have alt text (excellent)' 
      : `${altTextPercentage}% of images have alt text (${imagesWithAlt.length}/${imageCount})`,
    details: { 
      total: imageCount,
      withAlt: imagesWithAlt.length,
      withoutAlt: imagesWithoutAlt.length,
      percentage: altTextPercentage,
      missingAltUrls: imagesWithoutAlt.map(img => img.src)
    }
  });
  
  // Check for lazy loading
  const lazyLoadedImages = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img[loading="lazy"], img[data-src], img[data-lazy-src]')).length;
  });
  
  const lazyLoadPercentage = Math.round((lazyLoadedImages / imageCount) * 100);
  
  results.push({
    test: 'Image Lazy Loading',
    status: lazyLoadPercentage >= 80 ? 'pass' : lazyLoadPercentage >= 50 ? 'warning' : 'fail',
    message: lazyLoadPercentage >= 80 
      ? `${lazyLoadPercentage}% of images use lazy loading (good)` 
      : `Only ${lazyLoadPercentage}% of images use lazy loading`,
    details: { 
      total: imageCount,
      lazyLoaded: lazyLoadedImages,
      percentage: lazyLoadPercentage
    }
  });
  
  // Check for responsive images
  const responsiveImages = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('img[srcset], img[sizes], picture source[srcset]')).length;
  });
  
  const responsivePercentage = Math.round((responsiveImages / imageCount) * 100);
  
  results.push({
    test: 'Responsive Images',
    status: responsivePercentage >= 50 ? 'pass' : responsivePercentage > 0 ? 'warning' : 'fail',
    message: responsivePercentage >= 50 
      ? `${responsivePercentage}% of images use responsive techniques (good)` 
      : `Only ${responsivePercentage}% of images use responsive techniques`,
    details: { 
      total: imageCount,
      responsive: responsiveImages,
      percentage: responsivePercentage
    }
  });
  
  return results;
}
