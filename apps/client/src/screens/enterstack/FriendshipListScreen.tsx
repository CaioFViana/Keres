import { Ionicons } from '@expo/vector-icons';
import { useNavigation, StackActions } from '@react-navigation/native'; // Add StackActions
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useDrizzle } from '../../db';
import { FriendshipSelect } from '../../db/schemas/friendships';
import { createFriendshipService } from '../../services/FriendshipService';
import { useNotificationStore } from '../../state/notificationStore';
import { useUserSettingsStore } from '../../state/userSettingsStore';
import { useTheme } from '../../theme';
import { getCommonCardStyles, getCommonContainerStyles } from '../../theme/commonStyles';
import { entityEventEmitter } from '../../utils/EventEmitter'; // Add entityEventEmitter

type FriendshipStackParamList = {
  FriendshipList: undefined;
  FriendshipForm: { friendshipId?: string };
};

type FriendshipListScreenNavigationProp = NativeStackNavigationProp<FriendshipStackParamList, 'FriendshipList'>;

const FriendshipListScreen = () => {
  const navigation = useNavigation<FriendshipListScreenNavigationProp>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const drizzleClient = useDrizzle();
  const friendshipService = createFriendshipService(drizzleClient);
  const { userId } = useUserSettingsStore();
  const { showNotification } = useNotificationStore();

  const [friendships, setFriendships] = useState<FriendshipSelect[]>([]);

  const commonContainerStyles = getCommonContainerStyles(colors);
  const commonCardStyles = getCommonCardStyles(colors);

  const fetchFriendships = useCallback(async () => {
    if (!userId) {
      showNotification(t('not_logged_in'), 'error');
      return;
    }
    try {
      const fetched = await friendshipService.getAllFriendships(userId);
      setFriendships(fetched);
    } catch (error) {
      console.error('Error fetching friendships:', error);
      Alert.alert(t('error'), t('failed_to_load_friendships'));
    }
  }, [friendshipService, userId, showNotification, t]);

  useEffect(() => {
    fetchFriendships();
    const unsubscribe = navigation.addListener('focus', () => {
      fetchFriendships();
    });
    return unsubscribe;
  }, [fetchFriendships, navigation]);

  // Add this useEffect block
  useEffect(() => {
    const handleReset = () => {
      if (navigation.getState().routes.length > 1) {
        navigation.dispatch(StackActions.popToTop());
      }
    };
    entityEventEmitter.on('friendship_navigation_reset', handleReset);
    return () => {
      entityEventEmitter.off('friendship_navigation_reset', handleReset);
    };
  }, [navigation]);

  const handleAddFriendship = () => {
    navigation.navigate('FriendshipForm', {});
  };

  const handleEditFriendship = (id: string) => {
    navigation.navigate('FriendshipForm', { friendshipId: id });
  };

  const handleDeleteFriendship = async (id: string) => {
    try {
      await friendshipService.deleteFriendship(id);
      showNotification(t('friendship_deleted_successfully'), 'success');
      fetchFriendships();
    } catch (error) {
      console.error('Error deleting friendship:', error);
      Alert.alert(t('error'), t('failed_to_delete_friendship'));
    }
  };

  const renderFriendshipItem = ({ item }: { item: FriendshipSelect }) => (
    <View style={[commonCardStyles.cardContainer, styles.friendshipItem]}>
      <View style={styles.friendshipInfo}>
        <Text style={[styles.friendshipText, { color: colors.text }]}>
          {t('friend_id')}: {item.user2Id}
        </Text>
        <Text style={[styles.friendshipText, { color: colors.textSecondary }]}>
          {t('server')}: {item.serverId}
        </Text>
        <Text style={[styles.friendshipText, { color: colors.textSecondary }]}>
          {t('status')}: {item.status}
        </Text>
      </View>
      <View style={styles.friendshipActions}>
        <TouchableOpacity onPress={() => handleEditFriendship(item.id)} style={styles.actionButton}>
          <Ionicons name="pencil-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDeleteFriendship(item.id)} style={styles.actionButton}>
          <Ionicons name="trash-outline" size={24} color={colors.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={commonContainerStyles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t('your_friendships')}</Text>
      <FlatList
        data={friendships}
        renderItem={renderFriendshipItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            {t('no_friendships_found')}
          </Text>
        }
      />
      <TouchableOpacity
        style={[styles.floatingButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('FriendshipForm', {})}
      >
        <Ionicons name="add-outline" size={30} color={colors.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  friendshipItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    padding: 15,
  },
  friendshipInfo: {
    flex: 1,
  },
  friendshipText: {
    fontSize: 16,
    marginBottom: 2,
  },
  friendshipActions: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  actionButton: {
    padding: 8,
    marginLeft: 5,
  },
  floatingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#6200EE', // Example color, replace with theme.colors.primary
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});

export default FriendshipListScreen;