import type { CreateLocationPayload, LocationResponse, UpdateLocationPayload } from '@keres/shared'
import type { StackNavigationProp } from '@react-navigation/stack' // Added

import React, { useEffect, useState } from 'react'
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native'
import { Button, TextInput } from 'react-native-paper' // Added

import { createLocation, deleteLocation, getLocationsByStoryId, updateLocation } from '../api'

type RootStackParamList = {
  StoryList: undefined
  CharacterList: { storyId: string }
  ChapterList: { storyId: string }
  SceneList: { chapterId: string }
  MomentList: { sceneId: string }
  LocationList: { storyId: string }
  GalleryList: { storyId: string }
  NoteList: { storyId: string }
  TagList: { storyId: string }
  WorldRuleList: { storyId: string }
  SuggestionList: { userId: string }
}

type LocationListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'LocationList'>

interface LocationListScreenProps {
  token: string
  storyId: string
  navigation: LocationListScreenNavigationProp // Added
}

export default function LocationListScreen({
  token,
  storyId,
  navigation,
}: LocationListScreenProps) {
  const [locations, setLocations] = useState<LocationResponse[]>([])
  const [newLocationName, setNewLocationName] = useState('')
  const [editingLocation, setEditingLocation] = useState<LocationResponse | null>(null)

  useEffect(() => {
    fetchLocations()
  }, [token, storyId])

  const fetchLocations = async () => {
    try {
      const fetchedLocations = await getLocationsByStoryId(token, storyId)
      setLocations(fetchedLocations)
    } catch (error: any) {
      Alert.alert(
        'Error fetching locations',
        error.response?.data?.error || 'Something went wrong.',
      )
    }
  }

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      Alert.alert('Error', 'Location name cannot be empty.')
      return
    }
    try {
      const payload: CreateLocationPayload = {
        storyId,
        name: newLocationName,
        type: null, // Optional fields
        description: null,
        isFavorite: false,
        extraNotes: null,
      }
      await createLocation(token, payload)
      setNewLocationName('')
      fetchLocations() // Refresh list
    } catch (error: any) {
      Alert.alert('Error creating location', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleEditLocation = (location: LocationResponse) => {
    setEditingLocation(location)
    setNewLocationName(location.name) // Populate form with current name
  }

  const handleUpdateLocation = async () => {
    if (!editingLocation || !newLocationName.trim()) {
      Alert.alert('Error', 'Location name cannot be empty.')
      return
    }
    try {
      const payload: UpdateLocationPayload = {
        id: editingLocation.id,
        name: newLocationName,
      }
      await updateLocation(token, payload)
      setEditingLocation(null)
      setNewLocationName('')
      fetchLocations() // Refresh list
    } catch (error: any) {
      Alert.alert('Error updating location', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleDeleteLocation = async (locationId: string) => {
    Alert.alert(
      'Confirm Deletion',
      'Are you sure you want to delete this location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteLocation(token, locationId)
              fetchLocations() // Refresh list
            } catch (error: any) {
              Alert.alert(
                'Error deleting location',
                error.response?.data?.error || 'Something went wrong.',
              )
            }
          },
        },
      ],
      { cancelable: true },
    )
  }

  const renderLocationItem = ({ item }: { item: LocationResponse }) => (
    <View style={styles.locationItem}>
      <Text style={styles.locationName}>{item.name}</Text>
      <View style={styles.locationActions}>
        <Button mode='outlined' onPress={() => handleEditLocation(item)}>
          Edit
        </Button>
        <Button mode='outlined' onPress={() => handleDeleteLocation(item.id)} buttonColor='red'>
          Delete
        </Button>
      </View>
    </View>
  )

  return (
    <View style={styles.container}>
      <Button mode='outlined' onPress={() => navigation.goBack()}>
        Back to Stories
      </Button>
      <Text style={styles.header}>Locations for Story ID: {storyId}</Text>

      <View style={styles.form}>
        <TextInput
          label={editingLocation ? 'Edit Location Name' : 'New Location Name'} // Changed to label
          value={newLocationName}
          onChangeText={setNewLocationName}
          mode='outlined' // Added mode
          style={styles.input} // Keep existing style for width/margin
        />
        <Button
          mode='contained' // Added mode
          onPress={editingLocation ? handleUpdateLocation : handleCreateLocation}
          style={styles.button} // Added style
        >
          {editingLocation ? 'Update Location' : 'Add Location'}
        </Button>
        {editingLocation && (
          <Button
            mode='outlined' // Added mode
            onPress={() => setEditingLocation(null)}
            style={styles.button} // Added style
          >
            Cancel Edit
          </Button>
        )}
      </View>

      {locations.length === 0 ? (
        <Text>No locations found. Add a new one!</Text>
      ) : (
        <FlatList
          data={locations}
          renderItem={renderLocationItem}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      )}
    </View>
  )
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
  button: {
    // Added
    marginTop: 10,
    marginBottom: 10,
  },
  list: {
    width: '100%',
  },
  locationItem: {
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
  locationName: {
    fontSize: 18,
    fontWeight: '500',
    flex: 1,
    marginRight: 10,
  },
  locationActions: {
    flexDirection: 'row',
    gap: 10,
  },
})
