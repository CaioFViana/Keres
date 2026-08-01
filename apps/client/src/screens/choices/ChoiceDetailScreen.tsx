import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ScreenError, ScreenLoading } from '../../components/common/ScreenState/ScreenState';
import NoteManager from '../../components/NoteManager';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { ChoiceSelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { createChoiceService } from '../../services/storymanagement/ChoiceService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { getCommonContainerStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { ChoicesScreenNavigationProp } from './ChoiceListScreen';

export type ChoiceDetailScreenParamList = {
  ChoiceDetail: { choiceId: string };
};

type ChoiceDetailScreenRouteProp = RouteProp<ChoiceDetailScreenParamList, 'ChoiceDetail'>;

const ChoiceDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();
  const route = useRoute<ChoiceDetailScreenRouteProp>();
  const { choiceId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);

  useEffect(() => {
    if (drizzleDb && !choiceServiceRef.current) {
      choiceServiceRef.current = createChoiceService(drizzleDb);
    }
  }, [drizzleDb]);

  const [choice, setChoice] = useState<ChoiceSelect | null>(null);

  const {
    selectedTags: choiceTags,
    allNotes,
    noteRelations: choiceNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'Choice', entityId: choiceId });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const commonContainerStyles = getCommonContainerStyles(colors);
  const styles = StyleSheet.create({
    mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    buttonContainer: { marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 15, marginBottom: 5 },
  });

  const fetchChoice = useCallback(async () => {
    if (!choiceServiceRef.current) {
      console.warn('Choice service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedChoice = await choiceServiceRef.current.getById(choiceId);
      if (fetchedChoice && !fetchedChoice.isDeleted) {
        setChoice(fetchedChoice);
        setHeaderTitle(fetchedChoice.text || t('choice_details_title')); // Use text
      } else if (fetchedChoice && fetchedChoice.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('choice_not_found'));
        setHeaderTitle(t('choice_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch choice details:', err);
      setError(t('failed_to_load_choice'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [choiceId, navigation, t]);

  const handleChoiceChange = useCallback(async (changedStoryId: string, changedChoiceId: string) => {
    if (changedChoiceId === choiceId && choiceServiceRef.current) {
      const updatedChoice = await choiceServiceRef.current.getById(choiceId);
      if (!updatedChoice || updatedChoice.isDeleted) {
        navigation.goBack();
      } else {
        setChoice(updatedChoice);
        setHeaderTitle(updatedChoice.text || t('choice_details_title')); // Use text
      }
    }
  }, [choiceId, navigation, t]);

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    fetchChoice();
    entityEventEmitter.on('choice_changed', handleChoiceChange);
    return () => {
      entityEventEmitter.off('choice_changed', handleChoiceChange);
    };
  }, [choiceId, fetchChoice, handleChoiceChange]);


  const renderHeaderRight = useCallback(() => (
    <TouchableOpacity onPress={() => navigation.navigate('ChoiceForm', { choiceId })} style={{ marginRight: 15 }}>
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, choiceId, colors.text]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return <ScreenLoading padded message={t('loading_choice_details')} />;
  }
  if (error) {
    return <ScreenError padded message={error} onGoBack={() => navigation.goBack()} />;
  }
  if (!choice) {
    return <ScreenError padded message={t('choice_data_missing')} onGoBack={() => navigation.goBack()} />;
  }

  return (
    <ScrollView style={commonContainerStyles.container}>
      <Text style={styles.mainTitle}>{choice.text}</Text>

      <NoteManager
        noteRelations={choiceNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={choiceId}
        currentEntityType="Choice"
      />

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={choiceTags} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ChoiceDetailScreen;