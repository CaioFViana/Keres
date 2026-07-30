import { Ionicons } from '@expo/vector-icons';
import { TagRelation } from '@keres/shared/entities/Tag'; // Import TagRelation
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next'; // Import useTranslation
import { ActivityIndicator, Button, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { TagSelect } from '../../db/schema'; // Import TagSelect
import { useBackButtonHandler } from '../../hooks/useBackButtonHandler';
import { EntityService } from '../../services/EntityService'; // Import EntityService
import { createTagRelationService } from '../../services/storymanagement/TagRelationService'; // Import createTagRelationService
import { createTagService } from '../../services/storymanagement/TagService'; // Import createTagService
import { useStoryStore } from '../../state/storyStore'; // Import useStoryStore
import { useTheme } from '../../theme';
import { entityEventEmitter } from '../../utils/EventEmitter';
import { TagsScreenNavigationProp } from './TagListScreen';

// Define the parameter list for this screen
export type TagDetailScreenParamList = {
  TagDetail: { tagId: string };
};

type TagDetailScreenRouteProp = RouteProp<TagDetailScreenParamList, 'TagDetail'>;

const TagDetailScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation<TagsScreenNavigationProp>();
  const route = useRoute<TagDetailScreenRouteProp>();
  const { tagId } = route.params;

  const drizzleDb = useDrizzle();
  const tagServiceRef = useRef<ReturnType<typeof createTagService> | null>(null);
  const tagRelationServiceRef = useRef<ReturnType<typeof createTagRelationService> | null>(null);
  const { t } = useTranslation(); // Initialize useTranslation
  const { selectedStory } = useStoryStore();

  // Initialize tagService only once when drizzleDb is available
  useEffect(() => {
    if (drizzleDb) {
      if (!tagServiceRef.current) {
        tagServiceRef.current = createTagService(drizzleDb);
      }
      if (!tagRelationServiceRef.current) {
        tagRelationServiceRef.current = createTagRelationService(drizzleDb);
      }
    }
  }, [drizzleDb]);

  const [tag, setTag] = useState<TagSelect | null>(null);
  const [allTagRelations, setAllTagRelations] = useState<TagRelation[]>([]);
  const [groupedEntities, setGroupedEntities] = useState<Record<string, string[]>>({
    chapter: [],
    character: [],
    choice: [],
    item: [],
    itemjourney: [],
    location: [],
    note: [],
    operationlog: [],
    scene: [],
    story: [],
    suggestion: [], // Added missing suggestion
    tag: [],
    user: [],
    worldrule: [],
    characterrelation: [],
    noterelation: [],
    tagrelation: [],
    characterscene: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerTitle, setHeaderTitle] = useState(t('loading'));

  // Move styles declaration to the top
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    centerContent: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    mainTitle: {
      fontSize: 28,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    subTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 15,
    },
    detailText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
    },
    colorDisplayContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    colorCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.textSecondary,
      marginRight: 10,
    },
    errorText: {
      color: colors.error,
    },
    buttonContainer: {
      marginTop: 20,
    },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text, marginTop: 15, marginBottom: 5 },
    entityGroup: {
      marginBottom: 10,
    },
    entityGroupTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 5,
    },
    entityName: {
      fontSize: 14,
      color: colors.textSecondary,
      marginLeft: 10,
    },
  });

  const fetchTag = useCallback(async () => {
    if (!tagServiceRef.current) {
      console.warn('Tag service not initialized.');
      return;
    }
    try {
      setLoading(true);
      const fetchedTag = await tagServiceRef.current.getById(tagId);
      if (fetchedTag && !fetchedTag.isDeleted) {
        setTag(fetchedTag);
        setHeaderTitle(fetchedTag.name || t('tag_details_title'));
      } else if (fetchedTag && fetchedTag.isDeleted) {
        navigation.goBack()
      }
      else {
        setError(t('tag_not_found'));
        setHeaderTitle(t('tag_not_found'));
      }
    } catch (err) {
      console.error('Failed to fetch tag details:', err);
      setError(t('failed_to_load_tag'));
      setHeaderTitle(t('error'));
    } finally {
      setLoading(false);
    }
  }, [tagId, setTag, setLoading, setError, setHeaderTitle, navigation, t]);

  const fetchTagRelations = useCallback(async () => {
    if (!tagRelationServiceRef.current || !selectedStory?.id) {
      console.warn('Tag relation service or story not initialized.');
      return;
    }
    try {
      const relations = await tagRelationServiceRef.current.getRelationsForTag(selectedStory.id, tagId);
      setAllTagRelations(relations);
    } catch (err) {
      console.error('Failed to fetch tag relations:', err);
    }
  }, [tagId, selectedStory?.id]);

  const processTagRelations = useCallback(async () => {
    if (!drizzleDb || !selectedStory?.id) return;

    const newGroupedEntities: Record<string, string[]> = {
      chapter: [],
      character: [],
      choice: [],
      item: [],
      itemjourney: [],
      location: [],
      note: [],
      operationlog: [],
      scene: [],
      story: [],
      suggestion: [],
      tag: [],
      user: [],
      worldrule: [],
      characterrelation: [],
      noterelation: [],
      tagrelation: [],
      characterscene: [],
    };

    for (const relation of allTagRelations) {
      const entityName = await EntityService.getEntityIdentifier(drizzleDb, relation.relationType, relation.relationId, selectedStory.id, t);
      if (entityName) {
        newGroupedEntities[relation.relationType.toLowerCase()].push(entityName);
      }
    }
    setGroupedEntities(newGroupedEntities);
  }, [allTagRelations, drizzleDb, selectedStory?.id, t]);

  const handleTagChange = useCallback(async (changedStoryId: string, changedTagId: string) => {
    if (changedTagId === tagId) {
      // Re-fetch the tag to get the latest status
      if (tagServiceRef.current) {
        const updatedTag = await tagServiceRef.current.getById(tagId);
        if (!updatedTag || updatedTag.isDeleted) {
          navigation.goBack(); // Tag was deleted or no longer found
        } else {
          setTag(updatedTag); // Update state with latest tag data
          setHeaderTitle(updatedTag.name || t('tag_details_title'));
        }
      }
      fetchTagRelations(); // Also refetch relations if the tag itself changed
    }
  }, [tagId, navigation, setTag, setHeaderTitle, t, fetchTagRelations]);

  const handleTagRelationChange = useCallback((changedStoryId: string, changedTagId: string) => {
    if (changedTagId === tagId) {
      fetchTagRelations(); // Refetch relations if a tag relation changed
    }
  }, [tagId, fetchTagRelations]);

  useEffect(() => {
    // Only subscribe and fetch if tagServiceRef.current is initialized
    if (tagServiceRef.current && selectedStory?.id) {
      fetchTag();
      fetchTagRelations();

      entityEventEmitter.on('tag_changed', handleTagChange);
      entityEventEmitter.on('tag_relation_changed', handleTagRelationChange);

      return () => {
        entityEventEmitter.off('tag_changed', handleTagChange);
        entityEventEmitter.off('tag_relation_changed', handleTagRelationChange);
      };
    }
  }, [tagId, fetchTag, handleTagChange, selectedStory?.id, fetchTagRelations, handleTagRelationChange]);

  useEffect(() => {
    if (allTagRelations.length > 0 && selectedStory?.id) {
      processTagRelations();
    }
  }, [allTagRelations, selectedStory?.id, processTagRelations]);


  const renderHeaderRight = useCallback(() => (
    <TouchableOpacity
      onPress={() => navigation.navigate('TagForm', { tagId: tagId })}
      style={{ marginRight: 15 }}
    >
      <Ionicons name="pencil-outline" size={24} color={colors.text} />
    </TouchableOpacity>
  ), [navigation, tagId, colors.text]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({
        title: headerTitle,
        headerRight: renderHeaderRight, // Pass the memoized component
      });
    }, [navigation, headerTitle, renderHeaderRight])
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.detailText}>{t('loading_tag_details')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{error}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!tag) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={[styles.detailText, styles.errorText]}>{t('tag_data_missing')}</Text>
        <View style={styles.buttonContainer}>
          <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.mainTitle}>{tag.name}</Text>
      
      {tag.color && (
        <View style={styles.colorDisplayContainer}>
          <View style={[styles.colorCircle, { backgroundColor: tag.color }]} />
          <Text style={styles.detailText}>{t('color')}: {tag.color}</Text>
        </View>
      )}

      {tag.extraNotes && (
        <Text style={styles.detailText}>{t('extra_notes')}: {tag.extraNotes}</Text>
      )}

      <Text style={styles.sectionTitle}>{t('tagged_entities_title')}</Text>
      {Object.values(groupedEntities).every(arr => arr.length === 0) ? (
        <Text style={{ color: colors.textSecondary }}>{t('no_entities_tagged')}</Text>
      ) : (
        Object.entries(groupedEntities).map(([entityType, entityNames]) => (
          entityNames.length > 0 && (
            <View key={entityType} style={styles.entityGroup}>
              <Text style={styles.entityGroupTitle}>{t(`${entityType.toLowerCase()}_plural`)}</Text>
              {entityNames.map((name, index) => (
                <Text key={index} style={styles.entityName}>- {name}</Text>
              ))}
            </View>
          )
        ))
      )}
      
      <View style={styles.buttonContainer}>
        <Button title={t('go_back')} onPress={() => navigation.goBack()} color={colors.primary} />
      </View>
    </ScrollView>
  );
};

export default TagDetailScreen;