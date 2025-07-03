#!/usr/bin/env node

const { exec } = require('child_process');
const { promisify } = require('util');
const ghpages = require('gh-pages');
const execAsync = promisify(exec);

// Colors for console output
const colors = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function runCommand(command, errorMessage) {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stdout) log(stdout);
    if (stderr) log(stderr, colors.yellow);
    return true;
  } catch (error) {
    log(`❌ ${errorMessage}`, colors.red);
    log(error.message, colors.red);
    return false;
  }
}

function publishToGitHubPages() {
  return new Promise((resolve, reject) => {
    log('📦 Publishing to GitHub Pages...', colors.blue);
    ghpages.publish('public', {
      branch: 'gh-pages',
      message: `Update: ${new Date().toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })}`,
    }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  try {
    log('🚀 Starting publish process...', colors.blue);

    // Check for changes in public directory
    const { stdout: status } = await execAsync('git status --porcelain public/');
    if (status) {
      log('📦 Changes detected in public directory, committing...', colors.blue);
      const timestamp = new Date().toLocaleString('en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });

      // Add and commit changes
      await runCommand('git add public/', 'Failed to stage changes');
      await runCommand(`git commit -m "Update public: ${timestamp}"`, 'Failed to commit changes');
      
      // Push changes to main branch
      log('📤 Pushing changes to GitHub...', colors.blue);
      await runCommand('git push origin main', 'Failed to push changes');
      
      log('✅ Changes pushed successfully!', colors.green);
    } else {
      log('✨ No changes to commit in public directory', colors.green);
    }

    // Deploy to GitHub Pages
    await publishToGitHubPages();
    log('✅ Successfully published to GitHub Pages!', colors.green);
    log('🌎 Your site will be available at: https://[username].github.io/gamble-site', colors.green);
    log('Note: It may take a few minutes for the changes to be visible', colors.yellow);

  } catch (error) {
    log('❌ Publish process failed', colors.red);
    log(error.message, colors.red);
    process.exit(1);
  }
}

main(); 