import type { DrawerContentComponentProps } from '@react-navigation/drawer';
import { DrawerContentScrollView } from '@react-navigation/drawer';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ScrollView } from 'react-native';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import type { GuideDrawerId } from '../../../../guides/types';
import {
  registerGuideDrawer,
  unregisterGuideDrawer,
} from '../../../../navigation/drawerGuideRegistry';
import { useTheme } from '../../../../theme';
import { AnchoredDrawerItemList } from './AnchoredDrawerItemList';

export const DRAWER_MIN_WIDTH = 280;
export const DRAWER_DEFAULT_WIDTH = 280;
export const DRAWER_MAX_WIDTH = 520;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

export function useResizableDrawerWidth(viewportWidth: number) {
  const maximumWidth = Math.max(
    DRAWER_MIN_WIDTH,
    Math.min(DRAWER_MAX_WIDTH, Math.floor(viewportWidth * 0.5)),
  );
  const [drawerWidth, setDrawerWidth] = useState(DRAWER_DEFAULT_WIDTH);

  useEffect(() => {
    setDrawerWidth((current) => clamp(current, DRAWER_MIN_WIDTH, maximumWidth));
  }, [maximumWidth]);

  return { drawerWidth, setDrawerWidth, maximumWidth };
}

interface ResizableDrawerContentProps extends DrawerContentComponentProps {
  drawerWidth: number;
  maximumWidth: number;
  onDrawerWidthChange: (width: number) => void;
  resizable: boolean;
  /** Which navigator this drawer belongs to; keys the tour anchors and the guide registry. */
  drawerId: GuideDrawerId;
}

const ResizableDrawerContent: React.FC<ResizableDrawerContentProps> = ({
  drawerWidth,
  maximumWidth,
  onDrawerWidthChange,
  resizable,
  drawerId,
  ...drawerProps
}) => {
  const { colors } = useTheme();
  const currentWidthRef = useRef(drawerWidth);
  const dragStartWidthRef = useRef(drawerWidth);
  const scrollRef = useRef<ScrollView | null>(null);
  const containerRef = useRef<View | null>(null);
  const scrollOffsetRef = useRef(0);

  useEffect(() => {
    currentWidthRef.current = drawerWidth;
  }, [drawerWidth]);

  // The guide host lives outside the drawer, so the drawer publishes the handle the tours
  // drive: navigation for opening, the scroll view for scrolling to a group.
  useEffect(() => {
    registerGuideDrawer(drawerId, {
      navigation: drawerProps.navigation,
      scrollTo: (y: number) => scrollRef.current?.scrollTo({ y, animated: true }),
      getScrollOffset: () => scrollOffsetRef.current,
      // The scroll view starts at the container's top edge, so the container's window Y
      // is the scroll view's window Y - measured off the View, which types the call.
      measureScrollWindowY: () =>
        new Promise((resolve) => {
          const container = containerRef.current;
          if (!container) {
            resolve(null);
            return;
          }
          try {
            container.measureInWindow((_x, y) => resolve(y));
          } catch {
            resolve(null);
          }
        }),
    });
    return () => {
      unregisterGuideDrawer(drawerId);
    };
  }, [drawerId, drawerProps.navigation]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => resizable,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          resizable && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderGrant: () => {
          dragStartWidthRef.current = currentWidthRef.current;
        },
        onPanResponderMove: (_, gestureState) => {
          onDrawerWidthChange(
            clamp(dragStartWidthRef.current + gestureState.dx, DRAWER_MIN_WIDTH, maximumWidth),
          );
        },
        onPanResponderTerminationRequest: () => false,
      }),
    [maximumWidth, onDrawerWidthChange, resizable],
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
      // SafeAreaWrapper already reserves the window's insets for the whole application. The
      // DrawerContentScrollView would add those same insets again, leaving the menu's first item further from
      // the top than the last one is from the bottom.
      paddingBottom: 12,
      paddingTop: 12,
    },
    scrollView: {
      // The handle overlaps the drawer's right edge. Reserving the same width for the ScrollView keeps its
      // scrollbar visible, beside the handle, rather than behind it.
      marginRight: resizable ? 10 : 0,
    },
    resizeHandle: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      position: 'absolute',
      right: 0,
      top: 0,
      width: 10,
      zIndex: 10,
      ...(Platform.OS === 'web' ? ({ cursor: 'col-resize', userSelect: 'none' } as any) : {}),
    },
    resizeIndicator: {
      backgroundColor: colors.border,
      borderRadius: 1,
      height: '100%',
      opacity: 0.45,
      width: 2,
    },
  });

  return (
    <View ref={containerRef} style={styles.container}>
      <DrawerContentScrollView
        {...drawerProps}
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
      >
        <AnchoredDrawerItemList
          state={drawerProps.state}
          navigation={drawerProps.navigation}
          descriptors={drawerProps.descriptors}
          drawerId={drawerId}
        />
      </DrawerContentScrollView>
      {resizable && (
        <View style={styles.resizeHandle} {...panResponder.panHandlers}>
          <View style={styles.resizeIndicator} />
        </View>
      )}
    </View>
  );
};

export default ResizableDrawerContent;
