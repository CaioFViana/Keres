import { ThemeColors } from '../../theme/ThemeColors';

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
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: colors.surface,
    borderRadius: 8,
    marginBottom: 8,
  },
  relationText: {
    fontSize: 16,
    color: colors.text,
    flex: 1,
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
