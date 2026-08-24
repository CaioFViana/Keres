import type { ThemeColors } from '../../../../theme/ThemeColors';

/**
 * The collapsible-header + rounded-row look shared by every "related entities" section
 * (RelationManager, GenericRelationDisplay, and CharacterRelationManager). Plain object,
 * not StyleSheet.create - each consumer spreads this into its own StyleSheet.create call
 * alongside whatever extra styles it needs.
 */
export const relationSectionStyleDefs = (colors: ThemeColors) => ({
  container: {
    marginTop: 0,
  },
  relationItem: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: colors.surface,
    borderRadius: 8,
    // Um pouco mais de espaço que antes: com vários atributos por item (nome + 2-3 linhas
    // extras), 8px fazia itens consecutivos parecerem um bloco contínuo em vez de entradas
    // separadas.
    marginBottom: 12,
  },
  relationText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
  },
  relationItemContent: {
    flex: 1,
  },
  /** Nome do atributo dentro do conteúdo extra de um item (ex.: "Cena:", "Estado:"). */
  attributeLabel: {
    fontWeight: '700' as const,
    color: colors.text,
  },
  attributeValue: {
    color: colors.textSecondary,
  },
  attributeLine: {
    fontSize: 14,
    marginTop: 2,
  },
  chevron: {
    marginLeft: 8,
  },
  collapsibleHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.card,
    borderRadius: 8,
    marginBottom: 10,
    borderColor: colors.border,
    borderWidth: 1,
  },
  collapsibleHeaderText: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    color: colors.text,
  },
  collapsibleContent: {
    paddingHorizontal: 5,
    marginBottom: 10,
  },
});
