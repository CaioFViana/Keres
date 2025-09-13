import React, { useState } from 'react';
import { Modal, StyleSheet, View, Pressable } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import PickerSelect from '@/components/PickerSelect'; // Using generic PickerSelect

interface SuggestionModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSelect: (value: string) => void; // Callback for when a suggestion is selected
  // Props for the two selects inside the modal
  label1: string;
  options1: { label: string; value: string }[];
  value1: string;
  onChange1: (value: string) => void;

  label2: string;
  options2: { label: string; value: string }[];
  value2: string;
  onChange2: (value: string) => void;
}

export default function SuggestionModal({
  isVisible,
  onClose,
  onSelect,
  label1,
  options1,
  value1,
  onChange1,
  label2,
  options2,
  value2,
  onChange2,
}: SuggestionModalProps) {
  const handleSelectAndClose = (selectedValue: string) => {
    onSelect(selectedValue);
    onClose();
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <ThemedView style={styles.modalView}>
          <ThemedText type="subtitle">Select Suggestion</ThemedText>

          <PickerSelect
            label={label1}
            options={options1}
            selectedValue={value1}
            onValueChange={onChange1}
            placeholder={`Select ${label1}`}
          />

          <PickerSelect
            label={label2}
            options={options2}
            selectedValue={value2}
            onValueChange={(val) => {
              onChange2(val);
              handleSelectAndClose(val);
            }}
            placeholder={`Select ${label2}`}
          />

          <Pressable
            style={[styles.button, styles.buttonClose]}
            onPress={onClose}
          >
            <ThemedText style={styles.textStyle}>Cancel</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 22,
  },
  modalView: {
    margin: 20,
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    width: '80%', // Adjust modal width
    maxWidth: 400, // Max width for larger screens
  },
  button: {
    borderRadius: 20,
    padding: 10,
    elevation: 2,
    marginTop: 15,
  },
  buttonClose: {
    backgroundColor: '#2196F3',
  },
  textStyle: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
