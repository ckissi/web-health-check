/**
 * Link Checker module
 * Checks if links on a page are working or not
 * 
 * @param {Object} page - Puppeteer page object
 * @param {Object} pageData - Data extracted from the page
 * @returns {Object} - Results of link checking
 */
import axios from 'axios';

export default async function checkLinks(page, pageData) {
  // Extract all unique links from the page
  const links = pageData.links
    .filter(link => link.href && link.href.trim() !== '')
    .map(link => link.href)
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
  
  const results = {
    working: [],
    notWorking: []
  };
  
  // Function to check a single link
  async function checkLink(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        maxRedirects: 5,
        validateStatus: status => true // Accept any status code to check redirects
      });
      
      // Consider 2xx and 3xx status codes as working
      if (response.status >= 200 && response.status < 400) {
        return {
          url,
          status: response.status,
          working: true,
          redirectUrl: response.request.res.responseUrl !== url ? response.request.res.responseUrl : null
        };
      } else {
        return {
          url,
          status: response.status,
          working: false,
          error: `HTTP status ${response.status}`
        };
      }
    } catch (error) {
      return {
        url,
        status: 0,
        working: false,
        error: error.code || error.message
      };
    }
  }
  
  // Check links in batches to avoid overwhelming the server
  const batchSize = 5;
  const batches = [];
  
  for (let i = 0; i < links.length; i += batchSize) {
    batches.push(links.slice(i, i + batchSize));
  }
  
  for (const batch of batches) {
    const batchResults = await Promise.all(batch.map(link => checkLink(link)));
    
    for (const result of batchResults) {
      if (result.working) {
        results.working.push(result);
      } else {
        results.notWorking.push(result);
      }
    }
    
    // Small delay between batches to be nice to servers
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}
