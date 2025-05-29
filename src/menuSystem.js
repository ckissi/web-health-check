import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { runHealthCheck } from './healthChecker.js';
import puppeteer from 'puppeteer';

/**
 * Displays an interactive menu for the user to choose actions
 * @param {string} url - The URL to check
 * @returns {Promise<void>}
 */
export async function showMenu(url) {
  console.log(chalk.bold.blue('\nWebpage Health Checker'));
  console.log(chalk.gray(`URL: ${url}`));
  console.log(chalk.gray(`Date: ${new Date().toISOString()}`));
  console.log('\n');
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Run Web Health Check', value: 'healthCheck' },
        { name: 'Check Links (Working/Not Working)', value: 'linkCheck' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);
  
  switch (action) {
    case 'healthCheck':
      await runWebHealthCheck(url);
      // Show menu again after health check completes
      await showMenu(url);
      break;
    case 'linkCheck':
      await runLinkChecker(url);
      // Show menu again after link check completes
      await showMenu(url);
      break;
    case 'exit':
      console.log(chalk.blue('Thank you for using Webpage Health Checker!'));
      process.exit(0);
      break;
  }
}

/**
 * Runs the web health check
 * @param {string} url - The URL to check
 */
async function runWebHealthCheck(url) {
  const spinner = ora('Running webpage health check...').start();
  
  try {
    // Run health check
    const results = await runHealthCheck(url, 'all');
    
    spinner.succeed('Health check completed');
    
    // Display results
    console.log('\n' + chalk.bold.blue('Webpage Health Check Results:'));
    
    // Display results for each module
    Object.entries(results).forEach(([moduleName, moduleResults]) => {
      console.log(chalk.bold.cyan(`${moduleName}:`));
      
      moduleResults.forEach(result => {
        const icon = result.status === 'pass' 
          ? chalk.green('✓') 
          : result.status === 'fail' 
            ? chalk.red('✗') 
            : chalk.yellow('⚠');
            
        console.log(`  ${icon} ${result.test}: ${result.message}`);
      });
      
      console.log('\n');
    });
    
    // Summary
    const totalTests = Object.values(results).flat().length;
    const passedTests = Object.values(results).flat().filter(r => r.status === 'pass').length;
    const failedTests = Object.values(results).flat().filter(r => r.status === 'fail').length;
    const warningTests = Object.values(results).flat().filter(r => r.status === 'warning').length;
    
    console.log(chalk.bold.blue('Summary:'));
    console.log(`Total tests: ${totalTests}`);
    console.log(`Passed: ${chalk.green(passedTests)}`);
    console.log(`Failed: ${chalk.red(failedTests)}`);
    console.log(`Warnings: ${chalk.yellow(warningTests)}`);
    
    console.log('\nPress Enter to continue...');
    await new Promise(resolve => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
    
  } catch (error) {
    spinner.fail();
    console.error(chalk.red(`Error: ${error.message}`));
  }
}

/**
 * Runs the link checker
 * @param {string} url - The URL to check
 */
async function runLinkChecker(url) {
  const spinner = ora('Checking links...').start();
  
  try {
    // Launch browser and navigate to the URL
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Extract links with improved detection for complex DOM structures
    const pageData = {
      links: await page.evaluate(() => {
        const links = [];
        const origin = window.location.origin;
        const path = window.location.pathname;
        
        // Method 1: Use DOM API to get links (standard approach)
        const anchors = Array.from(document.querySelectorAll('a'));
        for (const a of anchors) {
          let href = a.href || a.getAttribute('href') || '';
          
          // Skip empty, javascript, mailto and tel links
          if (!href || 
              href === '#' || 
              href.startsWith('javascript:') || 
              href.startsWith('mailto:') || 
              href.startsWith('tel:')) {
            continue;
          }
          
          // Make relative URLs absolute
          if (href.startsWith('/') && !href.startsWith('//')) {
            href = origin + href;
          } else if (!href.startsWith('http') && !href.startsWith('//')) {
            // Handle relative paths without leading slash
            const basePath = path.substring(0, path.lastIndexOf('/') + 1);
            href = origin + basePath + href;
          }
          
          links.push({
            href: href,
            text: a.textContent.trim(),
            rel: a.getAttribute('rel'),
            source: 'dom'
          });
        }
        
        // Method 2: Use regex on raw HTML to find href attributes (backup approach)
        const html = document.documentElement.outerHTML;
        const hrefRegex = /href=[\"']([^\"']+)[\"']/gi;
        let match;
        
        const foundUrls = new Set(links.map(l => l.href)); // Track URLs we've already found
        
        while ((match = hrefRegex.exec(html)) !== null) {
          let href = match[1];
          
          // Skip empty, javascript, mailto and tel links
          if (!href || 
              href === '#' || 
              href.startsWith('javascript:') || 
              href.startsWith('mailto:') || 
              href.startsWith('tel:')) {
            continue;
          }
          
          // Make relative URLs absolute
          if (href.startsWith('/') && !href.startsWith('//')) {
            href = origin + href;
          } else if (!href.startsWith('http') && !href.startsWith('//')) {
            // Handle relative paths without leading slash
            const basePath = path.substring(0, path.lastIndexOf('/') + 1);
            href = origin + basePath + href;
          }
          
          // Only add if we haven't found this URL already
          if (!foundUrls.has(href)) {
            foundUrls.add(href);
            links.push({
              href: href,
              text: '',  // We don't have text context from regex
              rel: null, // We don't have rel attribute from regex
              source: 'regex'
            });
          }
        }
        
        // Method 3: Look specifically for the example link pattern
        const specificLinkRegex = /href=\"([^\"]+)\"[^>]*?class=\"[^\"]*?group flex[^\"]*?\"/gi;
        while ((match = specificLinkRegex.exec(html)) !== null) {
          let href = match[1];
          
          // Skip empty, javascript, mailto and tel links
          if (!href || 
              href === '#' || 
              href.startsWith('javascript:') || 
              href.startsWith('mailto:') || 
              href.startsWith('tel:')) {
            continue;
          }
          
          // Make relative URLs absolute
          if (href.startsWith('/') && !href.startsWith('//')) {
            href = origin + href;
          } else if (!href.startsWith('http') && !href.startsWith('//')) {
            // Handle relative paths without leading slash
            const basePath = path.substring(0, path.lastIndexOf('/') + 1);
            href = origin + basePath + href;
          }
          
          // Only add if we haven't found this URL already
          if (!foundUrls.has(href)) {
            foundUrls.add(href);
            links.push({
              href: href,
              text: 'Special link',  // Placeholder
              rel: null,
              source: 'specific-pattern'
            });
          }
        }
        
        console.log(`Found ${links.length} links (${links.filter(l => l.source === 'dom').length} from DOM, ${links.filter(l => l.source === 'regex').length} from regex, ${links.filter(l => l.source === 'specific-pattern').length} from specific pattern)`);
        
        return links;
      })
    };
    
    // Close browser
    await browser.close();
    
    spinner.text = 'Testing links (this may take a while)...';
    
    // Import the link checker module dynamically
    const { default: checkLinks } = await import('../modules/linkChecker.js');
    
    // Check links
    const results = await checkLinks(null, pageData);
    
    // Extract working and not working links from the results
    const workingLinks = results[0].details.links;
    const notWorkingLinks = results[1].details.links;
    
    spinner.succeed(`Link check completed: ${workingLinks.length} working, ${notWorkingLinks.length} not working`);
    
    // Display results
    console.log('\n' + chalk.bold.blue('Link Check Results:'));
    console.log(chalk.gray(`URL: ${url}`));
    console.log(chalk.gray(`Total Links: ${workingLinks.length + notWorkingLinks.length}`));
    console.log('\n');
    
    // Working links
    console.log(chalk.bold.green(`Working Links (${workingLinks.length}):`));
    if (workingLinks.length > 0) {
      console.log(chalk.gray('URL | Status | Redirects To'));
      console.log(chalk.gray('--------------------------------------------------'));
      
      workingLinks.forEach(link => {
        console.log(`${link.url.substring(0, 50)}${link.url.length > 50 ? '...' : ''} | ${chalk.green(link.status)} ${link.redirectUrl ? `| → ${link.redirectUrl.substring(0, 30)}...` : ''}`);
      });
    } else {
      console.log(chalk.yellow('No working links found.'));
    }
    
    console.log('\n');
    
    // Not working links
    console.log(chalk.bold.red(`Not Working Links (${notWorkingLinks.length}):`));
    if (notWorkingLinks.length > 0) {
      console.log(chalk.gray('URL | Error'));
      console.log(chalk.gray('--------------------------------------------------'));
      
      notWorkingLinks.forEach(link => {
        console.log(`${link.url.substring(0, 50)}${link.url.length > 50 ? '...' : ''} | ${chalk.red(link.error)}`);
      });
    } else {
      console.log(chalk.green('All links are working!'));
    }
    
    console.log('\nPress Enter to continue...');
    await new Promise(resolve => {
      process.stdin.once('data', () => {
        resolve();
      });
    });
    
  } catch (error) {
    spinner.fail();
    console.error(chalk.red(`Error: ${error.message}`));
  }
}
