// app/_layout.tsx renders <App /> directly (this project uses React Navigation, not
// file-based routing, for all real navigation - see src/navigation/AppNavigator.tsx) and
// never renders <Slot />, so this route's own output is never actually mounted. It exists
// only because expo-router's web/export build treats an app/ directory with zero leaf
// routes as having nothing to render, showing its built-in "unmatched" screen instead of
// _layout.tsx's tree - even though native/dev builds tolerate the missing route file fine.
export default function Index() {
  return null;
}
