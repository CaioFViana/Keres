import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import MapIcon from '@/src/components/common/display/MapIcon/MapIcon';
import type { StoryArcSelect } from '@/src/db/schema';
import { useTheme } from '@/src/theme';
import { useStoryVocabulary } from '@/src/vocabulary/useStoryVocabulary';

interface Props {
  visible: boolean;
  arcs: StoryArcSelect[];
  activeArcId: string | null;
  onSelect: (arcId: string | null) => void;
  onClose: () => void;
}

const ArcPickerModal: React.FC<Props> = ({ visible, arcs, activeArcId, onSelect, onClose }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const vocab = useStoryVocabulary();
  const { height: screenHeight } = useWindowDimensions();

  const choose = (arcId: string | null) => {
    onSelect(arcId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>
            {t('arc_picker_title', { arcs: vocab.term('Arc', true) })}
          </Text>
          <ScrollView
            style={{ maxHeight: Math.min(screenHeight * 0.6, 480) }}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity
              style={styles.row}
              onPress={() => choose(null)}
              accessibilityRole="button"
              testID="arc-picker-row-all"
            >
              <MapIcon
                name="library"
                size={22}
                color={colors.primary}
                testID="arc-picker-icon-all"
              />
              <Text style={[styles.label, { color: colors.text }]}>
                {t('all_arcs', { arcs: vocab.term('Arc', true) })}
              </Text>
              {!activeArcId && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={colors.primary}
                  testID="arc-picker-check-all"
                />
              )}
            </TouchableOpacity>
            {arcs.map((arc) => {
              const color = arc.color || colors.primary;
              const selected = activeArcId === arc.id;
              return (
                <TouchableOpacity
                  key={arc.id}
                  style={styles.row}
                  onPress={() => choose(arc.id)}
                  accessibilityRole="button"
                  testID={`arc-picker-row-${arc.id}`}
                >
                  <MapIcon
                    name={arc.icon || 'library'}
                    size={22}
                    color={color}
                    testID={`arc-picker-icon-${arc.id}`}
                  />
                  <Text style={[styles.label, { color: colors.text }]}>{arc.title}</Text>
                  {selected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.primary}
                      testID={`arc-picker-check-${arc.id}`}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    borderRadius: 12,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ArcPickerModal;
