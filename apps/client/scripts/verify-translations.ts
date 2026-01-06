import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

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
  let current: Record<string, any> = obj; // Start with the main object
  let parent: Record<string, any> | undefined;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return false; // Current path segment is not an object or is null/array
    }

    if (i === parts.length - 1) { // This is the last part of the path
      if (Object.prototype.hasOwnProperty.call(current, part)) {
        delete current[part];
        return true;
      }
      return false; // Key not found at the end of the path
    } else { // Not the last part, so traverse deeper
      parent = current;
      current = current[part];
      if (current === undefined) {
        return false; // Intermediate path segment does not exist
      }
    }
  }
  return false; // Should not reach here if path has parts
}

// New helper function to extract keys using regex
function extractTranslationKeysFromRegex(fileContent: string): Set<string> {
  const keys = new Set<string>();
  // Regex to find t('key'), t("key"), t(`key`)
  const regex = /\bt\(['"`]([a-zA-Z0-9._-]+)['"`]\)/g;
  let match;
  while ((match = regex.exec(fileContent)) !== null) {
    keys.add(match[1]);
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

/**
 * Extracts translation keys from a TypeScript/TSX file content using AST parsing.
 * Supports t('key'), t("key"), t(`key`), and t('key', { ... }).
 * @param fileContent The content of the file.
 * @returns A Set of extracted translation keys.
 */
function extractTranslationKeysFromAST(fileContent: string): Set<string> {
  const keys = new Set<string>();
  // Use a dummy file name for ts.createSourceFile, it doesn't affect AST parsing
  const sourceFile = ts.createSourceFile('dummy.ts', fileContent, ts.ScriptTarget.Latest, true);

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      let expression = node.expression;
      let isTCall = false;

      // Check for 't('key')'
      if (ts.isIdentifier(expression) && expression.text === 't') {
        isTCall = true;
      }
      // Check for 'i18n.t('key')'
      else if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.name) && expression.name.text === 't') {
        isTCall = true;
      }

      if (isTCall && node.arguments.length > 0) {
        const firstArg = node.arguments[0];

        // Directly extract string literals
        if (ts.isStringLiteral(firstArg) || ts.isNoSubstitutionTemplateLiteral(firstArg)) {
          keys.add(firstArg.text);
        }
        // Extract from template expressions (like `key ${variable}`) - though i18n usually expects plain string keys
        else if (ts.isTemplateExpression(firstArg)) {
          // If it's a template expression without substitutions, it's basically a string literal
          if (firstArg.templateSpans.length === 0) {
            keys.add(firstArg.head.text);
          }
          // If it has substitutions, we can't reliably get a static key, so ignore or warn
          // For simplicity here, we'll ignore dynamic template strings
        }
        // Handle cases where the key might be a variable or property access
        // This is more complex and usually requires type checking, but we can try to find simple cases.
        // For example, if it's an Identifier whose value is a string literal.
        else if (ts.isIdentifier(firstArg)) {
            // This case needs symbol resolution or more advanced flow analysis to get the literal string value.
            // For now, we'll assume direct string literals or template expressions.
            // A common pattern where this fails is `const KEY = 'some_key'; t(KEY);`
            // If we strictly follow the 'string literal' requirement for t() args, then this is outside current scope.
        }
        // This is where 'PropertyAccessExpression' from the previous debug might have come from
        // e.g., t(someObject.key) - we would ignore these for now as they are dynamic keys.
      }
    }
    // Handle JSX expressions (e.g., { expression } in JSX)
    else if (ts.isJsxExpression(node)) {
      if (node.expression) {
        // Recursively visit the expression inside { }
        visit(node.expression);
      }
    }
    // Handle JSX attributes (e.g., <MyComponent prop={expression} />)
    else if (ts.isJsxAttribute(node)) {
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        visit(node.initializer.expression);
      }
    }
    // Explicitly handle BinaryExpression to ensure traversal into its parts, especially in JSX context
    else if (ts.isBinaryExpression(node)) {
        visit(node.left);
        visit(node.right);
    }


    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);
  return keys;
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
  for (const file of tsFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    extractTranslationKeysFromAST(content).forEach(key => {
        extractedKeys.add(key);
    });
    // Add regex extraction for fallback
    extractTranslationKeysFromRegex(content).forEach(key => {
        extractedKeys.add(key);
    });
  }

  // Extract keys from entityFields.ts - using a more robust regex for 'label'
  const entityFieldsPath = path.join(__dirname, '..', '..', '..', 'packages', 'shared', 'metadata', 'entityFields.ts');
  try {
    const entityFieldsContent = fs.readFileSync(entityFieldsPath, 'utf8');
    // This regex looks for 'label: "key"' or 'label: 'key'' in an object-like structure
    const labelKeyRegex = /label:\s*['"]([a-zA-Z0-9._-]+)['"]/g;
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
  /* // BUGGED ATM. Do NOT trust the results of it.
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
  }*/


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