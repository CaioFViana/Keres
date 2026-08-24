import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BackHandler } from 'react-native';
import { useHeaderBackActionStore } from '../state/headerBackActionStore';

interface BackButtonHandlerOptions {
  /**
   * Retained for existing callers. Drawer navigators own visible header navigation, so this
   * option no longer changes the header from a nested screen.
   */
  showWebBackButton?: boolean;
  /**
   * Para onde voltar quando o padrão está errado.
   *
   * `goBack` volta dentro do stack em foco, o que é certo quase sempre. Não é quando a tela foi
   * aberta a partir de *outro* stack do drawer: a comparação de status aberta do detalhe de um
   * personagem cairia na lista de status, e não de volta no personagem, porque a pilha de
   * status começa na lista dela. Quem sabe de onde veio passa a volta correta aqui.
   */
  onBack?: () => void;
}

/**
 * Custom hook to handle hardware back button presses for nested navigators.
 * It prioritizes going back within the current navigator. If at the root of the nested navigator,
 * it attempts to go back in the parent navigator (DrawerNavigator). If the parent cannot go back,
 * it returns false to allow other BackHandlers (like the app exit handler) to process the event.
 */
export const useBackButtonHandler = ({
  showWebBackButton = false,
  onBack,
}: BackButtonHandlerOptions = {}) => {
  const navigation = useNavigation();
  const setBackAction = useHeaderBackActionStore((state) => state.setBackAction);
  const clearBackAction = useHeaderBackActionStore((state) => state.clearBackAction);
  const consumeCrossStackReturnAction = useHeaderBackActionStore(
    (state) => state.consumeCrossStackReturnAction,
  );
  // Um ref mantém a volta customizada fora das dependências dos efeitos: o chamador quase
  // sempre passa uma função nova a cada render, e sem isto o handler se registraria de novo
  // a cada tecla digitada na tela.
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useFocusEffect(
    useCallback(() => {
      if (!showWebBackButton) {
        return undefined;
      }

      const backAction = () => {
        if (onBackRef.current) onBackRef.current();
        else {
          const crossStackReturn = consumeCrossStackReturnAction();
          if (crossStackReturn) crossStackReturn();
          else navigation.goBack();
        }
      };
      setBackAction(backAction);

      return () => clearBackAction(backAction);
    }, [
      clearBackAction,
      consumeCrossStackReturnAction,
      navigation,
      setBackAction,
      showWebBackButton,
    ]),
  );

  useEffect(() => {
    const backAction = () => {
      // 0. Volta customizada: quem abriu a tela sabe para onde ela deve voltar.
      if (onBackRef.current) {
        onBackRef.current();
        return true;
      }
      const crossStackReturn = consumeCrossStackReturnAction();
      if (crossStackReturn) {
        crossStackReturn();
        return true;
      }
      // 1. Try to go back within the current navigator (nested stack)
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true; // Event handled
      } else {
        // 2. If the current nested stack cannot go back, delegate to the parent navigator (DrawerNavigator).
        const parentNavigation = navigation.getParent(); // This is the DrawerNavigator's navigation object

        if (parentNavigation && parentNavigation.canGoBack()) {
          // Check if parent can go back
          parentNavigation.goBack(); // Attempt to go back in the parent (DrawerNavigator)
          return true; // Event handled
        }
        // If no parent navigation, or if the parent cannot go back,
        // return false to allow the event to propagate to other BackHandlers.
        // This is crucial for the MainDashboardScreen's "double press to exit" logic.
        return false; // Event not handled by this hook
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [consumeCrossStackReturnAction, navigation]);
};
