import React from 'react';
import ThemedFullscreenModal from '@/src/components/layout/ThemedFullscreenModal/ThemedFullscreenModal';
import { usePresenceMatrixViewerStore } from '../../../state/presenceMatrixViewerStore';
import PresenceMatrixViewerContent from './PresenceMatrixViewerContent';

const PresenceMatrixViewerOverlay: React.FC = () => {
  const request = usePresenceMatrixViewerStore((state) => state.request);
  const close = usePresenceMatrixViewerStore((state) => state.close);
  return (
    <ThemedFullscreenModal visible={request !== null} onRequestClose={close}>
      {request && (
        <PresenceMatrixViewerContent
          key={`${request.kind}-${request.kind === 'item' ? request.itemId : request.characterId}`}
          request={request}
          onClose={close}
        />
      )}
    </ThemedFullscreenModal>
  );
};
export default PresenceMatrixViewerOverlay;
