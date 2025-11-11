import React, { useEffect } from 'react';
import { View, Text, StyleSheet, BackHandler } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native'; // Import useNavigation
import { useTheme } from '../theme';
import { getCommonContainerStyles } from '../theme/commonStyles';

const StoryFormScreen = () => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const commonContainerStyles = getCommonContainerStyles(colors);

  useEffect(() => {
    const backAction = () => {
      navigation.goBack(); // Navigate back instead of exiting
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [navigation]); // Depend on navigation to re-create listener if navigation object changes


  return (
    <View style={commonContainerStyles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('create_new_story_screen_title')}</Text>
      <Text style={{ color: colors.textSecondary }}>{t('create_new_story_screen_description')}</Text>
      {/* Story creation form will go here */}
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
});

export default StoryFormScreen;
