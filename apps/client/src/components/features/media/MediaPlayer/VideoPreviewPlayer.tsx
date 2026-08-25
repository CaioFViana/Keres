import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

interface VideoPreviewPlayerProps {
  uri: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A video player with the platform's native controls (play/pause, scrubbing, full
 * screen). It lives in a component of its own, and not inline on the detail screen, because
 * `useVideoPlayer` is a hook: it can only be called unconditionally, and video is only one of the
 * three possible media types there.
 */
const VideoPreviewPlayer: React.FC<VideoPreviewPlayerProps> = ({ uri, style }) => {
  // Memoized so the player is not recreated on every render of this component - only when the
  // file actually changes.
  const source = useMemo(() => ({ uri }), [uri]);
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
  });

  return (
    <VideoView
      player={player}
      style={[styles.video, style]}
      nativeControls
      contentFit="contain"
      allowsFullscreen
      allowsPictureInPicture
    />
  );
};

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: '100%',
  },
});

export default VideoPreviewPlayer;
