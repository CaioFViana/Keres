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

// Helper to remove a nested key from an object given its dot-separated path
function removeKeyFromObject(obj: Record<string, any>, keyPath: string): boolean {
  const parts = keyPath.split('.');
  let current: Record<string, any> | undefined = obj;
  let parent: Record<string, any> | undefined;
  let lastPart: string = '';

  for (let i = 0; i < parts.length; i++) {
    lastPart = parts[i];
    if (current === undefined || typeof current !== 'object' || Array.isArray(current)) {
      return false; // Path does not exist or is not an object
    }
    if (i < parts.length - 1) {
      parent = current;
      current = current[lastPart];
    }
  }

  if (current && Object.prototype.hasOwnProperty.call(current, lastPart)) {
    delete current[lastPart];
    // Clean up empty parent objects if necessary (optional, but good practice)
    if (parent && Object.keys(current).length === 0) {
      delete parent[lastPart]; // This is problematic if 'lastPart' is not the key in parent
      // A more robust cleanup would involve recursively checking and deleting empty parents
    }
    return true;
  }
  return false;
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
  const clientSrcPath = path.join(__dirname, '..', 'src');
  const localesPath = path.join(clientSrcPath, 'locales');

  // Parse command-line arguments
  const args = process.argv.slice(2);
  const forceRemoveUnused = args.includes('--force');

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

  // --- Step 2: Extract translation keys from TS/TSX files and entityFields.ts ---
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

  // Extract keys from entityFields.ts
  const entityFieldsPath = path.join(__dirname, '..', '..', '..', 'packages', 'shared', 'metadata', 'entityFields.ts');
  try {
    const entityFieldsContent = fs.readFileSync(entityFieldsPath, 'utf8');
    const labelKeyRegex = /label: ['"]([a-zA-Z0-9._-]+)['"](,|)/g;
    let match;
    while ((match = labelKeyRegex.exec(entityFieldsContent)) !== null) {
      extractedKeys.add(match[1]);
    }
  } catch (error: any) {
    console.warn(`⚠️ Could not extract label keys from ${entityFieldsPath}:`, error.message);
    // Do not exit, just warn, as this file might not always exist or parse perfectly in all contexts.
  }


  // --- Step 3: Validate Extracted Keys against all Locale Files ---
  console.log('\n🔄 Validating extracted keys against locale files...');
  for (const key of extractedKeys) {
    for (const localeFile in allLocaleKeysFlattened) {
      if (!allLocaleKeysFlattened[localeFile].has(key)) {
        console.error(`❌ Missing key '${key}' in locale file '${localeFile}' (found in TS/TSX files or entityFields.ts)`);
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

  // --- Step 5: Detect and Optionally Remove Unused Translations ---
  console.log('\n🔄 Detecting unused translations...');
  const unusedKeys = new Set<string>();
  let unusedTranslationsFound = false;
  for (const uniqueKey of allUniqueLocaleKeys) {
    if (!extractedKeys.has(uniqueKey)) {
      unusedKeys.add(uniqueKey);
    }
  }

  if (unusedKeys.size > 0) {
    unusedTranslationsFound = true;
    if (forceRemoveUnused) {
      console.log('🗑️ --force flag detected. Removing unused translation keys...');
      for (const localeFile in allLocalesContent) {
        let fileModified = false;
        for (const unusedKey of unusedKeys) {
          if (removeKeyFromObject(allLocalesContent[localeFile], unusedKey)) {
            console.log(`   - Removed '${unusedKey}' from '${localeFile}'`);
            fileModified = true;
          }
        }
        if (fileModified) {
          writeJsonFile(path.join(localesPath, localeFile), allLocalesContent[localeFile]);
          console.log(`✅ Updated '${localeFile}' with unused keys removed.`);
        }
      }
      // Since unused keys were removed, they don't count as an error for process.exit(1)
    } else {
      for (const unusedKey of unusedKeys) {
        console.warn(`⚠️ Unused translation key: '${unusedKey}' (present in locale files but not used in code)`);
      }
      hasErrors = true; // Only set hasErrors if not forced removal
    }
  } else {
    console.log('✅ No unused translations found.');
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
