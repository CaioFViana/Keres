import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerItem } from '@react-navigation/drawer';
import type { ParamListBase, RouteProp } from '@react-navigation/native';
import { CommonActions, DrawerActions, useLinkBuilder } from '@react-navigation/native';
import React from 'react';
import { View } from 'react-native';
import type { GuideDrawerId } from '../../../../guides/types';
import { drawerAnchorId } from '../../../../guides/anchorRegistry';
import { useGuideAnchor } from '../../../../guides/useGuideAnchor';

interface AnchoredDrawerItemListProps {
  state: DrawerContentComponentProps['state'];
  navigation: DrawerContentComponentProps['navigation'];
  descriptors: DrawerContentComponentProps['descriptors'];
  drawerId: GuideDrawerId;
}

/**
 * `DrawerItemList`, with each entry wrapped in a measurable tour anchor.
 *
 * The press behavior is the library's, line for line: emit `drawerItemPress` (cancellable),
 * otherwise close an already-focused entry or navigate to the tapped one. Every drawer in the
 * app cancels that event to reset its stack to the list, so any drift here silently breaks
 * menu navigation - `navigation.test.tsx` pins the behavior.
 */
export const AnchoredDrawerItemList: React.FC<AnchoredDrawerItemListProps> = ({
  state,
  navigation,
  descriptors,
  drawerId,
}) => {
  const { buildHref } = useLinkBuilder();
  const focusedRoute = state.routes[state.index];
  const focusedDescriptor = descriptors[focusedRoute.key];
  const focusedOptions = focusedDescriptor.options;
  const {
    drawerActiveTintColor,
    drawerInactiveTintColor,
    drawerActiveBackgroundColor,
    drawerInactiveBackgroundColor,
  } = focusedOptions;

  return (
    <>
      {state.routes.map((route, i) => {
        const focused = i === state.index;
        const onPress = () => {
          const event = navigation.emit({
            type: 'drawerItemPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!event.defaultPrevented) {
            navigation.dispatch({
              ...(focused
                ? DrawerActions.closeDrawer()
                : CommonActions.navigate(route.name, route.params)),
              target: state.key,
            });
          }
        };
        const {
          title,
          drawerLabel,
          drawerIcon,
          drawerLabelStyle,
          drawerItemStyle,
          drawerItemTestID,
          drawerAllowFontScaling,
        } = descriptors[route.key].options;
        return (
          <AnchoredDrawerRow key={route.key} anchorId={drawerAnchorId(drawerId, route.name)}>
            <DrawerItem
              route={route as RouteProp<ParamListBase, string>}
              href={buildHref(route.name, route.params)}
              label={
                drawerLabel !== undefined ? drawerLabel : title !== undefined ? title : route.name
              }
              icon={drawerIcon}
              focused={focused}
              activeTintColor={drawerActiveTintColor}
              inactiveTintColor={drawerInactiveTintColor}
              activeBackgroundColor={drawerActiveBackgroundColor}
              inactiveBackgroundColor={drawerInactiveBackgroundColor}
              allowFontScaling={drawerAllowFontScaling}
              labelStyle={drawerLabelStyle}
              style={drawerItemStyle}
              onPress={onPress}
              testID={drawerItemTestID}
            />
          </AnchoredDrawerRow>
        );
      })}
    </>
  );
};

const AnchoredDrawerRow: React.FC<{ anchorId: string; children: React.ReactNode }> = ({
  anchorId,
  children,
}) => {
  const anchorRef = useGuideAnchor(anchorId);
  return (
    <View ref={anchorRef} collapsable={false}>
      {children}
    </View>
  );
};
