/**
 * Legal OS Synthetic Advocate Testing Agent - Human Action Simulator
 * Simulates authentic human interactions (natural typing speeds, smooth clicking, human pauses)
 */

const path = require('path');
const fs = require('fs');

/**
 * Natural random delay helper
 */
function randomDelay(min = 300, max = 800) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Human-like text typing into input fields
 */
async function humanType(page, selector, text, options = {}) {
  const { minDelay = 20, maxDelay = 60, clearFirst = true } = options;
  const element = typeof selector === 'string' ? page.locator(selector).first() : selector;
  
  await element.scrollIntoViewIfNeeded();
  await element.click();
  
  if (clearFirst) {
    await element.fill('');
  }
  
  for (const char of text) {
    await page.keyboard.type(char, { delay: Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay });
  }
  await randomDelay(150, 300);
}

/**
 * Human-like button/link clicking with hover delay
 */
async function humanClick(page, selector) {
  const element = typeof selector === 'string' ? page.locator(selector).first() : selector;
  await element.scrollIntoViewIfNeeded();
  await element.hover();
  await randomDelay(100, 250);
  await element.click();
  await randomDelay(200, 500);
}

/**
 * Dropdown selection simulator
 */
async function humanSelect(page, selector, value) {
  const element = typeof selector === 'string' ? page.locator(selector).first() : selector;
  await element.scrollIntoViewIfNeeded();
  await element.selectOption(value);
  await randomDelay(200, 400);
}

/**
 * Human pause between operations
 */
async function humanPause(page, minMs = 400, maxMs = 900) {
  await page.waitForTimeout(Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs);
}

/**
 * Step screenshot capture for diagnostic report
 */
async function captureStepScreenshot(page, stepId, outputDir) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const filename = `${stepId}_${Date.now()}.png`;
  const filePath = path.join(outputDir, filename);
  await page.screenshot({ path: filePath, fullPage: false });
  return filename;
}

module.exports = {
  randomDelay,
  humanType,
  humanClick,
  humanSelect,
  humanPause,
  captureStepScreenshot
};
