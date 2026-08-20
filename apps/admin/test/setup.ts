import { initI18n } from '../src/i18n';

/**
 * Inicia a tradução uma vez para toda a suíte, como as entradas do painel e do site fazem
 * antes de renderizar. Sem isto, `t()` devolve a própria chave e qualquer teste que afirme o
 * texto de uma tela falha por um motivo que não é o dele.
 *
 * O namespace padrão é `admin` porque é o que a maior parte dos testes renderiza; os testes do
 * site pedem `showcase` explicitamente quando precisam.
 */
initI18n('keres_test_language', 'admin');
