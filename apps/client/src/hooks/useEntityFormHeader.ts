import { useFormResetHeaderAction } from '@/src/hooks/useFormResetHeaderAction';
import { useScreenHeader } from '@/src/hooks/useScreenHeader';

type UseEntityFormHeaderOptions = {
  title: string;
  isEditing: boolean;
  isDirty: boolean;
  resetForm: () => void;
};

/**
 * The parent-navigator header of a durable entity form: its title (create or edit) and the
 * header-right reset action.
 */
export function useEntityFormHeader({
  title,
  isEditing,
  isDirty,
  resetForm,
}: UseEntityFormHeaderOptions): void {
  const resetHeaderAction = useFormResetHeaderAction({ isEditing, isDirty, resetForm });

  useScreenHeader({
    target: 'parent',
    title,
    actions: resetHeaderAction,
  });
}
