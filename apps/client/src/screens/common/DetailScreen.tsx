import { useTheme } from '@/src/theme';
import { RouteProp, useRoute } from '@react-navigation/native';
import React from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

type ListingDetailStackParamList = {
  Listing: { entityType: string };
  Detail: { entityType: string; itemId: string };
};

type DetailScreenRouteProp = RouteProp<ListingDetailStackParamList, 'Detail'>;

const DetailScreen = () => {
  const route = useRoute<DetailScreenRouteProp>();
  const { entityType, itemId } = route.params;
  const { colors } = useTheme();

  const handleEdit = () => {
    console.log(`Editing ${entityType} with ID: ${itemId}`);
    // Navigate to an edit screen or open a modal for editing
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      marginBottom: 10,
      color: colors.text,
    },
    subtitle: {
      fontSize: 18,
      fontWeight: '600',
      marginTop: 15,
      marginBottom: 5,
      color: colors.text,
    },
    text: {
      fontSize: 16,
      color: colors.textSecondary,
      marginBottom: 5,
    },
    editButtonContainer: {
      marginTop: 20,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{entityType} Details</Text>
      <Text style={styles.text}>ID: {itemId}</Text>
      <Text style={styles.subtitle}>Information about {entityType} {itemId}</Text>
      <Text style={styles.text}>This is a placeholder for detailed information about the selected item.</Text>
      <Text style={styles.text}>More details will be loaded here based on the entity type and ID.</Text>
      <View style={styles.editButtonContainer}>
        <Button title="Edit" onPress={handleEdit} color={colors.primary} />
      </View>
    </View>
  );
};

export default DetailScreen;
