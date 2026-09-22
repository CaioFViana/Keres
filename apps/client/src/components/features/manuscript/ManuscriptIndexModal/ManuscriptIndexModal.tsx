import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Button from '@/src/components/common/controls/Button/Button';
import FormActions from '@/src/components/common/controls/FormActions/FormActions';
import ResponsiveModal from '@/src/components/layout/ResponsiveModal/ResponsiveModal';
import { useTheme } from '@/src/theme';
import type { ManuscriptSection } from '@keres/shared';

interface ManuscriptIndexModalProps {
  visible: boolean;
  /** The same sections the manuscript FlatList renders, so every mode and filter stays consistent. */
  sections: ManuscriptSection[];
  /** FlatList index of the scene the reader is on, for the highlight. Null when unknown. */
  currentSectionIndex: number | null;
  /** Label for the loose-scenes group; same source as the export heading. */
  looseHeadingLabel: string;
  /** Section index in `sections` to scroll the manuscript list to. */
  onSelectSection: (sectionIndex: number) => void;
  onClose: () => void;
}

interface IndexSceneEntry {
  sectionKey: string;
  sectionIndex: number;
  position: number;
  name: string;
}

interface IndexGroup {
  key: string;
  title: string;
  scenes: IndexSceneEntry[];
}

/**
 * Groups the rendered sections under their chapter headings, in list order. Scenes before
 * any heading (a branching route has no containers at all) stay ungrouped and render flat.
 */
function groupIndexSections(
  sections: ManuscriptSection[],
  looseHeadingLabel: string,
): { leading: IndexSceneEntry[]; groups: IndexGroup[] } {
  const leading: IndexSceneEntry[] = [];
  const groups: IndexGroup[] = [];
  let current: IndexGroup | null = null;
  sections.forEach((section, sectionIndex) => {
    if (section.kind === 'container') {
      current = {
        key: section.key,
        title:
          section.containerType === 'chapter' ? `${section.index}. ${section.name}` : section.name,
        scenes: [],
      };
      groups.push(current);
    } else if (section.kind === 'loose-heading') {
      current = { key: section.key, title: looseHeadingLabel, scenes: [] };
      groups.push(current);
    } else {
      const entry: IndexSceneEntry = {
        sectionKey: section.key,
        sectionIndex,
        position: section.position,
        name: section.scene.name,
      };
      if (current) current.scenes.push(entry);
      else leading.push(entry);
    }
  });
  return { leading, groups };
}

/**
 * The manuscript table of contents: every chapter of the current view, expandable to its
 * scenes, plus an appendix group for loose scenes. Picking a scene reports its section
 * index so the caller can scroll the list to it.
 */
const ManuscriptIndexModal: React.FC<ManuscriptIndexModalProps> = ({
  visible,
  sections,
  currentSectionIndex,
  looseHeadingLabel,
  onSelectSection,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const { leading, groups } = useMemo(
    () => groupIndexSections(sections, looseHeadingLabel),
    [sections, looseHeadingLabel],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: 20 },
        title: { color: colors.text, fontSize: 20, fontWeight: '700' },
        list: { marginTop: 12, marginBottom: 8 },
        chapterRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 10,
          paddingHorizontal: 4,
        },
        chapterTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
        sceneRow: {
          paddingVertical: 9,
          paddingHorizontal: 12,
          marginLeft: 24,
          borderRadius: 8,
        },
        sceneRowLeading: { marginLeft: 0 },
        sceneRowCurrent: { backgroundColor: colors.primaryContainer },
        sceneTitle: { color: colors.text, fontSize: 15 },
        sceneTitleCurrent: { color: colors.onPrimaryContainer, fontWeight: '700' },
        emptyText: { color: colors.textSecondary, fontSize: 15, fontStyle: 'italic', marginTop: 12 },
        closeButton: { backgroundColor: colors.textSecondary },
      }),
    [colors],
  );

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderScene = (entry: IndexSceneEntry, grouped: boolean) => {
    const current = entry.sectionIndex === currentSectionIndex;
    return (
      <TouchableOpacity
        key={entry.sectionKey}
        testID={`manuscript-index-${entry.sectionKey}`}
        style={[
          styles.sceneRow,
          !grouped && styles.sceneRowLeading,
          current && styles.sceneRowCurrent,
        ]}
        onPress={() => onSelectSection(entry.sectionIndex)}
        accessibilityRole="button"
        accessibilityState={{ selected: current }}
      >
        <Text style={[styles.sceneTitle, current && styles.sceneTitleCurrent]}>
          {`${entry.position}. ${entry.name}`}
        </Text>
      </TouchableOpacity>
    );
  };

  const sceneCount =
    leading.length + groups.reduce((total, group) => total + group.scenes.length, 0);

  return (
    <ResponsiveModal visible={visible} onClose={onClose} maxHeight="90%" placement="adaptive">
      <View testID="manuscript-index-modal" style={styles.content}>
        <Text style={styles.title}>{t('manuscript_index_title')}</Text>
        {sceneCount === 0 ? (
          <Text style={styles.emptyText}>{t('manuscript_no_scenes')}</Text>
        ) : (
          <ScrollView style={styles.list}>
            {leading.map((entry) => renderScene(entry, false))}
            {groups.map((group) => {
              const expanded = !collapsed.has(group.key);
              return (
                <View key={group.key}>
                  <TouchableOpacity
                    testID={`manuscript-index-${group.key}`}
                    style={styles.chapterRow}
                    onPress={() => toggleGroup(group.key)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded }}
                  >
                    <Ionicons
                      name={expanded ? 'chevron-down' : 'chevron-forward'}
                      size={20}
                      color={colors.textSecondary}
                    />
                    <Text style={styles.chapterTitle}>{group.title}</Text>
                  </TouchableOpacity>
                  {expanded && group.scenes.map((entry) => renderScene(entry, true))}
                </View>
              );
            })}
          </ScrollView>
        )}
        <FormActions stackOnCompact>
          <Button testID="manuscript-index-close" onPress={onClose} style={styles.closeButton}>
            {t('close')}
          </Button>
        </FormActions>
      </View>
    </ResponsiveModal>
  );
};

export default ManuscriptIndexModal;
