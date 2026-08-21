// Leaf route for `/app`, the path the API uses when it co-hosts this export.
// Without it, expo-router's web build shows its unmatched/"page could not be found"
// screen because the URL is `/app` and the only leaf was `/` (see app/index.tsx).
// `_layout.tsx` still renders <App />; this file exists only so that URL matches.
export default function HostedAppRoute() {
  return null;
}
