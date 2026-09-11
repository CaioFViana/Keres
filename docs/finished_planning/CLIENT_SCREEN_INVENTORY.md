# Inventário das telas do client

Atualizado após a migração de 2026-09-05. Inclui os 98 arquivos TSX do diretório de telas, inclusive conteúdo reutilizado sem navegação própria. self identifica o navegador da tela; parent, o drawer que exibe seu header.

| Arquivo em apps/client/src/screens | Dono do header | Ações | Container | Estado | Retorno |
| --- | --- | --- | --- | --- | --- |
| boards/BoardCanvasScreen.tsx | parent | especializadas | layout especializado | ScreenLoading | retorno customizado |
| boards/BoardListScreen.tsx | parent | declarativas | layout especializado | — | retorno padrão |
| characterrelations/CharacterRelationGraphScreen.tsx | parent | nenhuma | layout especializado | ScreenLoading | retorno do stack |
| characters/CharacterDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| characters/CharacterFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| characters/CharacterListScreen.tsx | parent | declarativas | ScreenContainer | carga inicial separada | retorno padrão |
| comments/CommentListScreen.tsx | parent | nenhuma | layout especializado | — | retorno padrão |
| customization/CustomizationIndexScreen.tsx | parent | nenhuma | layout especializado | — | retorno padrão |
| customization/StoryAppearanceScreen.tsx | parent | nenhuma | KeyboardAwareScreen (fluxo próprio) | — | retorno do stack |
| customization/StoryArcFormScreen.tsx | parent | nenhuma | EntityFormContainer | — | retorno do stack |
| customization/StoryArcListScreen.tsx | parent | declarativas | layout especializado | — | retorno do stack |
| customization/ThemePreview.tsx | conteúdo embutido | navegador/conteúdo | layout especializado | — | navegador/conteúdo |
| customization/VocabularyScreen.tsx | parent | nenhuma | KeyboardAwareScreen (fluxo próprio) | — | retorno do stack |
| enterstack/AppSettingsScreen.tsx | self | nenhuma | KeyboardAwareScreen (fluxo próprio) | — | retorno padrão |
| enterstack/ChangePasswordScreen.tsx | parent | nenhuma | KeyboardAwareScreen (fluxo próprio) | ScreenLoading | retorno do stack |
| enterstack/ColdInstallScreen.tsx | sem header (instalação) | navegador/conteúdo | FormContainer (instalação) | — | navegador/conteúdo |
| enterstack/FriendDetailScreen.tsx | parent | nenhuma | DetailContainer | ScreenLoading | retorno do stack |
| enterstack/FriendshipFormScreen.tsx | parent | nenhuma | layout especializado | estado específico | retorno do stack |
| enterstack/FriendshipListScreen.tsx | parent | declarativas | layout especializado | — | retorno padrão |
| enterstack/ImportExportScreen.tsx | self | nenhuma | layout especializado | ScreenLoading | retorno padrão |
| enterstack/MyProfileScreen.tsx | parent | nenhuma | KeyboardAwareScreen (fluxo próprio) | ScreenLoading | retorno do stack |
| enterstack/PublishStoryScreen.tsx | self | nenhuma | layout especializado | ScreenLoading | retorno padrão |
| enterstack/ServerManagementScreen.tsx | parent | declarativas | layout especializado | estado específico | retorno padrão |
| enterstack/ServerRegistrationScreen.tsx | parent | nenhuma | KeyboardAwareScreen (fluxo próprio) | estado específico | retorno do stack |
| enterstack/StoryFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| enterstack/StorySelectionScreen.tsx | parent | declarativas | layout especializado | — | retorno padrão |
| examplestories/ExampleStoriesScreen.tsx | self | nenhuma | layout especializado | — | retorno padrão |
| gallery/GalleryDetailContent.tsx | conteúdo embutido | navegador/conteúdo | layout especializado | ScreenLoading | navegador/conteúdo |
| gallery/GalleryDetailScreen.tsx | parent | nenhuma | layout especializado | — | retorno do stack |
| gallery/GalleryListScreen.tsx | parent | declarativas | layout especializado | — | retorno padrão |
| globalsearch/GlobalSearchScreen.tsx | self | nenhuma | layout especializado | estado específico | retorno do stack |
| help/HelpIndexScreen.tsx | navegador de documentação | navegador/conteúdo | layout especializado | — | navegador/conteúdo |
| help/HelpPageScreen.tsx | navegador de documentação | navegador/conteúdo | layout especializado | — | retorno customizado |
| itemJourneys/ItemJourneyDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| itemJourneys/ItemJourneyFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| items/ItemDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| items/ItemFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| items/ItemListScreen.tsx | parent | declarativas | layout especializado | carga inicial separada | retorno padrão |
| location-maps/LocationMapListScreen.tsx | parent | declarativas | layout especializado | — | retorno customizado |
| location-maps/LocationMapScreen.tsx | parent | especializadas | layout especializado | ScreenLoading | retorno customizado |
| locations/LocationDetailsScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| locations/LocationFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| locations/LocationGraphScreen.tsx | parent | nenhuma | layout especializado | ScreenLoading | retorno do stack |
| locations/LocationListScreen.tsx | parent | declarativas | layout especializado | carga inicial separada | retorno padrão |
| mainstorystack/MainDashboardScreen.tsx | self | declarativas | layout especializado | — | navegador/conteúdo |
| mainstorystack/StoryAnalysisScreen.tsx | self | nenhuma | layout especializado | ScreenLoading | retorno do stack |
| mainstorystack/StorySettingsScreen.tsx | self | nenhuma | KeyboardAwareScreen (fluxo próprio) | estado específico | retorno do stack |
| narrative-elements/chapters/ChapterDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| narrative-elements/chapters/ChapterFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| narrative-elements/chapters/NarrativeElementsListScreen.tsx | parent | declarativas | layout especializado | ScreenLoading | retorno padrão |
| narrative-elements/choices/ChoiceDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| narrative-elements/choices/ChoiceFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| narrative-elements/choices/ChoiceViewScreen.tsx | parent | nenhuma | layout especializado | ScreenLoading | retorno do stack |
| narrative-elements/scenes/SceneDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| narrative-elements/scenes/SceneFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| narrative-elements/timeline/StoryTimelineScreen.tsx | parent | nenhuma | layout especializado | estado específico | retorno do stack |
| notes/NoteDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| notes/NoteFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| notes/NoteListScreen.tsx | parent | declarativas | ScreenContainer | carga inicial separada | retorno padrão |
| operationlog/OperationLogDetailScreen.tsx | parent | nenhuma | layout especializado | estado específico | retorno do stack |
| operationlog/OperationLogListScreen.tsx | parent | nenhuma | layout especializado | — | retorno padrão |
| packs/PackBrowseScreen.tsx | parent | nenhuma | layout especializado | estado específico | retorno do stack |
| packs/PackFormScreen.tsx | parent | nenhuma | EntityFormContainer | ScreenLoading | retorno do stack |
| packs/PackListScreen.tsx | parent | nenhuma | layout especializado | estado específico | retorno do stack |
| packs/ShippedPacksScreen.tsx | parent | nenhuma | layout especializado | — | retorno do stack |
| plots/PlotDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| plots/PlotFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| plots/PlotListScreen.tsx | parent | declarativas | layout especializado | ScreenLoading | retorno padrão |
| plots/PlotMatrixScreen.tsx | parent | nenhuma | layout especializado | ScreenLoading | retorno do stack |
| plots/PlotProgressScreen.tsx | parent | declarativas | layout especializado | ScreenLoading | retorno do stack |
| plots/PlotReaderScreen.tsx | parent | nenhuma | layout especializado | ScreenLoading | retorno do stack |
| routes/RouteDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| routes/RouteFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| routes/RouteListScreen.tsx | parent | declarativas | layout especializado | ScreenLoading | retorno do stack |
| routes/RouteReaderScreen.tsx | parent | declarativas | layout especializado | ScreenLoading | retorno do stack |
| routes/RouteStepsScreen.tsx | parent | nenhuma | layout especializado | estado específico | retorno do stack |
| routes/RouteTimelineScreen.tsx | parent | nenhuma | layout especializado | ScreenLoading | retorno do stack |
| routes/StoryNavigatorScreen.tsx | parent | nenhuma | layout especializado | ScreenLoading | retorno do stack |
| stats/StatComparisonScreen.tsx | parent | nenhuma | layout especializado | — | retorno customizado |
| stats/StatFormScreen.tsx | parent | nenhuma | EntityFormContainer | ScreenLoading | retorno do stack |
| stats/StatLadderScreen.tsx | parent | nenhuma | KeyboardAwareScreen (fluxo próprio) | estado específico | retorno do stack |
| stats/StatListScreen.tsx | parent | declarativas | layout especializado | — | retorno do stack |
| stats/StatRankingScreen.tsx | parent | nenhuma | layout especializado | — | retorno do stack |
| storycalendars/AgendaDateLookup.tsx | conteúdo embutido | navegador/conteúdo | layout especializado | — | navegador/conteúdo |
| storycalendars/StoryAgendaScreen.tsx | parent | nenhuma | layout especializado | estado específico | retorno do stack |
| storycalendars/StoryCalendarFormScreen.tsx | parent | nenhuma | EntityFormContainer | — | retorno do stack |
| storycalendars/StoryCalendarListScreen.tsx | parent | declarativas | layout especializado | — | retorno do stack |
| storyschema/StorySchemaFieldFormScreen.tsx | parent | nenhuma | EntityFormContainer | ScreenLoading | retorno do stack |
| storyschema/StorySchemaListScreen.tsx | parent | declarativas | layout especializado | — | retorno do stack |
| suggestions/SuggestionUsageScreen.tsx | parent | declarativas | layout especializado | estado específico | retorno customizado |
| suggestions/SuggestionsScreen.tsx | parent | declarativas | layout especializado | — | retorno do stack |
| tags/TagDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| tags/TagFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| tags/TagListScreen.tsx | parent | declarativas | ScreenContainer | carga inicial separada | retorno padrão |
| worldrules/WorldIndexScreen.tsx | parent | nenhuma | layout especializado | — | retorno padrão |
| worldrules/WorldRuleDetailScreen.tsx | parent | declarativas | DetailContainer | ScreenLoading | retorno do stack |
| worldrules/WorldRuleFormScreen.tsx | parent | nenhuma | EntityFormContainer | carga/salvamento separados | retorno do stack |
| worldrules/WorldRuleListScreen.tsx | parent | declarativas | ScreenContainer | carga inicial separada | retorno customizado |
