import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NoteManager from '../../components/NoteManager';
import TagChipList from '../../components/common/TagChipList/TagChipList';
import { useDrizzle } from '../../db';
import { ItemJourneySelect } from '../../db/schema';
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { useEntityRelations } from '../../hooks/useEntityRelations';
import { createItemJourneyService } from '../../services/storymanagement/ItemJourneyService';
import { useCharacterStore } from '../../state/characterStore';
import { useItemStore } from '../../state/itemStore';
import { useSceneStore } from '../../state/sceneStore';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { ItemJourneysScreenNavigationProp } from './ItemJourneyListScreen';

export type ItemJourneyDetailScreenParamList = {
  ItemJourneyDetail: { itemJourneyId: string };
};

type ItemJourneyDetailScreenRouteProp = RouteProp<ItemJourneyDetailScreenParamList, 'ItemJourneyDetail'>;

const ItemJourneyDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<ItemJourneysScreenNavigationProp>();
  const route = useRoute<ItemJourneyDetailScreenRouteProp>();
  const { itemJourneyId } = route.params;
  const { t } = useTranslation();
  const { selectedStory } = useStoryStore();

  const drizzleDb = useDrizzle();
  const itemJourneyServiceRef = useRef<ReturnType<typeof createItemJourneyService> | null>(null);

  const { items } = useItemStore();
  const { scenes } = useSceneStore();
  const { characters } = useCharacterStore();

  useEffect(() => {
    if (drizzleDb && !itemJourneyServiceRef.current) {
      itemJourneyServiceRef.current = createItemJourneyService(drizzleDb);
    }
  }, [drizzleDb]);

  const [itemJourney, setItemJourney] = useState<ItemJourneySelect | null>(null);

  const {
    selectedTags: itemJourneyTags,
    allNotes,
    noteRelations: itemJourneyNoteRelations,
    saveNoteRelation,
    deleteNoteRelation,
  } = useEntityRelations({ entityType: 'ItemJourney', entityId: itemJourneyId });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background, padding: 20 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    mainTitle: { fontSize: 28, fontWeight: 'bold', color: colors.text, marginBottom: 5 },
    subTitle: { fontSize: 20, fontWeight: '600', color: colors.textSecondary, marginBottom: 15 },
    detailText: { fontSize: 16, color: colors.text, marginBottom: 5 },
    errorText: { color: colors.error },
    buttonContainer: { marginTop: 20 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 15, marginBottom: 5 },
    detailLabel: { fontSize: 16, fontWeight: 'bold', color: colors.textSecondary, marginTop: 5 },
  });

  const fetchItemJourney = useCallback(async () => {
    if (!itemJourneyServiceRef.current) {
      console.warn('Item Journey service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedItemJourney = await itemJourneyServiceRef.current.getById(itemJourneyId);
      if (fetchedItemJourney && !fetchedItemJourney.isDeleted) {
        setItemJourney(fetchedItemJourney);
        // Display item name + new state as title
        const relatedItem = items.find(item => item.id === fetchedItemJourney.itemId);
        setHeaderTitle(`${relatedItem?.name || t('unknown_item')} - ${fetchedItemJourney.newState}`);
      } else if (fetchedItemJourney && fetchedItemJourney.isDeleted) {
        navigation.goBack();
      } else {
        setError(t('item_journey_not_found'));
        setHeaderTitle(t('item_journey_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch item journey details:', err);
      setError(t('failed_to_load_item_journey'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [itemJourneyId, navigation, t, items]);

  const handleItemJourneyChange = useCallback(async (changedStoryId: string, changedItemJourneyId: string) => {
    if (changedItemJourneyId === itemJourneyId && itemJourneyServiceRef.current) {
      const updatedItemJourney = await itemJourneyServiceRef.current.getById(itemJourneyId);
      if (!updatedItemJourney || updatedItemJourney.isDeleted) {
        navigation.goBack();
      } else {
        setItemJourney(updatedItemJourney);
        const relatedItem = items.find(item => item.id === updatedItemJourney.itemId);
        setHeaderTitle(`${relatedItem?.name || t('unknown_item')} - ${updatedItemJourney.newState}`);
      }
    }
  }, [itemJourneyId, navigation, t, items]);

  // Notes, note relations and tags are kept fresh by useEntityRelations.
  useEffect(() => {
    fetchItemJourney();
    entityEventEmitter.on('item_journey_changed', handleItemJourneyChange);
    return () => {
      entityEventEmitter.off('item_journey_changed', handleItemJourneyChange);
    };
  }, [itemJourneyId, fetchItemJourney, handleItemJourneyChange]);

  const relatedItem = items.find(item => item.id === itemJourney?.itemId);
  const relatedScene = scenes.find(scene => scene.id === itemJourney?.sceneId);
  const newCharacterOwner = characters.find(char => char.id === itemJourney?.newCharacterOwnerId);

  const renderHeaderRight = useCallback(() => (
    <TouchableOpacity onPress={() => navigation.navigate('ItemJourneyForm', { itemJourneyId })} style={{ marginRight: 15 }}>
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, itemJourneyId, colors.text]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: headerTitle, headerRight: renderHeaderRight });
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return <View style={[styles.container, styles.centerContent]}><ActivityIndicator size="large" color={colors.primary} /><Text style={styles.detailText}>{t('loading_item_journey_details')}</Text></View>;
  }
  if (error) {
    return <View style={[styles.container, styles.centerContent]}><Text style={[styles.detailText, styles.errorText]}>{error}</Text><View style={styles.buttonContainer}><Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} /></View></View>;
  }
  if (!itemJourney) {
    return <View style={[styles.container, styles.centerContent]}><Text style={[styles.detailText, styles.errorText]}>{t('item_journey_data_missing')}</Text><View style={styles.buttonContainer}><Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} /></View></View>;
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>{relatedItem?.name || t('unknown_item')}</Text>
      <Text style={styles.subTitle}>{itemJourney.newState}</Text>
      
      {itemJourney.extraNotes && <Text style={styles.detailText}>{t('extra_notes')}: {itemJourney.extraNotes}</Text>}
      {relatedScene && <Text style={styles.detailText}>{t('scene')}: {relatedScene.name}</Text>}
      {newCharacterOwner && <Text style={styles.detailText}>{t('new_character_owner')}: {newCharacterOwner.name}</Text>}
      
      <Text style={styles.sectionTitle}>{t('notes_title')}</Text>
      <NoteManager
        noteRelations={itemJourneyNoteRelations}
        availableNotes={allNotes}
        onSave={saveNoteRelation}
        onDelete={deleteNoteRelation}
        editable={false}
        currentStoryId={selectedStory?.id || ''}
        currentEntityId={itemJourneyId}
        currentEntityType="ItemJourney"
      />

      <Text style={styles.sectionTitle}>{t('tags_title')}</Text>
      <TagChipList tags={itemJourneyTags} />

      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default ItemJourneyDetailScreen;