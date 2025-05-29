#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { runHealthCheck } from './src/healthChecker.js';
import { showMenu } from './src/menuSystem.js';

const program = new Command();

// Configure CLI
program
  .name('webpage-health')
  .description('CLI tool to check webpage health and SEO')
  .version('1.0.0')
  .argument('<url>', 'URL of the webpage to check')
  .option('-o, --output <type>', 'Output format (console, json)', 'console')
  .option('-m, --modules <modules>', 'Specific modules to run (comma separated)', 'all')
  .option('-d, --direct', 'Run health check directly without showing menu', false)
  .action(async (url, options) => {
    // Validate URL
    try {
      new URL(url);
    } catch (error) {
      console.error(chalk.red(`Invalid URL: ${url}`));
      process.exit(1);
    }
    
    // If direct option is specified, run health check directly
    if (options.direct) {
      const spinner = ora('Running webpage health check...').start();
      
      try {
        // Parse modules
        const modules = options.modules === 'all' 
          ? 'all' 
          : options.modules.split(',').map(m => m.trim());
        
        // Run health check
        const results = await runHealthCheck(url, modules);
        
        spinner.succeed('Health check completed');
        
        // Output results
        if (options.output === 'json') {
          console.log(JSON.stringify(results, null, 2));
        } else {
          console.log('\n' + chalk.bold.blue('Webpage Health Check Results:'));
          console.log(chalk.gray(`URL: ${url}`));
          console.log(chalk.gray(`Date: ${new Date().toISOString()}`));
          console.log('\n');
          
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
        }
      } catch (error) {
        spinner.fail();
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
      }
    } else {
      // Show interactive menu
      await showMenu(url);
    }
  });

program.parse(process.argv);
