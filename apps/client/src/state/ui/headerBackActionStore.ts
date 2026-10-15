import { create } from 'zustand';

type BackAction = () => void;

interface HeaderBackActionState {
  backAction?: BackAction;
  crossStackReturnAction?: BackAction;
  /** The screen the return belongs to: only a back from it takes the way back to where it was opened from. */
  crossStackReturnScreen?: string;
  setBackAction: (backAction: BackAction) => void;
  clearBackAction: (backAction: BackAction) => void;
  setCrossStackReturnAction: (action: BackAction, screen?: string) => void;
  /**
   * The way back to the screen that opened another stack, taken once. Asked from a screen other than
   * the one it was registered for - a form opened from the screen that was opened across stacks - it
   * stays, for the screen it belongs to.
   */
  consumeCrossStackReturnAction: (fromScreen?: string) => BackAction | undefined;
  /**
   * Forgets the way back registered for `screen`, or whichever is registered when no screen is given (the
   * menu starts the person afresh). A screen that is opened from inside its own stack too must
   * do this first: a return left by an earlier visit from another stack would otherwise be the one the
   * back button takes.
   */
  clearCrossStackReturnAction: (screen?: string) => void;
}

/**
 * Connects a Drawer-owned header to the navigation object owned by the focused child Stack.
 * The Drawer can render the affordance, but only the child navigator can reliably go back.
 */
export const useHeaderBackActionStore = create<HeaderBackActionState>((set, get) => ({
  backAction: undefined,
  crossStackReturnAction: undefined,
  crossStackReturnScreen: undefined,
  setBackAction: (backAction) => set({ backAction }),
  clearBackAction: (backAction) =>
    set((state) => (state.backAction === backAction ? { backAction: undefined } : state)),
  setCrossStackReturnAction: (crossStackReturnAction, crossStackReturnScreen) =>
    set({ crossStackReturnAction, crossStackReturnScreen }),
  clearCrossStackReturnAction: (screen) =>
    set((state) =>
      screen === undefined || state.crossStackReturnScreen === screen
        ? { crossStackReturnAction: undefined, crossStackReturnScreen: undefined }
        : state,
    ),
  consumeCrossStackReturnAction: (fromScreen) => {
    const { crossStackReturnAction: action, crossStackReturnScreen: screen } = get();
    if (!action) return undefined;
    if (screen !== undefined && fromScreen !== undefined && screen !== fromScreen) return undefined;
    set({ crossStackReturnAction: undefined, crossStackReturnScreen: undefined });
    return action;
  },
}));
