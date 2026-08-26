import { create } from 'zustand';

type BackAction = () => void;

interface HeaderBackActionState {
  backAction?: BackAction;
  crossStackReturnAction?: BackAction;
  setBackAction: (backAction: BackAction) => void;
  clearBackAction: (backAction: BackAction) => void;
  setCrossStackReturnAction: (action: BackAction) => void;
  consumeCrossStackReturnAction: () => BackAction | undefined;
}

/**
 * Connects a Drawer-owned header to the navigation object owned by the focused child Stack.
 * The Drawer can render the affordance, but only the child navigator can reliably go back.
 */
export const useHeaderBackActionStore = create<HeaderBackActionState>((set, get) => ({
  backAction: undefined,
  crossStackReturnAction: undefined,
  setBackAction: (backAction) => set({ backAction }),
  clearBackAction: (backAction) =>
    set((state) => (state.backAction === backAction ? { backAction: undefined } : state)),
  setCrossStackReturnAction: (crossStackReturnAction) => set({ crossStackReturnAction }),
  consumeCrossStackReturnAction: () => {
    const action = get().crossStackReturnAction;
    set({ crossStackReturnAction: undefined });
    return action;
  },
}));
