import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';

type ListingDetailStackParamList = {
  Listing: { entityType: string };
  Detail: { entityType: string; itemId: string };
};

type ListingScreenRouteProp = RouteProp<ListingDetailStackParamList, 'Listing'>;

type ListingScreenNavigationProp = NativeStackNavigationProp<ListingDetailStackParamList, 'Listing'>;

const ListingScreen = () => {
  const route = useRoute<ListingScreenRouteProp>();
  const navigation = useNavigation<ListingScreenNavigationProp>();
  const { entityType } = route.params;
  const { colors } = useTheme();

  // Placeholder data - in a real app, this would come from a store or API
  const data = Array.from({ length: 10 }, (_, i) => ({
    id: `item-${i + 1}`,
    name: `${entityType} Item ${i + 1}`,
  }));

  const handlePressItem = (itemId: string) => {
    navigation.navigate('Detail', { entityType, itemId });
  };

  const renderItem = ({ item }: { item: { id: string; name: string } }) => (
    <TouchableOpacity style={styles.itemContainer} onPress={() => handlePressItem(item.id)}>
      <Text style={styles.itemText}>{item.name}</Text>
    </TouchableOpacity>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
    },
    itemContainer: {
      padding: 15,
      backgroundColor: colors.card,
      borderRadius: 8,
      marginBottom: 10,
    },
    itemText: {
      fontSize: 18,
      color: colors.text,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{entityType} List</Text>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary }}>No {entityType.toLowerCase()} found.</Text>}
      />
    </View>
  );
};

export default ListingScreen;
