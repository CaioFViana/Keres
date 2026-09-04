import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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
          <TouchableOpacity
            style={styles.row}
            onPress={() => choose(null)}
            accessibilityRole="button"
          >
            <Ionicons
              name={activeArcId ? 'ellipse-outline' : 'checkmark-circle'}
              size={22}
              color={colors.primary}
            />
            <Text style={[styles.label, { color: colors.text }]}>
              {t('all_arcs', { arcs: vocab.term('Arc', true) })}
            </Text>
          </TouchableOpacity>
          {arcs.map((arc) => (
            <TouchableOpacity
              key={arc.id}
              style={styles.row}
              onPress={() => choose(arc.id)}
              accessibilityRole="button"
            >
              <Ionicons
                name={activeArcId === arc.id ? 'checkmark-circle' : 'ellipse-outline'}
                size={22}
                color={arc.color || colors.primary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>{arc.title}</Text>
                {arc.isDefault ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {t('arc_default_badge')}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
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
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ArcPickerModal;
