import SeeAlsoManager, {
  type SeeAlsoManagerHandle,
} from '@/src/components/features/seealso/SeeAlsoManager/SeeAlsoManager';
import type { SeeAlsoEntityType } from '@keres/shared';
import type { RefObject } from 'react';

interface EntitySeeAlsoManagerProps {
  /** The form keeps the handle to call `persistPending` once the entity has its real id. */
  managerRef: RefObject<SeeAlsoManagerHandle | null>;
  /** The entity the links are attached to. */
  target: { storyId: string; entityType: SeeAlsoEntityType; entityId: string };
}

/** The See also section of an entity form, always editable. */
export default function EntitySeeAlsoManager({ managerRef, target }: EntitySeeAlsoManagerProps) {
  return (
    <SeeAlsoManager
      ref={managerRef}
      storyId={target.storyId}
      entityType={target.entityType}
      entityId={target.entityId}
      editable={true}
    />
  );
}
