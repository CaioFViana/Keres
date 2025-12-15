import * as fs from 'fs';
import * as path from 'path';

// Helper to flatten a nested object into dot-separated keys
function flattenObject(obj: Record<string, any>, prefix = ''): Set<string> {
  let keys = new Set<string>();
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        flattenObject(obj[key], newKey).forEach(k => keys.add(k));
      } else {
        keys.add(newKey);
      }
    }
  }
  return keys;
}

// Helper to sort a JSON object by its top-level keys
function sortObjectKeys(obj: Record<string, any>): Record<string, any> {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObject: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedObject[key] = obj[key];
  }
  return sortedObject;
}

// Helper to read and parse a JSON file
function readJsonFile(filePath: string): Record<string, any> {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error: any) {
    console.error(`❌ Error reading or parsing ${filePath}:`, error.message);
    process.exit(1);
  }
}

// Helper to write data to a JSON file (sorted)
function writeJsonFile(filePath: string, data: Record<string, any>) {
  try {
    const sortedData = sortObjectKeys(data);
    fs.writeFileSync(filePath, JSON.stringify(sortedData, null, 2) + '\n', 'utf8');
  } catch (error: any) {
    console.error(`❌ Error writing to ${filePath}:`, error.message);
    process.exit(1);
  }
}

async function auditLocales() {
  const clientSrcPath = path.resolve(process.cwd(), 'src');
  const localesPath = path.join(clientSrcPath, 'locales');

  let hasErrors = false;

  // --- Step 1: Read, Sort, and Write all locale JSON files ---
  const localeFiles = fs.readdirSync(localesPath).filter(file => file.endsWith('.json'));
  if (localeFiles.length === 0) {
    console.warn('⚠️ No locale JSON files found.');
    return;
  }

  const allLocalesContent: { [key: string]: Record<string, any> } = {};
  const allLocaleKeysFlattened: { [key: string]: Set<string> } = {};

  console.log('🔄 Sorting locale files...');
  for (const file of localeFiles) {
    const filePath = path.join(localesPath, file);
    const data = readJsonFile(filePath);
    allLocalesContent[file] = data; // Store original for cross-locale validation
    writeJsonFile(filePath, data); // Write back sorted content
    console.log(`✅ Sorted and wrote to ${file}`);
  }
  console.log('✅ Locale files sorted.');

  // Reload flattened keys after sorting and writing
  for (const file of localeFiles) {
    const filePath = path.join(localesPath, file);
    const data = readJsonFile(filePath);
    allLocaleKeysFlattened[file] = flattenObject(data);
  }

  // --- Step 2: Extract translation keys from TS/TSX files ---
  const tsFiles: string[] = [];
  const walkDir = (dir: string) => {
    fs.readdirSync(dir).forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        walkDir(filePath);
      } else if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        tsFiles.push(filePath);
      }
    });
  };
  walkDir(clientSrcPath);

  const extractedKeys = new Set<string>();
  const tKeyRegex = /\bt\(['"]([a-zA-Z0-9._-]+)['"]\)/g;

  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    let match;
    while ((match = tKeyRegex.exec(content)) !== null) {
      extractedKeys.add(match[1]);
    }
  }

  // --- Step 3: Validate Extracted Keys against all Locale Files ---
  console.log('\n🔄 Validating extracted keys against locale files...');
  for (const key of extractedKeys) {
    for (const localeFile in allLocaleKeysFlattened) {
      if (!allLocaleKeysFlattened[localeFile].has(key)) {
        console.error(`❌ Missing key '${key}' in locale file '${localeFile}' (found in TS/TSX files)`);
        hasErrors = true;
      }
    }
  }
  if (!hasErrors) {
    console.log('✅ All extracted keys are present in all locale files.');
  }

  // --- Step 4: Validate Cross-Locale Consistency (keys in one locale missing in another) ---
  console.log('\n🔄 Validating cross-locale consistency...');
  const allUniqueLocaleKeys = new Set<string>();
  for (const localeFile in allLocaleKeysFlattened) {
    allLocaleKeysFlattened[localeFile].forEach(key => allUniqueLocaleKeys.add(key));
  }

  for (const uniqueKey of allUniqueLocaleKeys) {
    for (const localeFile in allLocaleKeysFlattened) {
      if (!allLocaleKeysFlattened[localeFile].has(uniqueKey)) {
        console.error(`❌ Missing key '${uniqueKey}' in locale file '${localeFile}' (present in other locale files)`);
        hasErrors = true;
      }
    }
  }
  if (!hasErrors) {
    console.log('✅ All locale files have consistent keys.');
  }


  if (hasErrors) {
    console.error('\n🚫 Some translation key issues were found.');
    process.exit(1);
  } else {
    console.log('\n✅ All translation keys are correctly audited and consistent.');
  }
}

auditLocales().catch(error => {
  console.error('An unexpected error occurred during locale auditing:', error);
  process.exit(1);
});
