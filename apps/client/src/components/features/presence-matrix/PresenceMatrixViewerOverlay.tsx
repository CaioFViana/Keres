import React from 'react';
import { Modal } from 'react-native';
import { usePresenceMatrixViewerStore } from '../../../state/presenceMatrixViewerStore';
import PresenceMatrixViewerContent from './PresenceMatrixViewerContent';

const PresenceMatrixViewerOverlay: React.FC = () => {
  const request = usePresenceMatrixViewerStore((state) => state.request);
  const close = usePresenceMatrixViewerStore((state) => state.close);
  return (
    <Modal visible={request !== null} animationType="slide" onRequestClose={close}>
      {request && (
        <PresenceMatrixViewerContent
          key={`${request.kind}-${request.kind === 'item' ? request.itemId : request.characterId}`}
          request={request}
          onClose={close}
        />
      )}
    </Modal>
  );
};
export default PresenceMatrixViewerOverlay;
