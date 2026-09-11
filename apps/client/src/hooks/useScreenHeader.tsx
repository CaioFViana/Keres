import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import HeaderActions, {
  type HeaderAction,
} from '@/src/components/common/navigation/HeaderActions/HeaderActions';
import { setDocumentTitle } from '@/src/utils/documentTitle';

type ScreenHeaderOptions = {
  title: string;
  target: 'self' | 'parent';
  documentTitle?: string;
} & (
  | { actions?: readonly HeaderAction[]; renderActions?: never }
  | { actions?: never; renderActions: (() => React.ReactNode) | undefined }
);

/** The focused screen owns the visible header; blur never clears another screen's options. */
export function useScreenHeader({
  title,
  target,
  documentTitle = title,
  actions,
  renderActions,
}: ScreenHeaderOptions) {
  const navigation = useNavigation();
  const actionsRef = useRef(actions);
  useLayoutEffect(() => {
    actionsRef.current = actions;
  });

  // Inline commands may capture current form/entity state without resetting navigation options
  // on each render. Only presentation changes replace the header renderer.
  const presentation = JSON.stringify(
    actions?.map(({ onPress: _onPress, ...action }) => action) ?? [],
  );
  const headerRight = useMemo(() => {
    if (renderActions) return renderActions;
    const descriptors = JSON.parse(presentation) as Omit<HeaderAction, 'onPress'>[];
    if (!descriptors.some((action) => action.visible !== false)) return undefined;
    const currentActions = descriptors.map((action) => ({
      ...action,
      onPress: () => {
        const current = actionsRef.current?.find((candidate) => candidate.id === action.id);
        if (current && current.visible !== false && !current.disabled && !current.busy)
          current.onPress();
      },
    }));
    return function ScreenHeaderActions() {
      return <HeaderActions actions={currentActions} />;
    };
  }, [presentation, renderActions]);

  useFocusEffect(
    useCallback(() => {
      const owner = target === 'parent' ? navigation.getParent() : navigation;
      owner?.setOptions({ title, headerRight });
      setDocumentTitle(documentTitle);
    }, [navigation, target, title, documentTitle, headerRight]),
  );
}
