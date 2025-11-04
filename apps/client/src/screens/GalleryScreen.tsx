import React from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme';

const GalleryScreen = () => {
  const { colors } = useTheme();

  // Placeholder data for gallery items
  const galleryItems = [
    { id: '1', title: 'Ancient Forest', uri: 'https://via.placeholder.com/150/FF0000/FFFFFF?text=Forest' },
    { id: '2', title: "Dragon's Eye", uri: 'https://via.placeholder.com/150/00FF00/FFFFFF?text=Dragon' },
    { id: '3', title: 'Mystic City', uri: 'https://via.placeholder.com/150/0000FF/FFFFFF?text=City' },
    { id: '4', title: "Hero's Portrait", uri: 'https://via.placeholder.com/150/FFFF00/000000?text=Hero' },
  ];

  const renderGalleryItem = ({ item }: { item: { id: string; title: string; uri: string } }) => (
    <View style={styles.galleryItem}>
      <Image source={{ uri: item.uri }} style={styles.image} />
      <Text style={styles.itemTitle}>{item.title}</Text>
    </View>
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 10,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 20,
      color: colors.text,
      paddingHorizontal: 10,
    },
    galleryItem: {
      flex: 1,
      margin: 5,
      backgroundColor: colors.card,
      borderRadius: 8,
      overflow: 'hidden',
      alignItems: 'center',
      paddingBottom: 10,
    },
    image: {
      width: '100%',
      height: 150,
      resizeMode: 'cover',
      marginBottom: 5,
    },
    itemTitle: {
      fontSize: 16,
      color: colors.text,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Gallery</Text>
      <FlatList
        data={galleryItems}
        renderItem={renderGalleryItem}
        keyExtractor={(item) => item.id}
        numColumns={2} // Display in 2 columns
        contentContainerStyle={{ paddingHorizontal: 5 }}
        ListEmptyComponent={<Text style={{ color: colors.textSecondary, textAlign: 'center' }}>No gallery items found.</Text>}
      />
    </View>
  );
};

export default GalleryScreen;
