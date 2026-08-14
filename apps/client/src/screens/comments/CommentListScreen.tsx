import type { DrawerNavigationProp } from '@react-navigation/drawer';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import CommentList from '@/src/components/features/comments/CommentList/CommentList';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import type { MainSystemDrawerParamList } from '../../navigation/MainSystemStack';
import { CommentSelect } from '../../db/schema';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { setDocumentTitle } from '../../utils/documentTitle';
import { navigateToEntityDetail, NavigableEntityType } from '../../utils/entityNavigation';

/**
 * Lista compreensiva de todos os comentários da história atual, cross-entidade - modelada em
 * `OperationLogListScreen`. Tocar um item navega para a entidade-alvo (v1: só navega até a
 * tela de detalhe, não abre o modal do campo específico - ver plano de implementação).
 */
const CommentListScreen: React.FC = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { selectedStory } = useStoryStore();

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: t('comments_title') });
      setDocumentTitle(t('comments_title'));
    }, [navigation, t]),
  );

  const handlePressComment = useCallback(
    (comment: CommentSelect) => {
      const drawerNavigation =
        navigation.getParent<DrawerNavigationProp<MainSystemDrawerParamList>>();
      if (drawerNavigation) {
        navigateToEntityDetail(
          drawerNavigation,
          comment.entityType as NavigableEntityType,
          comment.entityId,
        );
      }
    },
    [navigation],
  );

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    noStoryContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    noStoryText: { fontSize: 18, color: colors.textSecondary },
  });

  if (!selectedStory?.id) {
    return (
      <View style={[styles.container, styles.noStoryContainer]}>
        <Text style={styles.noStoryText}>{t('no_story_selected')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CommentList storyId={selectedStory.id} pageSize={20} onPressItem={handlePressComment} />
    </View>
  );
};

export default CommentListScreen;
