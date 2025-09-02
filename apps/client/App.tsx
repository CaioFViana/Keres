import type { UserLoginPayload, UserProfileResponse } from '@keres/shared'

import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { StatusBar } from 'expo-status-bar'
import React, { useState } from 'react'
import { Alert, Button, StyleSheet, Text, TextInput, View } from 'react-native'
import { PaperProvider } from 'react-native-paper' // Added

import { loginUser } from './src/api'
import ChapterListScreen from './src/screens/ChapterListScreen'
import CharacterListScreen from './src/screens/CharacterListScreen'
import GalleryListScreen from './src/screens/GalleryListScreen'
import LocationListScreen from './src/screens/LocationListScreen'
import MomentListScreen from './src/screens/MomentListScreen'
import NoteListScreen from './src/screens/NoteListScreen'
import SceneListScreen from './src/screens/SceneListScreen'
import StoryListScreen from './src/screens/StoryListScreen'
import SuggestionListScreen from './src/screens/SuggestionListScreen'
import TagListScreen from './src/screens/TagListScreen'
import WorldRuleListScreen from './src/screens/WorldRuleListScreen'

const Stack = createStackNavigator()

function AuthenticatedApp({
  token,
  userId,
  onLogout,
}: {
  token: string
  userId: string
  onLogout: () => void
}) {
  return (
    <Stack.Navigator>
      <Stack.Screen name='StoryList' options={{ title: 'Your Stories' }}>
        {(props) => <StoryListScreen {...props} token={token} userId={userId} />}
      </Stack.Screen>
      <Stack.Screen name='CharacterList' options={{ title: 'Characters' }}>
        {(props) => (
          <CharacterListScreen {...props} token={token} storyId={props.route.params?.storyId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='ChapterList' options={{ title: 'Chapters' }}>
        {(props) => (
          <ChapterListScreen {...props} token={token} storyId={props.route.params?.storyId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='SceneList' options={{ title: 'Scenes' }}>
        {(props) => (
          <SceneListScreen {...props} token={token} chapterId={props.route.params?.chapterId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='MomentList' options={{ title: 'Moments' }}>
        {(props) => (
          <MomentListScreen {...props} token={token} sceneId={props.route.params?.sceneId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='LocationList' options={{ title: 'Locations' }}>
        {(props) => (
          <LocationListScreen {...props} token={token} storyId={props.route.params?.storyId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='GalleryList' options={{ title: 'Galleries' }}>
        {(props) => (
          <GalleryListScreen {...props} token={token} storyId={props.route.params?.storyId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='NoteList' options={{ title: 'Notes' }}>
        {(props) => (
          <NoteListScreen {...props} token={token} storyId={props.route.params?.storyId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='TagList' options={{ title: 'Tags' }}>
        {(props) => (
          <TagListScreen {...props} token={token} storyId={props.route.params?.storyId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='WorldRuleList' options={{ title: 'World Rules' }}>
        {(props) => (
          <WorldRuleListScreen {...props} token={token} storyId={props.route.params?.storyId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='CharacterMomentList' options={{ title: 'Character Moments' }}>
        {(props) => (
          <CharacterMomentListScreen
            {...props}
            token={token}
            characterId={props.route.params?.characterId}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name='CharacterRelationList' options={{ title: 'Character Relations' }}>
        {(props) => (
          <CharacterRelationListScreen
            {...props}
            token={token}
            characterId={props.route.params?.characterId}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name='RelationList' options={{ title: 'Relations' }}>
        {(props) => (
          <RelationListScreen {...props} token={token} storyId={props.route.params?.storyId} />
        )}
      </Stack.Screen>
      <Stack.Screen name='SuggestionList' options={{ title: 'My Suggestions' }}>
        {(props) => <SuggestionListScreen {...props} token={token} userId={userId} />}
      </Stack.Screen>
    </Stack.Navigator>
  )
}

export default function App() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const handleLogin = async () => {
    try {
      const credentials: UserLoginPayload = { username, password }
      const response: UserProfileResponse = await loginUser(credentials)
      if (response.token && response.id) {
        setToken(response.token)
        setUserId(response.id)
        Alert.alert('Login Successful', `Welcome, ${response.username}!`)
      } else {
        Alert.alert('Login Failed', 'No token or user ID received.')
      }
    } catch (error: any) {
      Alert.alert('Login Error', error.response?.data?.error || 'Something went wrong.')
    }
  }

  const handleLogout = () => {
    setToken(null)
    setUserId(null)
    setUsername('')
    setPassword('')
  }

  return (
    <PaperProvider>
      <NavigationContainer>
        <View style={styles.container}>
          <Text style={styles.title}>Keres Story Organizer</Text>

          {!token ? (
            <View style={styles.form}>
              <TextInput
                label='Username' // Changed to label
                value={username}
                onChangeText={setUsername}
                autoCapitalize='none'
                mode='outlined' // Added mode
                style={styles.input} // Keep existing style for width/margin
              />
              <TextInput
                label='Password' // Changed to label
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                mode='outlined' // Added mode
                style={styles.input} // Keep existing style for width/margin
              />
              <Button mode='contained' onPress={handleLogin} style={styles.button}>
                Login
              </Button>
            </View>
          ) : (
            <>
              <Button mode='outlined' onPress={handleLogout} style={styles.button}>
                Logout
              </Button>
              <AuthenticatedApp token={token} userId={userId!} onLogout={handleLogout} />
            </>
          )}

          <StatusBar style='auto' />
        </View>
      </NavigationContainer>
    </PaperProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
  },
  form: {
    width: '80%',
    maxWidth: 300,
  },
  input: {
    // Paper TextInput handles height and border, so remove them from here
    // height: 40,
    // borderColor: 'gray',
    // borderWidth: 1,
    marginBottom: 15,
    paddingHorizontal: 10,
    // borderRadius: 5, // Paper TextInput has its own borderRadius
  },
  button: {
    // Added
    marginTop: 10,
    marginBottom: 10,
  },
  loggedInContainer: {
    alignItems: 'center',
  },
  loggedInText: {
    fontSize: 18,
    marginBottom: 20,
    color: 'green',
  },
  protectedDataContainer: {
    marginTop: 30,
    padding: 15,
    borderColor: '#ccc',
    borderWidth: 1,
    borderRadius: 5,
    width: '100%',
  },
  protectedDataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  protectedDataText: {
    fontSize: 14,
  },
})
