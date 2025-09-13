import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View, Pressable } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/context/AuthContext';
import { useThemeColor } from '@/hooks/use-theme-color';
import { SuggestionResponse } from '@keres/shared';

interface SuggestionSelectProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

export default function SuggestionSelect({
  label,
  value,
  onChangeText,
  placeholder,
}: SuggestionSelectProps) {
  const { apiClient, token, userId } = useAuth();

  const [suggestionTypes, setSuggestionTypes] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>('');
  const [suggestionsForType, setSuggestionsForType] = useState<SuggestionResponse[]>([]);
  const [selectedSuggestionValue, setSelectedSuggestionValue] = useState<string>('');

  const [loadingTypes, setLoadingTypes] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false); // New state

  const inputBorderColor = useThemeColor({}, 'borderColor'); // Default border color
  const inputTextColor = useThemeColor({}, 'text'); // Default text color
  const inputBackgroundColor = useThemeColor({}, 'background'); // Default background color

  // Fetch unique suggestion types on component mount
  useEffect(() => {
    const fetchTypes = async () => {
      if (!apiClient || !token || !userId) {
        setLoadingTypes(false);
        return;
      }

      try {
        setLoadingTypes(true);
        setError(null);
        const response = await apiClient.request<string[]>('/suggestions/types', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setSuggestionTypes(response);
        if (response.length > 0) {
          setSelectedType(response[0]); // Select the first type by default
        }
      } catch (err: any) {
        console.error('Failed to fetch suggestion types:', err);
        setError(err.message || 'Failed to fetch types');
      } finally {
        setLoadingTypes(false);
      }
    };

    fetchTypes();
  }, [apiClient, token, userId]);

  // Fetch suggestions for the selected type
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!selectedType || selectedType === '' || !apiClient || !token || !userId) {
        setSuggestionsForType([]);
        setLoadingSuggestions(false);
        return;
      }

      try {
        setLoadingSuggestions(true);
        setError(null);
        const response = await apiClient.request<{ items: SuggestionResponse[]; totalItems: number }>(
          `/suggestions/user/${userId}/type/${selectedType}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        setSuggestionsForType(response.items);
        if (response.items.length > 0) {
          setSelectedSuggestionValue(response.items[0].value); // Select first suggestion by default
        } else {
          setSelectedSuggestionValue('');
        }
      } catch (err: any) {
        console.error(`Failed to fetch suggestions for type ${selectedType}:`, err);
        setError(err.message || 'Failed to fetch suggestions');
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchSuggestions();
  }, [selectedType, apiClient, token, userId]);

  // Update parent form value when a suggestion is selected
  useEffect(() => {
    if (selectedSuggestionValue !== null) {
      onChangeText(selectedSuggestionValue);
    }
  }, [selectedSuggestionValue, onChangeText]);

  return (
    <View style={styles.container}>
      <ThemedText style={styles.label}>{label}:</ThemedText>
      {error && <ThemedText style={styles.errorText}>{error}</ThemedText>}

      <View style={styles.suggestionsCard}>
        <View style={styles.suggestionsHeader}>
          <ThemedText style={styles.cardLabel}>Suggestions:</ThemedText>
          <Pressable onPress={() => setShowTooltip(!showTooltip)} style={styles.helpIconContainer}>
            <ThemedText style={styles.helpIcon}>?</ThemedText>
          </Pressable>
        </View>
        {showTooltip && (
          <ThemedText style={styles.tooltipText}>
            Suggestions are pre-defined values to help you quickly and consistently fill in information. First, select a 'Type' of suggestion (e.g., 'Genre', 'Character Trait'). Then, choose a specific 'Suggestion' from the list. The selected suggestion will appear in the text field below, which you can also edit manually.
          </ThemedText>
        )}

        {loadingTypes ? (
          <ActivityIndicator size="small" />
        ) : (
          <Picker
            selectedValue={selectedType}
            onValueChange={(itemValue: string) => setSelectedType(itemValue)}
            style={[styles.picker, { borderColor: inputBorderColor }]}
          >
            <Picker.Item label="Select Type" value="" /> {/* Added empty value option */}
            {suggestionTypes.length === 0 ? (
              <Picker.Item label="No types available" value="" />
            ) : (
              suggestionTypes.map((type) => (
                <Picker.Item key={type} label={type} value={type} />
              ))
            )}
          </Picker>
        )}

        {selectedType !== '' && (loadingSuggestions ? (
          <ActivityIndicator size="small" />
        ) : (
          <Picker
            selectedValue={selectedSuggestionValue}
            onValueChange={(itemValue: string) => setSelectedSuggestionValue(itemValue)}
            style={[styles.picker, { borderColor: inputBorderColor }]}
          >
            <Picker.Item label="Select Suggestion" value="" /> {/* Added empty value option */}
            {suggestionsForType.length === 0 ? (
              <Picker.Item label="No suggestions available" value="" />
            ) : (
              suggestionsForType.map((suggestion) => (
                <Picker.Item key={suggestion.id} label={suggestion.value} value={suggestion.value} />
              ))
            )}
          </Picker>
        ))}
      </View>

      <TextInput
        style={[styles.input, { borderColor: inputBorderColor, color: inputTextColor, backgroundColor: inputBackgroundColor }]}
        placeholder={placeholder}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="words"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
  label: {
    marginBottom: 5,
    alignSelf: 'flex-start',
  },
  cardLabel: { // New style for the label inside the card
    fontSize: 16,
    fontWeight: 'bold',
  },
  picker: {
    width: '100%',
    height: 50,
    borderWidth: 1,
    borderRadius: 5,
    marginBottom: 10,
  },
  input: {
    width: '100%',
    padding: 10,
    borderWidth: 1,
    borderRadius: 5,
  },
  errorText: {
    color: 'red',
    marginBottom: 10,
  },
  suggestionsCard: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  helpIconContainer: {
    marginLeft: 8,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpIcon: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tooltipText: {
    fontSize: 12,
    color: '#555',
    marginBottom: 10,
    padding: 5,
    backgroundColor: '#e9e9e9',
    borderRadius: 5,
  },
});
