import React, { Children, isValidElement, useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';

/**
 * The row of actions that closes a form, a modal or a detail screen.
 *
 * Every one of these used to be a `flexDirection: 'row'` with `space-between` or `space-around`,
 * which sizes each button to its own text. On a wide window that leaves two small buttons stranded
 * at opposite ends of a very long row, and their widths disagree because "Cancel" is shorter than
 * "Save changes".
 *
 * Here they share the row equally whenever they stay side by side. Screens with long labels on a
 * phone opt into `stackOnCompact` instead of a cramped 50/50 split.
 *
 * The children are wrapped rather than cloned: a button's own `style` prop is often already carrying
 * a colour or a test id, and merging a width into it from outside would be the kind of remote action
 * that is impossible to find later from the button's own file.
 */

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Keeps the buttons at their natural width whatever the space.
   *
   * For rows that are not a form's closing actions - a group of three filters, say - where an equal
   * split would be meaningless.
   */
  natural?: boolean;
  /**
   * Stacks the buttons on a compact screen instead of putting them in a row.
   *
   * For the long-form screens, whose actions are stacked today: "Save changes" and "Delete note"
   * side by side on a phone gives two buttons narrower than their own labels. Each call site keeps
   * whatever it does on a phone now, and only the wide layout changes.
   */
  stackOnCompact?: boolean;
}

function actionChildren(
  children: React.ReactNode,
  prefix = '',
): { child: React.ReactNode; key: string }[] {
  return Children.toArray(children).flatMap((child, index) => {
    const key = `${prefix}/${isValidElement(child) ? (child.key ?? index) : index}`;
    return isValidElement<{ children?: React.ReactNode }>(child) && child.type === React.Fragment
      ? actionChildren(child.props.children, key)
      : [{ child, key }];
  });
}

const FormActions: React.FC<Props> = ({ children, style, natural, stackOnCompact }) => {
  const { isCompact } = useResponsiveLayout();
  const stacked = Boolean(stackOnCompact && isCompact);
  const share = !natural && !stacked;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: stacked ? 'column' : 'row',
          alignItems: 'stretch',
          justifyContent: share ? 'center' : 'space-around',
          gap: 12,
          marginTop: 20,
        },
        /*
         * `flexGrow`/`flexShrink`/`flexBasis` rather than `flex: 1`: on react-native-web the
         * shorthand resolves to a `flex-basis` of 0% that collapses a child which has its own
         * intrinsic width, and the button inside has exactly that.
         */
        share: { flexGrow: 1, flexShrink: 1, flexBasis: 0 },
        /*
         * Force the control to the slot width. `TouchableOpacity` does not always stretch from a
         * column parent alone on native, which left Cancel/Confirm at content width on phones.
         */
        fill: { width: '100%' },
      }),
    [share, stacked],
  );

  return (
    <View testID="form-actions" style={[styles.row, style]}>
      {actionChildren(children).map(({ child, key }, index) => (
        <View
          key={key}
          testID={`form-action-slot-${index}`}
          style={share ? styles.share : undefined}
        >
          <View style={share || stacked ? styles.fill : undefined}>{child}</View>
        </View>
      ))}
    </View>
  );
};

export default FormActions;
