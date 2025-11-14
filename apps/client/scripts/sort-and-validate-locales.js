const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/locales');

function readJsonFile(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    console.error(`Error reading or parsing ${filePath}:`, error.message);
    process.exit(1);
  }
}

function writeJsonFile(filePath, data) {
  try {
    const sortedKeys = Object.keys(data).sort();
    const sortedData = {};
    for (const key of sortedKeys) {
      sortedData[key] = data[key];
    }
    fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 2) + '\n', 'utf8');
    console.log(`Successfully sorted and wrote to ${filePath}`);
  } catch (error) {
    console.error(`Error writing to ${filePath}:`, error.message);
    process.exit(1);
  }
}

function sortAndValidateLocales() {
  const localeFiles = fs.readdirSync(localesDir).filter(file => file.endsWith('.json'));

  if (localeFiles.length === 0) {
    console.warn('No locale JSON files found.');
    return;
  }

  const allLocalesData = {};
  const allUniqueKeys = new Set();

  // Read all locale files and collect all unique keys
  for (const file of localeFiles) {
    const filePath = path.join(localesDir, file);
    const data = readJsonFile(filePath);
    allLocalesData[file] = data;
    for (const key in data) {
      allUniqueKeys.add(key);
    }
  }

  let hasErrors = false;

  // Validate: Check for missing keys in each file
  for (const file of localeFiles) {
    const data = allLocalesData[file];
    const missingKeys = [];
    for (const uniqueKey of allUniqueKeys) {
      if (!(uniqueKey in data)) {
        missingKeys.push(uniqueKey);
      }
    }
    if (missingKeys.length > 0) {
      console.error(`Error: Missing keys in ${file}: ${missingKeys.join(', ')}`);
      hasErrors = true;
    }
  }

  if (hasErrors) {
    console.error('Please add the missing keys to the respective locale files before sorting.');
    process.exit(1);
  }

  // Sort: Write sorted data back to files
  for (const file of localeFiles) {
    const filePath = path.join(localesDir, file);
    writeJsonFile(filePath, allLocalesData[file]);
  }

  console.log('Locale files sorted and validated successfully!');
}

sortAndValidateLocales();
