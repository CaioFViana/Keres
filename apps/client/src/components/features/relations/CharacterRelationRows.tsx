import React from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CharacterRelation } from '@keres/shared/entities/CharacterRelation';
import { CharacterSelect } from '@/src/db/schemas/characters';
import { useNavigateToEntityDetail } from '@/src/hooks/useNavigateToEntityDetail';
import { useTheme } from '@/src/theme';

interface Props {
  characterId: string;
  relations: CharacterRelation[];
  characters: CharacterSelect[];
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

const CharacterRelationRows: React.FC<Props> = ({
  characterId,
  relations,
  characters,
  expanded,
  onExpandedChange,
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigateToDetail = useNavigateToEntityDetail();
  const byId = new Map(characters.map((character) => [character.id, character]));
  const ownRelations = relations.filter(
    (relation) => relation.character1Id === characterId || relation.character2Id === characterId,
  );
  if (!ownRelations.length) return null;

  return (
    <View style={{ marginTop: 10 }}>
      <TouchableOpacity
        onPress={() => onExpandedChange(!expanded)}
        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}
      >
        <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: '700' }}>
          {t('character_relations_title')} ({ownRelations.length})
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded &&
        ownRelations.map((relation) => {
          const otherId =
            relation.character1Id === characterId ? relation.character2Id : relation.character1Id;
          return (
            <View
              key={relation.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 7,
                borderTopWidth: 1,
                borderTopColor: colors.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>
                  {byId.get(otherId)?.name ?? otherId}
                </Text>
                <Text style={{ color: colors.textSecondary, marginTop: 2 }}>
                  {relation.relationType}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => navigateToDetail('Character', otherId)}
                style={{ padding: 6 }}
              >
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          );
        })}
    </View>
  );
};

export default CharacterRelationRows;
