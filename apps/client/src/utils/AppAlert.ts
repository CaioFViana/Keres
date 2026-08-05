import { AppAlertButton, AppAlertOptions, useAppAlertStore } from '../state/appAlertStore';

/**
 * Substituto do `Alert.alert` do React Native: na web, `react-native-web`'s Alert é um
 * no-op silencioso (`static alert() {}` - node_modules/react-native-web/dist/exports/Alert),
 * então qualquer confirmação (excluir história, descartar alterações...) simplesmente não
 * aparecia. Mesma assinatura de `Alert.alert`, então trocar o import basta - a UI de verdade
 * é um `Modal` (`AppAlertHost`, montado uma vez em `App.tsx`), que já funciona em todas as
 * plataformas (mesma base do `SyncConflictModal`, que sempre funcionou na web).
 */
export const AppAlert = {
  alert(title: string, message?: string, buttons?: AppAlertButton[], options?: AppAlertOptions): void {
    useAppAlertStore.getState().show(title, message, buttons, options);
  },
};
