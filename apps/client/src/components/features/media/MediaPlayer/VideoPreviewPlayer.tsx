import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useMemo } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';

interface VideoPreviewPlayerProps {
  uri: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Player de vídeo com os controles nativos da plataforma (play/pausar, arrastar, tela
 * cheia). Fica num componente próprio, e não inline na tela de detalhe, porque
 * `useVideoPlayer` é um hook: só pode ser chamado incondicionalmente, e vídeo é só um dos
 * três tipos de mídia possíveis ali.
 */
const VideoPreviewPlayer: React.FC<VideoPreviewPlayerProps> = ({ uri, style }) => {
  // Memoizado para o player não ser recriado a cada render deste componente - só quando o
  // arquivo de fato muda.
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
