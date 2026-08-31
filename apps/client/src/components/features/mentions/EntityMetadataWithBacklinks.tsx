import EntityMetadata, {
  type EntityMetadataProps,
} from '@/src/components/common/display/EntityMetadata/EntityMetadata';
import type { NavigableEntityType } from '@/src/utils/entityNavigation';
import { MentionBacklinksSection } from './MentionBacklinksSection';

interface Props extends EntityMetadataProps {
  entityType?: NavigableEntityType;
  entityId?: string;
}

/**
 * Detail-screen composition for metadata and automatic prose backlinks.
 *
 * `EntityMetadata` deliberately remains a pure display component: following a backlink needs
 * navigation state, which is a feature concern rather than metadata formatting.
 */
const EntityMetadataWithBacklinks = ({ entityType, entityId, ...metadata }: Props) => (
  <>
    {entityType && entityId && (
      <MentionBacklinksSection entityType={entityType} entityId={entityId} />
    )}
    <EntityMetadata {...metadata} />
  </>
);

export default EntityMetadataWithBacklinks;
