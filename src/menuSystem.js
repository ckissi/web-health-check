import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { runHealthCheck } from './healthChecker.js';
import checkLinks from '../modules/linkChecker.js';
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
        // Get all anchor elements
        const anchors = Array.from(document.querySelectorAll('a'));
        
        return anchors.map(a => {
          // Handle href attribute - some frameworks might not use standard href
          let href = a.href || '';
          
          // If href is empty or just '#', check for other possible href locations
          if (!href || href === '#' || href === 'javascript:void(0)') {
            // Check for href in dataset
            if (a.dataset && a.dataset.href) {
              href = a.dataset.href;
            }
            
            // Check for href in aria-label
            if (!href && a.getAttribute('aria-label')) {
              const ariaLabel = a.getAttribute('aria-label');
              if (ariaLabel && ariaLabel.startsWith('http')) {
                href = ariaLabel;
              }
            }
            
            // Check for nested link in attributes
            if (!href) {
              for (const attr of a.attributes) {
                if (attr.value && attr.value.startsWith('http')) {
                  href = attr.value;
                  break;
                }
              }
            }
          }
          
          // Make relative URLs absolute
          if (href && href.startsWith('/') && !href.startsWith('//')) {
            href = window.location.origin + href;
          }
          
          return {
            href: href,
            text: a.textContent.trim(),
            rel: a.getAttribute('rel'),
            outerHTML: a.outerHTML.substring(0, 500) // Store a snippet of the HTML for debugging
          };
        }).filter(link => link.href && link.href.trim() !== '' && 
                          !link.href.startsWith('javascript:') && 
                          !link.href.startsWith('mailto:') && 
                          !link.href.startsWith('tel:'));
      })
    };
    
    // Close browser
    await browser.close();
    
    spinner.text = 'Testing links (this may take a while)...';
    
    // Check links
    const results = await checkLinks(null, pageData);
    
    spinner.succeed(`Link check completed: ${results.working.length} working, ${results.notWorking.length} not working`);
    
    // Display results
    console.log('\n' + chalk.bold.blue('Link Check Results:'));
    console.log(chalk.gray(`URL: ${url}`));
    console.log(chalk.gray(`Total Links: ${results.working.length + results.notWorking.length}`));
    console.log('\n');
    
    // Working links
    console.log(chalk.bold.green(`Working Links (${results.working.length}):`));
    if (results.working.length > 0) {
      console.log(chalk.gray('URL | Status | Redirects To'));
      console.log(chalk.gray('--------------------------------------------------'));
      
      results.working.forEach(link => {
        console.log(`${link.url.substring(0, 50)}${link.url.length > 50 ? '...' : ''} | ${chalk.green(link.status)} ${link.redirectUrl ? `| → ${link.redirectUrl.substring(0, 30)}...` : ''}`);
      });
    } else {
      console.log(chalk.yellow('No working links found.'));
    }
    
    console.log('\n');
    
    // Not working links
    console.log(chalk.bold.red(`Not Working Links (${results.notWorking.length}):`));
    if (results.notWorking.length > 0) {
      console.log(chalk.gray('URL | Error'));
      console.log(chalk.gray('--------------------------------------------------'));
      
      results.notWorking.forEach(link => {
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
