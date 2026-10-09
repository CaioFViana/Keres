import { StyleSheet } from 'react-native';
import { space } from './tokens';

/**
 * The layouts every screen repeats, as shared styles instead of a fresh `{ flexDirection: 'row',
 * alignItems: 'center' }` per file. Compose with the component's own style: `style={[layout.row, styles.x]}`.
 *
 * `flexGrow`/`flexShrink` stand where `flex: 1` would: react-native-web collapses a fixed width under `flex: 0`
 * and this keeps the same behaviour on every platform.
 */
export const layout = StyleSheet.create({
  /** Children side by side, centred on the cross axis. */
  row: { flexDirection: 'row', alignItems: 'center' },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  center: { alignItems: 'center', justifyContent: 'center' },
  /** Takes the room that is left and may shrink: a text next to an icon or a button. */
  fill: { flexGrow: 1, flexShrink: 1 },
});
