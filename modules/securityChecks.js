import axios from 'axios';
import { URL } from 'url';

/**
 * Security Checks health check module
 * Checks for HTTPS, robots.txt, and other security-related aspects
 * 
 * @param {Object} page - Puppeteer page object
 * @param {Object} pageData - Data extracted from the page
 * @returns {Array} - Array of test results
 */
export default async function securityChecksModule(page, pageData) {
  const results = [];
  const url = new URL(pageData.url);
  
  // Check for HTTPS
  const isHttps = url.protocol === 'https:';
  
  results.push({
    test: 'HTTPS/SSL',
    status: isHttps ? 'pass' : 'fail',
    message: isHttps 
      ? 'Site loads securely via HTTPS' 
      : 'Site is not using HTTPS. This is a security risk and may affect SEO rankings.',
    details: { protocol: url.protocol }
  });
  
  // Check for robots.txt
  const robotsUrl = `${url.origin}/robots.txt`;
  let robotsExists = false;
  let robotsContent = null;
  
  try {
    const response = await axios.get(robotsUrl, { timeout: 5000 });
    robotsExists = response.status === 200;
    robotsContent = response.data;
  } catch (error) {
    robotsExists = false;
  }
  
  results.push({
    test: 'Robots.txt',
    status: robotsExists ? 'pass' : 'warning',
    message: robotsExists 
      ? 'Robots.txt file exists' 
      : 'No robots.txt file found. This file helps control search engine crawling.',
    details: { 
      url: robotsUrl,
      exists: robotsExists,
      content: robotsContent
    }
  });
  
  // Check for sitemap reference in robots.txt
  let hasSitemapReference = false;
  let sitemapUrl = null;
  
  if (robotsExists && robotsContent) {
    const sitemapMatch = robotsContent.match(/^Sitemap:\s*(.+)$/im);
    if (sitemapMatch && sitemapMatch[1]) {
      hasSitemapReference = true;
      sitemapUrl = sitemapMatch[1].trim();
    }
  }
  
  // Check for sitemap.xml
  const defaultSitemapUrl = `${url.origin}/sitemap.xml`;
  let sitemapExists = false;
  
  try {
    // First check the sitemap referenced in robots.txt if available
    if (sitemapUrl) {
      const response = await axios.get(sitemapUrl, { timeout: 5000 });
      sitemapExists = response.status === 200;
    } else {
      // Otherwise check the default location
      const response = await axios.get(defaultSitemapUrl, { timeout: 5000 });
      sitemapExists = response.status === 200;
      sitemapUrl = defaultSitemapUrl;
    }
  } catch (error) {
    sitemapExists = false;
  }
  
  results.push({
    test: 'XML Sitemap',
    status: sitemapExists ? 'pass' : 'warning',
    message: sitemapExists 
      ? `XML Sitemap exists at ${sitemapUrl}` 
      : 'No XML Sitemap found. A sitemap helps search engines discover and index your content.',
    details: { 
      url: sitemapUrl || defaultSitemapUrl,
      exists: sitemapExists,
      referencedInRobots: hasSitemapReference
    }
  });
  
  // Check for 404 page
  // This is a bit tricky as we don't want to navigate away from the current page
  // We'll use a fetch request instead
  const nonExistentUrl = `${url.origin}/page-that-does-not-exist-${Date.now()}`;
  let has404Page = false;
  
  try {
    const response = await axios.get(nonExistentUrl, { 
      timeout: 5000,
      validateStatus: status => true // Accept any status code
    });
    
    // Check if status is 404 and the response is not empty
    has404Page = response.status === 404 && response.data && response.data.length > 0;
  } catch (error) {
    has404Page = false;
  }
  
  results.push({
    test: '404 Page',
    status: has404Page ? 'pass' : 'warning',
    message: has404Page 
      ? 'Custom 404 page detected' 
      : 'Could not detect a custom 404 page. A custom error page improves user experience.',
    details: { 
      testUrl: nonExistentUrl,
      detected: has404Page
    }
  });
  
  return results;
}
