/**
 * Mobile Responsiveness health check module
 * Checks for responsive design, viewport meta tag, and mobile-friendly features
 * 
 * @param {Object} page - Puppeteer page object
 * @param {Object} pageData - Data extracted from the page
 * @returns {Array} - Array of test results
 */
export default async function mobileResponsivenessCheck(page, pageData) {
  const results = [];
  
  // Check for viewport meta tag
  const viewportMeta = pageData.meta['viewport'];
  const hasViewportMeta = !!viewportMeta;
  const hasResponsiveViewport = hasViewportMeta && 
    viewportMeta.includes('width=device-width') && 
    viewportMeta.includes('initial-scale=1');
  
  results.push({
    test: 'Viewport Meta Tag',
    status: hasResponsiveViewport ? 'pass' : hasViewportMeta ? 'warning' : 'fail',
    message: hasResponsiveViewport 
      ? 'Proper responsive viewport meta tag found' 
      : hasViewportMeta 
        ? 'Viewport meta tag found but may not be properly configured for responsiveness'
        : 'No viewport meta tag found. This is essential for mobile responsiveness.',
    details: { 
      exists: hasViewportMeta,
      value: viewportMeta,
      isResponsive: hasResponsiveViewport
    }
  });
  
  // Check for media queries in CSS and Tailwind responsive classes
  const responsiveDesignCheck = await page.evaluate(() => {
    const result = {
      mediaQueries: false,
      tailwindClasses: false,
      tailwindCDN: false
    };
    
    // Check for Tailwind CSS
    // First look for Tailwind CDN or local imports
    const stylesheets = Array.from(document.querySelectorAll('link[rel="stylesheet"], script'));
    for (const sheet of stylesheets) {
      const href = sheet.getAttribute('href') || sheet.getAttribute('src') || '';
      if (href.includes('tailwind') || href.includes('tw-')) {
        result.tailwindCDN = true;
        break;
      }
    }
    
    // Look for Tailwind responsive class patterns in HTML
    const allElements = document.querySelectorAll('*');
    const tailwindResponsivePatterns = [
      /\bsm:/, /\bmd:/, /\blg:/, /\bxl:/, /\b2xl:/,  // Standard breakpoints
      /\bhover:/, /\bfocus:/, /\bactive:/,           // Interactive states
      /\bdark:/                                       // Dark mode
    ];
    
    for (const el of allElements) {
      if (el.className && typeof el.className === 'string') {
        for (const pattern of tailwindResponsivePatterns) {
          if (pattern.test(el.className)) {
            result.tailwindClasses = true;
            break;
          }
        }
        if (result.tailwindClasses) break;
      }
    }
    
    // Check for traditional media queries in stylesheets
    try {
      const styleSheets = Array.from(document.styleSheets);
      for (const sheet of styleSheets) {
        // Skip external stylesheets that might cause CORS issues
        if (!sheet.href || sheet.href.startsWith(window.location.origin)) {
          const rules = Array.from(sheet.cssRules || []);
          for (const rule of rules) {
            if (rule.type === CSSRule.MEDIA_RULE && 
                (rule.conditionText.includes('max-width') || 
                 rule.conditionText.includes('min-width'))) {
              result.mediaQueries = true;
              break;
            }
          }
          if (result.mediaQueries) break;
        }
      }
    } catch (e) {
      // If we can't access the CSS rules (e.g., due to CORS), set to null
      result.mediaQueries = null;
    }
    
    return result;
  });
  
  // Determine if any responsive design technique is used
  const hasResponsiveDesign = 
    responsiveDesignCheck.mediaQueries === true || 
    responsiveDesignCheck.tailwindClasses || 
    responsiveDesignCheck.tailwindCDN;
  
  results.push({
    test: 'Responsive Design Techniques',
    status: hasResponsiveDesign ? 'pass' : responsiveDesignCheck.mediaQueries === null ? 'warning' : 'fail',
    message: hasResponsiveDesign 
      ? `Responsive design techniques detected${responsiveDesignCheck.tailwindClasses ? ' (including Tailwind CSS)' : ''}` 
      : responsiveDesignCheck.mediaQueries === null
        ? 'Could not fully check for responsive design techniques due to potential CORS restrictions'
        : 'No responsive design techniques detected. These are important for mobile-friendly websites.',
    details: { 
      mediaQueries: responsiveDesignCheck.mediaQueries,
      tailwindCSS: {
        detected: responsiveDesignCheck.tailwindClasses || responsiveDesignCheck.tailwindCDN,
        responsiveClasses: responsiveDesignCheck.tailwindClasses,
        cdnOrImport: responsiveDesignCheck.tailwindCDN
      }
    }
  });
  
  // Check for mobile-friendly tap targets
  const smallTapTargets = await page.evaluate(() => {
    const minTapSize = 44; // Minimum recommended tap target size in pixels
    const interactiveElements = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"]'));
    
    const smallTargets = interactiveElements.filter(el => {
      const rect = el.getBoundingClientRect();
      return (rect.width < minTapSize || rect.height < minTapSize) && 
             // Ignore hidden elements
             !(rect.width === 0 && rect.height === 0) &&
             window.getComputedStyle(el).display !== 'none' &&
             window.getComputedStyle(el).visibility !== 'hidden';
    });
    
    return {
      total: interactiveElements.length,
      small: smallTargets.length,
      percentage: interactiveElements.length > 0 
        ? Math.round((smallTargets.length / interactiveElements.length) * 100) 
        : 0
    };
  });
  
  results.push({
    test: 'Tap Target Size',
    status: smallTapTargets.percentage <= 10 ? 'pass' : smallTapTargets.percentage <= 25 ? 'warning' : 'fail',
    message: smallTapTargets.percentage <= 10 
      ? 'Most tap targets are appropriately sized for mobile users' 
      : `${smallTapTargets.percentage}% of tap targets may be too small for mobile users`,
    details: smallTapTargets
  });
  
  // Check for responsive images
  const responsiveImagesResult = await page.evaluate(() => {
    const images = Array.from(document.querySelectorAll('img'));
    const responsiveImages = images.filter(img => 
      img.hasAttribute('srcset') || 
      img.hasAttribute('sizes') || 
      img.parentElement.tagName.toLowerCase() === 'picture'
    );
    
    return {
      total: images.length,
      responsive: responsiveImages.length,
      percentage: images.length > 0 
        ? Math.round((responsiveImages.length / images.length) * 100) 
        : 0
    };
  });
  
  results.push({
    test: 'Responsive Images',
    status: responsiveImagesResult.percentage >= 50 ? 'pass' : responsiveImagesResult.percentage > 0 ? 'warning' : 'fail',
    message: responsiveImagesResult.percentage >= 50 
      ? `${responsiveImagesResult.percentage}% of images use responsive techniques` 
      : responsiveImagesResult.percentage > 0
        ? `Only ${responsiveImagesResult.percentage}% of images use responsive techniques`
        : 'No responsive image techniques detected',
    details: responsiveImagesResult
  });
  
  // Check for mobile-friendly font sizes
  const smallFontElements = await page.evaluate(() => {
    const minFontSize = 12; // Minimum recommended font size in pixels
    const textElements = Array.from(document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, li, td, th, a, button, label'));
    
    const smallElements = textElements.filter(el => {
      const fontSize = parseInt(window.getComputedStyle(el).fontSize);
      return fontSize < minFontSize && 
             // Ignore hidden elements
             window.getComputedStyle(el).display !== 'none' &&
             window.getComputedStyle(el).visibility !== 'hidden' &&
             el.textContent.trim() !== '';
    });
    
    return {
      total: textElements.length,
      small: smallElements.length,
      percentage: textElements.length > 0 
        ? Math.round((smallElements.length / textElements.length) * 100) 
        : 0
    };
  });
  
  results.push({
    test: 'Font Sizes',
    status: smallFontElements.percentage <= 10 ? 'pass' : smallFontElements.percentage <= 25 ? 'warning' : 'fail',
    message: smallFontElements.percentage <= 10 
      ? 'Most text elements have appropriate font sizes for mobile users' 
      : `${smallFontElements.percentage}% of text elements may have font sizes too small for mobile users`,
    details: smallFontElements
  });
  
  return results;
}
