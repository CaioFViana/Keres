import {
  DrawerContentComponentProps,
  DrawerContentScrollView,
  DrawerItemList,
} from '@react-navigation/drawer';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '../../../../theme';

export const DRAWER_MIN_WIDTH = 280;
export const DRAWER_DEFAULT_WIDTH = 280;
export const DRAWER_MAX_WIDTH = 520;

const clamp = (value: number, minimum: number, maximum: number) => (
  Math.min(Math.max(value, minimum), maximum)
);

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
}

const ResizableDrawerContent: React.FC<ResizableDrawerContentProps> = ({
  drawerWidth,
  maximumWidth,
  onDrawerWidthChange,
  resizable,
  ...drawerProps
}) => {
  const { colors } = useTheme();
  const currentWidthRef = useRef(drawerWidth);
  const dragStartWidthRef = useRef(drawerWidth);

  useEffect(() => {
    currentWidthRef.current = drawerWidth;
  }, [drawerWidth]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => resizable,
    onMoveShouldSetPanResponder: (_, gestureState) => (
      resizable && Math.abs(gestureState.dx) > Math.abs(gestureState.dy)
    ),
    onPanResponderGrant: () => {
      dragStartWidthRef.current = currentWidthRef.current;
    },
    onPanResponderMove: (_, gestureState) => {
      onDrawerWidthChange(clamp(
        dragStartWidthRef.current + gestureState.dx,
        DRAWER_MIN_WIDTH,
        maximumWidth,
      ));
    },
    onPanResponderTerminationRequest: () => false,
  }), [maximumWidth, onDrawerWidthChange, resizable]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flexGrow: 1,
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
      ...(Platform.OS === 'web' ? { cursor: 'col-resize', userSelect: 'none' } as any : {}),
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
    <View style={styles.container}>
      <DrawerContentScrollView {...drawerProps} contentContainerStyle={styles.content}>
        <DrawerItemList {...drawerProps} />
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
