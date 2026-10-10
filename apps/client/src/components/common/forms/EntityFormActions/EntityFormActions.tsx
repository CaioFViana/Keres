import Button from '@/src/components/common/controls/Button/Button';

interface EntityFormActionsProps {
  /** An entity that exists can be deleted; a new one is only saved. */
  isEditing: boolean;
  /** Save and delete are both held while either is running. */
  busy: boolean;
  deleteLabel: string;
  saveLabel: string;
  onDelete: () => void;
  onSave: () => void;
}

/**
 * The footer of an entity form: delete on the left (only once the entity exists), save on the right.
 * The order is the visual order, so it is fixed here rather than by each form.
 */
function EntityFormActions({
  isEditing,
  busy,
  deleteLabel,
  saveLabel,
  onDelete,
  onSave,
}: EntityFormActionsProps) {
  return (
    <>
      {isEditing && (
        <Button variant="destructive" onPress={onDelete} disabled={busy}>
          {deleteLabel}
        </Button>
      )}
      <Button onPress={onSave} disabled={busy}>
        {saveLabel}
      </Button>
    </>
  );
}

export default EntityFormActions;
