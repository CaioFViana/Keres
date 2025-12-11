import { RouteProp, useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { useBackButtonHandler } from '../hooks/useBackButtonHandler';
import { CharacterStackParamList, MainSystemDrawerParamList } from '../navigation/MainSystemStack';
import { useTheme } from '../theme';
import { useTranslation } from 'react-i18next';
import { DrawerNavigationProp } from '@react-navigation/drawer';


type CharacterFormScreenRouteProp = RouteProp<CharacterStackParamList, 'CharacterForm'>;

const CharacterFormScreen = () => {
  useBackButtonHandler();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const drawerNavigation = useNavigation<DrawerNavigationProp<MainSystemDrawerParamList>>();
  const route = useRoute<CharacterFormScreenRouteProp>();
  const { characterId } = route.params || {};
  const { t } = useTranslation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const isEditing = !!characterId;

  useFocusEffect(
    useCallback(() => {
      drawerNavigation.getParent()?.setOptions({
        title: isEditing ? t('edit_character') : t('create_character'),
      });
    }, [drawerNavigation, isEditing, t])
  );

  useEffect(() => {
    if (isEditing) {
      // In a real app, you would fetch character data here
      // For now, let's simulate fetching
      setName(`Character Name ${characterId}`);
      setDescription(`Description for Character ${characterId}`);
    }
  }, [isEditing, characterId]);

  const handleSave = () => {
    if (isEditing) {
      // Logic to update character
      console.log('Updating character:', { characterId, name, description });
    } else {
      // Logic to create new character
      console.log('Creating new character:', { name, description });
    }
    navigation.goBack();
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    label: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
      marginTop: 10,
    },
    input: {
      height: 40,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      color: colors.text,
      backgroundColor: colors.card,
    },
    textArea: {
      height: 100,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 5,
      paddingHorizontal: 10,
      paddingVertical: 10,
      textAlignVertical: 'top',
      color: colors.text,
      backgroundColor: colors.card,
    },
    saveButton: {
      marginTop: 20,
      backgroundColor: colors.primary,
      padding: 10,
      borderRadius: 5,
      alignItems: 'center',
    },
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Name:</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Character Name"
        placeholderTextColor={colors.textSecondary}
      />

      <Text style={styles.label}>Description:</Text>
      <TextInput
        style={styles.textArea}
        value={description}
        onChangeText={setDescription}
        placeholder="Character Description"
        placeholderTextColor={colors.textSecondary}
        multiline
      />

      <Button title="Save Character" onPress={handleSave} color={colors.primary} />
    </View>
  );
};

export default CharacterFormScreen;
