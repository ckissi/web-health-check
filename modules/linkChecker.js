/**
 * Link Checker module
 * Checks if links on a page are working or not
 * 
 * @param {Object} page - Puppeteer page object
 * @param {Object} pageData - Data extracted from the page
 * @returns {Object} - Results of link checking
 */
import axios from 'axios';
import puppeteer from 'puppeteer';

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
  
  // Browser-like headers to avoid being blocked
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Cache-Control': 'max-age=0',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1'
  };
  
  // Function to check a single link
  async function checkLink(url) {
    try {
      // First try with axios and browser-like headers
      const response = await axios.get(url, {
        timeout: 10000, // 10 second timeout
        maxRedirects: 5,
        headers: headers,
        validateStatus: status => true // Accept any status code to check redirects
      });
      
      // If we get a 403 or 400, try with Puppeteer as a fallback
      if (response.status === 403 || response.status === 400) {
        try {
          // Use Puppeteer to check the link (more like a real browser)
          const browser = await puppeteer.launch({ headless: "new" });
          const page = await browser.newPage();
          
          // Set timeout for navigation
          const pageResponse = await page.goto(url, { 
            waitUntil: 'domcontentloaded', 
            timeout: 15000 
          }).catch(e => null);
          
          await browser.close();
          
          // If we got a response, the link is working
          if (pageResponse) {
            return {
              url,
              status: pageResponse.status(),
              working: true,
              checkedWith: 'puppeteer',
              redirectUrl: pageResponse.url() !== url ? pageResponse.url() : null
            };
          }
        } catch (puppeteerError) {
          // If Puppeteer also fails, return the original error
          return {
            url,
            status: response.status,
            working: false,
            error: `HTTP status ${response.status}`,
            checkedWith: 'both'
          };
        }
      }
      
      // Consider 2xx and 3xx status codes as working
      if (response.status >= 200 && response.status < 400) {
        return {
          url,
          status: response.status,
          working: true,
          checkedWith: 'axios',
          redirectUrl: response.request.res.responseUrl !== url ? response.request.res.responseUrl : null
        };
      } else {
        return {
          url,
          status: response.status,
          working: false,
          checkedWith: 'axios',
          error: `HTTP status ${response.status}`
        };
      }
    } catch (error) {
      // For network errors, try with Puppeteer as a fallback
      try {
        // Use Puppeteer to check the link
        const browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        
        // Set timeout for navigation
        const pageResponse = await page.goto(url, { 
          waitUntil: 'domcontentloaded', 
          timeout: 15000 
        }).catch(e => null);
        
        await browser.close();
        
        // If we got a response, the link is working
        if (pageResponse) {
          return {
            url,
            status: pageResponse.status(),
            working: true,
            checkedWith: 'puppeteer',
            redirectUrl: pageResponse.url() !== url ? pageResponse.url() : null
          };
        }
      } catch (puppeteerError) {
        // If Puppeteer also fails, return the original error
      }
      
      return {
        url,
        status: 0,
        working: false,
        checkedWith: 'both',
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
  
  // Convert results to the expected format (array of test results)
  const formattedResults = [
    {
      test: 'Working Links',
      status: 'pass', // This is informational, not a pass/fail test
      message: `Found ${results.working.length} working links`,
      details: {
        count: results.working.length,
        links: results.working
      }
    },
    {
      test: 'Broken Links',
      status: results.notWorking.length === 0 ? 'pass' : 'fail',
      message: results.notWorking.length === 0 
        ? 'No broken links found' 
        : `Found ${results.notWorking.length} broken links`,
      details: {
        count: results.notWorking.length,
        links: results.notWorking
      }
    }
  ];
  
  return formattedResults;
}
