import type { TextStyle, ViewStyle } from 'react-native';

/** The frame both scene pickers share: the title, the two tabs and the list they scroll. */
export const scenePickerStyleDefs: {
  title: TextStyle;
  tabs: ViewStyle;
  tab: ViewStyle;
  list: ViewStyle;
} = {
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 12 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6 },
  list: { maxHeight: 380 },
};
