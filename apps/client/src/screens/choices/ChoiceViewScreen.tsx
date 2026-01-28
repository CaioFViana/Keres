import React, { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { ChoicesScreenNavigationProp } from './ChoiceListScreen';
import { useTheme } from '../../theme';

const ChoiceViewScreen = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();
  const { colors } = useTheme();

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: t('choice_view_title'), headerRight: undefined });
    }, [navigation, t])
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    text: {
      color: colors.text,
      fontSize: 20,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('choice_view_screen_content')}</Text>
    </View>
  );
};

export default ChoiceViewScreen;