import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Asset } from 'expo-asset';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
  const { t } = useTranslation();
  const navigation = useNavigation<ChoicesScreenNavigationProp>();
  const { colors } = useTheme();
  const webViewRef = useRef<WebView>(null);
  const [htmlUri, setHtmlUri] = useState<string | null>(null);
  const drizzleDb = useDrizzle();
  const { selectedStory } = useStoryStore();

  const [scenes, setScenes] = useState<SceneSelect[]>([]);
  const [choices, setChoices] = useState<ChoiceSelect[]>([]);
  const [loadingGraphData, setLoadingGraphData] = useState(true);
  const [graphDataError, setGraphDataError] = useState<string | null>(null);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

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
  });

  const onWebViewMessage = (event: WebViewMessageEvent) => {
    const { type, id, data, message } = JSON.parse(event.nativeEvent.data);
    if (type === 'NODE_CLICKED') {
      console.log('Node clicked:', id, data);
      // Implement tooltip logic here for scene details
    } else if (type === 'EDGE_CLICKED') {
      console.log('Edge clicked:', id, data);
      // Implement tooltip logic here for choice details
    } else if (type === 'WEBVIEW_CONSOLE') {
      // Now that we override console in WebView, these messages should come through
      console.log('WebView Console (from override):', message);
    }
  };

  useEffect(() => {
    // Only inject data to WebView if HTML is loaded, graph data is fetched, AND WebView itself is loaded
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
        const script = `
          if (window.setGraphElements) {
            window.setGraphElements(${JSON.stringify(elements)});
            true; // Return true to indicate success
          } else {
            false; // Return false if function is not defined yet
          }
        `;
        webViewRef.current.injectJavaScript(script);
      }
    }
  }, [htmlUri, loadingGraphData, scenes, choices, webViewLoaded]); // Added webViewLoaded to dependencies


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
    </View>
  );
};

export default ChoiceViewScreen;