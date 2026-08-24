import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import React, { useCallback, useMemo, useState } from 'react';
import type {
  GestureResponderEvent} from 'react-native';
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '../../../../theme';

interface AudioPreviewPlayerProps {
  uri: string;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '0:00';
  }
  const total = Math.floor(seconds);
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Player de áudio.
 *
 * O `expo-audio` não vem com uma interface pronta (diferente do `expo-video`, que tem
 * `VideoView` com controles nativos) - só a API de controle (`play`, `pause`, `seekTo`) e
 * o status de reprodução. A barra de progresso aqui é tocável (`Pressable` medindo a
 * própria largura em `onLayout`) para dar pelo menos a navegação básica que um áudio
 * precisa para ser útil.
 */
const AudioPreviewPlayer: React.FC<AudioPreviewPlayerProps> = ({ uri }) => {
  const { colors } = useTheme();
  const source = useMemo(() => ({ uri }), [uri]);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const [trackWidth, setTrackWidth] = useState(0);

  const togglePlayback = useCallback(() => {
    if (status.playing) {
      player.pause();
      return;
    }
    // Sem isto, tocar de novo depois do fim não faz nada visível - a pessoa acharia que
    // o botão travou.
    if (status.duration > 0 && status.currentTime >= status.duration) {
      player.seekTo(0);
    }
    player.play();
  }, [player, status.playing, status.currentTime, status.duration]);

  const handleSeek = useCallback(
    (event: GestureResponderEvent) => {
      if (!status.isLoaded || status.duration <= 0 || trackWidth <= 0) {
        return;
      }
      const ratio = Math.min(Math.max(event.nativeEvent.locationX / trackWidth, 0), 1);
      player.seekTo(ratio * status.duration);
    },
    [player, status.isLoaded, status.duration, trackWidth],
  );

  const progress = status.duration > 0 ? Math.min(status.currentTime / status.duration, 1) : 0;

  const styles = StyleSheet.create({
    container: {
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
    },
    playButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 20,
    },
    trackWrapper: {
      width: '100%',
    },
    track: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.border,
      overflow: 'hidden',
      justifyContent: 'center',
    },
    trackFill: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    timeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    timeText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
  });

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.playButton}
        onPress={togglePlayback}
        disabled={!status.isLoaded}
      >
        <Ionicons name={status.playing ? 'pause' : 'play'} size={28} color={colors.onPrimary} />
      </TouchableOpacity>
      <View style={styles.trackWrapper}>
        <Pressable
          style={styles.track}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          onPress={handleSeek}
        >
          <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
        </Pressable>
        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{formatTime(status.currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(status.duration)}</Text>
        </View>
      </View>
    </View>
  );
};

export default AudioPreviewPlayer;
