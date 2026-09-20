import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../../theme';

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
  const { colors } = useTheme();
  const { t } = useTranslation();
  // Memoized so the player is not recreated on every render of this component - only when the
  // file actually changes.
  const source = useMemo(() => ({ uri }), [uri]);
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = false;
  });
  // A container the OS player cannot decode (webm/mkv on iOS) fails asynchronously with
  // status 'error' instead of throwing: without this the preview stays a black box forever.
  const [playbackFailed, setPlaybackFailed] = useState(() => player.status === 'error');
  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status }) => {
      setPlaybackFailed(status === 'error');
    });
    return () => subscription.remove();
  }, [player]);

  if (playbackFailed) {
    return (
      <View style={[styles.video, styles.failed, style]}>
        <Ionicons name="videocam-off-outline" size={48} color={colors.textSecondary} />
        <Text style={[styles.failedText, { color: colors.textSecondary }]}>
          {t('media_preview_unavailable')}
        </Text>
      </View>
    );
  }

  return (
    <VideoView
      player={player}
      style={[styles.video, style]}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      allowsPictureInPicture
    />
  );
};

const styles = StyleSheet.create({
  video: {
    width: '100%',
    height: '100%',
  },
  failed: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 16,
  },
  failedText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default VideoPreviewPlayer;
