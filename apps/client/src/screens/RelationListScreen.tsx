import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Alert } from 'react-native';
import { Button, TextInput } from 'react-native-paper'; // Added
import { getRelationsByStoryId, createRelation, updateRelation, deleteRelation } from '../api';
import { RelationResponse, CreateRelationPayload, UpdateRelationPayload } from '@keres/shared';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  StoryList: undefined;
  CharacterList: { storyId: string };
  ChapterList: { storyId: string };
  SceneList: { chapterId: string };
  MomentList: { sceneId: string };
  LocationList: { storyId: string };
  GalleryList: { storyId: string };
  NoteList: { storyId: string };
  TagList: { storyId: string };
  WorldRuleList: { storyId: string };
  SuggestionList: { userId: string };
  CharacterMomentList: { characterId: string };
  CharacterRelationList: { characterId: string };
  RelationList: { storyId: string }; // Added
};

type RelationListScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'RelationList'
>;

interface RelationListScreenProps {
  token: string;
  storyId: string;
  navigation: RelationListScreenNavigationProp;
}

export default function RelationListScreen({ token, storyId, navigation }: RelationListScreenProps) {
  const [relations, setRelations] = useState<RelationResponse[]>([]);
  const [newRelationName, setNewRelationName] = useState('');
  const [editingRelation, setEditingRelation] = useState<RelationResponse | null>(null);

  useEffect(() => {
    fetchRelations();
  }, [token, storyId]);

  const fetchRelations = async () => {
    try {
      const fetchedRelations = await getRelationsByStoryId(token, storyId);
      setRelations(fetchedRelations);
    } catch (error: any) {
      Alert.alert('Error fetching relations', error.response?.data?.error || 'Something went wrong.');
    }
  };

  const handleCreateRelation = async () => {
    if (!newRelationName.trim()) {
      Alert.alert('Error', 'Relation name cannot be empty.');
      return;
    }
    try {
      const payload: CreateRelationPayload = {
        storyId,
        name: newRelationName,
        description: null, // Optional fields
        isFavorite: false,
        extraNotes: null,
      };
      await createRelation(token, payload);
      setNewRelationName('');
      fetchRelations(); // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating relation', error.response?.data?.error || 'Something went wrong.');
    }
  };

  const handleEditRelation = (relation: RelationResponse) => {
    setEditingRelation(relation);
    setNewRelationName(relation.name); // Populate form with current name
  };

  const handleUpdateRelation = async () => {
    if (!editingRelation || !newRelationName.trim()) {
      Alert.alert('Error', 'Relation name cannot be empty.');
      return;
    }
    try {
      const payload: UpdateRelationPayload = {
        id: editingRelation.id,
        name: newRelationName,
      };
      await updateRelation(token, payload);
      setEditingRelation(null);
      setNewRelationName('');
      fetchRelations(); // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating relation', error.response?.data?.error || 'Something went wrong.');
    }
  };

  const handleDeleteRelation = async (relationId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this relation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteRelation(token, relationId);
              fetchRelations(); // Refresh list
            } catch (error: any) {
              Alert.alert('Error deleting relation', error.response?.data?.error || 'Something went wrong.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const renderRelationItem = ({ item }: { item: RelationResponse }) => (
    <View style={styles.relationItem}>
      <Text style={styles.relationName}>{item.name}</Text>
      <View style={styles.relationActions}>
        <Button mode="outlined" onPress={() => handleEditRelation(item)}>
          Edit
        </Button>
        <Button mode="outlined" onPress={() => handleDeleteRelation(item.id)} buttonColor="red">
          Delete
        </Button>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Button mode="outlined" onPress={() => navigation.goBack()}>
        Back to Stories
      </Button>
      <Text style={styles.header}>Relations for Story ID: {storyId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingRelation ? 'Edit Relation Name' : 'New Relation Name'}
          value={newRelationName}
          onChangeText={setNewRelationName}
          mode="outlined"
          style={styles.input}
        />
        <Button
          mode="contained"
          onPress={editingRelation ? handleUpdateRelation : handleCreateRelation}
          style={styles.button}
        >
          {editingRelation ? 'Update Relation' : 'Add Relation'}
        </Button>
        {editingRelation && (
          <Button
            mode="outlined"
            onPress={() => setEditingRelation(null)}
            style={styles.button}
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {relations.length === 0 ? (
        <Text>No relations found. Add a new one!</Text>
      ) : (
        <FlatList
          data={relations}
          renderItem={renderRelationItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
  },
  form: {
    width: '100%',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  input: {
    // Paper TextInput handles height and border, so remove them from here
    // height: 40,
    // borderColor: '#ddd',
    // borderWidth: 1,
    // borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  button: { // Added
    marginTop: 10,
    marginBottom: 10,
  },
  list: {
    width: '100%',
  },
  relationItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  relationName: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  relationActions: {
    flexDirection: 'row',
    gap: 10,
  },
});