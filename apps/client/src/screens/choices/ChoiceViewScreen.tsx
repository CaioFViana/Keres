import { useBackButtonHandler } from '@/src/hooks/useBackButtonHandler';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useDrizzle } from '../../db';
import { ChoiceSelect, SceneSelect } from '../../db/schema';
import { createChoiceService } from '../../services/ChoiceService';
import { createSceneService } from '../../services/SceneService';
import { useStoryStore } from '../../state/storyStore';
import { useTheme } from '../../theme';
import { ChoicesScreenNavigationProp } from './ChoiceListScreen';

interface GraphElement {
  data: {
    id: string;
    label?: string;
    entityType: 'Scene' | 'Choice';
    source?: string; // For edges
    target?: string; // For edges
    [key: string]: any; // Allow other properties from SceneSelect or ChoiceSelect
  };
}

const ChoiceViewScreen = () => {
  useBackButtonHandler()
  const { t } = useTranslation();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();
  const { colors } = useTheme(); // Get current theme colors
  const webViewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();

  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [loadingGraphData, setLoadingGraphData] = useState(true);
  const [graphDataError, setGraphDataError] = useState<string | null>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipData, setTooltipData] = useState<any | null>(null);
  // For simplicity, position will be centered. More complex positioning would require
  // mapping WebView coordinates to RN layout coordinates, which is beyond this initial scope.

  const sceneServiceRef = useRef<ReturnType<typeof createSceneService> | null>(null);
  const choiceServiceRef = useRef<ReturnType<typeof createChoiceService> | null>(null);

  useEffect(() => {
    async function loadHtml() {
      try {
        const asset = Asset.fromModule(require('./GraphView.html'));
        await asset.downloadAsync();
        const loadedUri = asset.localUri || asset.uri;
        setHtmlUri(loadedUri);
        console.log('Loaded HTML URI:', loadedUri);
      } catch (error) {
        console.error('Failed to load GraphView.html asset:', error);
        // Fallback or error state handling for HTML loading
      }
    }
    loadHtml();
  }, []);

  useEffect(() => {
    if (drizzleDb && selectedStory?.id) {
      if (!sceneServiceRef.current) sceneServiceRef.current = createSceneService(drizzleDb);
      if (!choiceServiceRef.current) choiceServiceRef.current = createChoiceService(drizzleDb);

      const fetchGraphData = async () => {
        setLoadingGraphData(true);
        try {
          const fetchedScenes = await sceneServiceRef.current!.getScenesByStoryId(selectedStory.id);
          const fetchedChoices = await choiceServiceRef.current!.getChoicesByStoryId(selectedStory.id);
          setScenes(fetchedScenes);
          setChoices(fetchedChoices);
          setGraphDataError(null);
        } catch (error) {
          console.error('Failed to fetch graph data:', error);
          setGraphDataError(t('failed_to_load_graph_data'));
        } finally {
          setLoadingGraphData(false);
        }
      };
      fetchGraphData();
    }
  }, [drizzleDb, selectedStory?.id, t]);

  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ title: t('choice_view_title'), headerRight: undefined });
    }, [navigation, t])
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
    },
    errorText: {
      color: colors.error,
      fontSize: 16,
      textAlign: 'center',
      marginHorizontal: 20,
    },
    loadingText: {
      color: colors.text,
      fontSize: 16,
      marginTop: 10,
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalContent: {
      backgroundColor: colors.surface,
      padding: 20,
      borderRadius: 10,
      width: '80%',
      maxHeight: '80%',
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 10,
    },
    modalDetailText: {
      fontSize: 16,
      color: colors.text,
      marginBottom: 5,
    },
    modalCloseButton: {
      marginTop: 20,
      padding: 10,
      backgroundColor: colors.primary,
      borderRadius: 5,
      alignItems: 'center',
    },
    modalCloseButtonText: {
      color: colors.onPrimary,
      fontWeight: 'bold',
    },
  });

  const onWebViewMessage = (event: WebViewMessageEvent) => {
    const { type, id, data, message } = JSON.parse(event.nativeEvent.data);
    if (type === 'NODE_CLICKED') {
      console.log('Node clicked:', id, data);
      setTooltipData({ type: 'Node', ...data });
      setTooltipVisible(true);
    } else if (type === 'EDGE_CLICKED') {
      console.log('Edge clicked:', id, data);
      const sourceScene = scenes.find(s => s.id === data.source);
      const targetScene = scenes.find(s => s.id === data.target);
      setTooltipData({
        type: 'Edge',
        ...data,
        sourceSceneName: sourceScene ? sourceScene.name : 'Unknown',
        targetSceneName: targetScene ? targetScene.name : 'Unknown',
      });
      setTooltipVisible(true);
    } else if (type === 'WEBVIEW_CONSOLE') {
      // Now that we override console in WebView, these messages should come through
      console.log('WebView Console (from override):', message);
    }
  };

  useEffect(() => {
    // Only send data to WebView if HTML is loaded, graph data is fetched, AND WebView itself is loaded
    if (htmlUri && !loadingGraphData && webViewRef.current && webViewLoaded) {
      const elements: GraphElement[] = [];

      // Add scenes as nodes
      scenes.forEach(scene => {
        elements.push({
          data: {
            // id: scene.id, // Removed redundant id, spread will provide it
            label: scene.name,
            entityType: 'Scene',
            ...scene // Spread all scene data
          }
        });
      });

      // Add choices as edges
      choices.forEach(choice => {
        if (choice.sceneId && choice.nextSceneId) {
          elements.push({
            data: {
              // id: choice.id, // Removed redundant id, spread will provide it
              source: choice.sceneId,
              target: choice.nextSceneId,
              label: choice.text,
              entityType: 'Choice',
              ...choice // Spread all choice data
            }
          });
        }
      });

      if (elements.length > 0) {
        console.log('Injecting elements to WebView:', elements);
        // Stringify colors object to pass it correctly
        const themeColorsJson = JSON.stringify(colors);
        const script = `
          if (window.setGraphElements) {
            window.setGraphElements(${JSON.stringify(elements)}, ${themeColorsJson});
            true; // Return true to indicate success
          } else {
            console.error('window.setGraphElements is not defined in WebView.');
            false; // Return false if function is not defined yet
          }
        `;
        webViewRef.current.injectJavaScript(script);
      }
    }
  }, [htmlUri, loadingGraphData, scenes, choices, webViewLoaded, colors]); // Added colors to dependencies


  if (!htmlUri) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('loading_graph_view')}</Text>
      </View>
    );
  }

  if (graphDataError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{graphDataError}</Text>
      </View>
    );
  }

  if (loadingGraphData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('loading_graph_data')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ uri: htmlUri }}
        style={styles.container}
        onMessage={onWebViewMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        allowFileAccessFromFileURLs={true}
        mixedContentMode="always"
        onLoadEnd={() => {
          console.log('RN WebView: onLoadEnd triggered. Setting webViewLoaded to true.');
          setWebViewLoaded(true);
        }}
      />

      {tooltipVisible && tooltipData && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={tooltipVisible}
          onRequestClose={() => setTooltipVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPressOut={() => setTooltipVisible(false)} // Dismiss on tap outside
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {tooltipData.type === 'Node' ? t('scene_details_title') : t('choice_details_title')}
              </Text>
              <Text style={styles.modalDetailText}>ID: {tooltipData.id}</Text>
              <Text style={styles.modalDetailText}>Label: {tooltipData.label}</Text>
              {tooltipData.entityType === 'Scene' && (
                <>
                  <Text style={styles.modalDetailText}>Name: {tooltipData.name}</Text>
                  <Text style={styles.modalDetailText}>Summary: {tooltipData.summary}</Text>
                </>
              )}
              {tooltipData.entityType === 'Choice' && (
                <>
                  <Text style={styles.modalDetailText}>Text: {tooltipData.text}</Text>
                  <Text style={styles.modalDetailText}>Source Scene: {tooltipData.sourceSceneName}</Text>
                  <Text style={styles.modalDetailText}>Target Scene: {tooltipData.targetSceneName}</Text>
                </>
              )}
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setTooltipVisible(false)}>
                <Text style={styles.modalCloseButtonText}>{t('close')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
};

export default ChoiceViewScreen;