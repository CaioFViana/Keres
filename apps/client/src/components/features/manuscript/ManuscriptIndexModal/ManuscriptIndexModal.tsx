import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
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
  /** Comment count by scene id; scenes and groups without counts render bare. */
  commentCountsBySceneId?: Record<string, number>;
  /** Section index in `sections` to scroll the manuscript list to. */
  onSelectSection: (sectionIndex: number) => void;
  onClose: () => void;
}

interface IndexSceneEntry {
  sectionKey: string;
  sectionIndex: number;
  position: number;
  name: string;
  sceneId: string;
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
        sceneId: section.scene.id,
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
  commentCountsBySceneId = {},
  onSelectSection,
  onClose,
}) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
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
        // The modal surface clips at 90% of the screen: the list needs a bound of
        // its own or a long chapter list pushes the close button out of reach.
        list: { marginTop: 12, marginBottom: 8, maxHeight: Math.min(screenHeight * 0.5, 460) },
        chapterRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 10,
          paddingHorizontal: 4,
        },
        chapterTitle: { color: colors.text, fontSize: 16, fontWeight: '700', flex: 1 },
        sceneRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingVertical: 9,
          paddingHorizontal: 12,
          marginLeft: 24,
          borderRadius: 8,
        },
        sceneRowLeading: { marginLeft: 0 },
        sceneRowCurrent: { backgroundColor: colors.primaryContainer },
        sceneTitle: { color: colors.text, fontSize: 15, flex: 1 },
        sceneTitleCurrent: { color: colors.onPrimaryContainer, fontWeight: '700' },
        commentBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        commentCount: { color: colors.textSecondary, fontSize: 13 },
        emptyText: {
          color: colors.textSecondary,
          fontSize: 15,
          fontStyle: 'italic',
          marginTop: 12,
        },
        closeButton: { backgroundColor: colors.textSecondary },
      }),
    [colors, screenHeight],
  );

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Pending-work overview for the writer: every commented scene carries its count,
  // every group its aggregate - visible without expanding.
  const renderCommentCount = (count: number, testID: string) =>
    count > 0 ? (
      <View testID={testID} style={styles.commentBadge}>
        <Ionicons name="chatbubble-outline" size={12} color={colors.textSecondary} />
        <Text style={styles.commentCount}>{count}</Text>
      </View>
    ) : null;

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
        {renderCommentCount(
          commentCountsBySceneId[entry.sceneId] ?? 0,
          `manuscript-index-${entry.sectionKey}-comments`,
        )}
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
          <ScrollView
            style={styles.list}
            testID="manuscript-index-list"
            showsVerticalScrollIndicator
          >
            {leading.map((entry) => renderScene(entry, false))}
            {groups.map((group) => {
              const expanded = !collapsed.has(group.key);
              const groupCount = group.scenes.reduce(
                (total, entry) => total + (commentCountsBySceneId[entry.sceneId] ?? 0),
                0,
              );
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
                    {renderCommentCount(groupCount, `manuscript-index-${group.key}-comments`)}
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
