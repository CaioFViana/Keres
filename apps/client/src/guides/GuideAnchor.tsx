import React from 'react';
import { View, type ViewProps } from 'react-native';
import { screenAnchorId } from './anchorRegistry';
import { useGuideAnchor } from './useGuideAnchor';

/** Either the id as the tour's steps write it, or the screen and the part of it that `screenAnchorId` joins. */
type GuideAnchorProps = ViewProps &
  ({ id: string; screen?: never; part?: never } | { screen: string; part: string; id?: never });

/**
 * A region of a screen the guided tour can point at. It is a plain `View` that registers itself under
 * `screen:<Screen>:<part>` (or the given `id`) and unregisters when it leaves; `collapsable` stays off
 * because Android flattens the view away otherwise, and a flattened view cannot be measured.
 */
const GuideAnchor: React.FC<GuideAnchorProps> = ({ id, screen, part, ...viewProps }) => {
  const ref = useGuideAnchor(id ?? screenAnchorId(screen as string, part as string));
  return <View {...viewProps} ref={ref} collapsable={false} />;
};

export default GuideAnchor;
