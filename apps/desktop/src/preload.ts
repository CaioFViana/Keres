// Runs with Node access, isolated from the page (contextIsolation: true in main.ts).
// No native bridge is needed yet - expo-sqlite's web build already handles persistence
// (see main.ts). Kept as the extension point for future native integrations (e.g. a real
// "Save As" dialog for ImportExportScreen, in place of the browser download-link fallback).
