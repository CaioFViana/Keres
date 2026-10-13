# Plano de implementação — Legal, privacidade e loja (Keres 1.10)

Origem: avaliação de ToS dos dois lados + lei brasileira (LGPD 13.709/2018, ECA Digital/Lei
Felca 15.211/2025, Marco Civil 12.965/2014, CDC 8.078/90, Decreto 7.962/2013) + auditoria de
privacidade do código.
Estado em 2026-10-12 (revisado à noite): A–D de código estão **implementados na árvore de
trabalho, ainda não commitados** — os `[x]` abaixo foram conferidos no código e nos testes.
Decisão atual do dono (ver seção G): **contas 18+ verificadas em todo servidor** — isso
reabre B11/C18/F28 e cria as pendências G34–G42. Restam também o F31 (identidade do
operador — dados do dono) e os externos D21/D23, que só fecham depois da seção G.
Isto não é parecer jurídico: a validação final é o D23.

## Premissas travadas

- Soft-delete de conta com anonimização em 30 dias (`ACCOUNT_DELETION_GRACE_DAYS`), **com
  carve-outs**: prova mínima do aceite do ToS, registros financeiros, logs/auditoria — cada
  carve-out com **prazo definido** (ver F29), não retenção indefinida.
- **Modelo etário por camada (decisão atual, seção G):** uso offline livre, sem gate nem
  vigilância; **conta em servidor é 18+ verificada** — a exclusão de menores é deliberada
  para não existir conta de menor e, com isso, não incidir vínculo/supervisão parental
  (Lei 15.211/2025, Art. 24), o que quebraria o modelo de dados. Declarar 18+ sem verificar
  não produz esse efeito: a barreira precisa ser real.
- **Servidor oficial = híbrido:** conteúdo no caminho 1 (sem conteúdo sexual explícito,
  `AllowNSFW=false` permanente) e conta no caminho 2 (só adulto verificado no cadastro).
- **Servidores de terceiros:** cada operador escolhe o caminho de conteúdo — 1 (sem área
  +18) ou 2 (com área +18) — e responde pela escolha; conta 18+ verificada vale para todos.
- **Método de verificação (decisão do dono): serviço separado de conferência manual,
  no molde do payments.** Nada de provedor externo de aferição nem sinal de
  loja/sistema operacional (não pronto). A verificação de idade é um **serviço à parte**
  (interface própria estilo conector de pagamentos): quem quer confirmar +18 envia o
  documento **a esse serviço, operado pelo operador do seu servidor** (no oficial, pela
  equipe Keres; em terceiros, por aquele operador — a Keres como produto não recebe
  nada de servidor alheio). Um revisor humano confere, decide, e o serviço devolve ao
  servidor só a asserção assinada; aprovar liga `is_adult_verified`. Servidor caseiro
  (rede local/entre amigos, sem oferta ao público) pode **desabilitar** o serviço —
  com as travas da seção G. Docker e oficial sobem com ele ligado e obrigatório. Quem
  disponibiliza o serviço e responde pela conferência é o operador
  (Lei 15.211/2025, Arts. 9º e 14).
- Política de privacidade mora em `apps/api/src/legal/` e `apps/client/src/legal/`,
  versionada em en/pt no mesmo padrão dos ToS.
- `--backup` fora de escopo (servidores domésticos). Backups do oficial: Postgres no Docker,
  com rotação curta (ver F27).

## A. Textos legais

- [x] **A1.** Política de privacidade do app — `apps/client/src/legal/privacyPolicy.ts`
  (versionada, en/pt) + teste + leitura em Settings/onboarding.
- [x] **A2.** Política de privacidade do servidor oficial —
  `apps/api/src/legal/privacyPolicy.ts` + `GET /api/keres-privacy` pública
  (versão, data, en/pt) + teste. Mesmo conteúdo alimenta a página do site (D20).
- [x] **A3.** Revisar ToS do app (`clientTerms.ts`): §6 (ressalva legal, F30), §7 (sem
  "uso continuado = aceite", F26), §3/§8 (offline livre + gate no servidor, F28a).
  `clientTerms.test.ts` é estrutural — nada a atualizar.
- [x] **A4.** Revisar ToS do servidor (`serverTerms.ts`): §7 (F26), §9 por canal (F32),
  §10 como política contratual + recurso (F25), §11 com placeholder do operador (F31 —
  dados pendentes). `keresTos.test.ts` é estrutural — nada a atualizar.

## B. API (servidor oficial, controlador LGPD)

- [x] **B5.** Registro de aceite no cadastro — `terms_acceptances`
  `(userId, kind, version, textHash, method, acceptedAt)`; grava no registro e no
  re-aceite; teste (`termsAcceptance.integration.test.ts`).
- [x] **B6.** Checagem de versão no login/sync — `GET /auth/terms-status` sinaliza versão
  nova p/ o cliente reapresentar (re-gate). Teste.
- [x] **B7.** Prune com carve-outs — anonimiza em 30 dias, exceto prova do aceite, financeiro
  e auditoria. Ressalva jurídica em F29: hoje é **pseudonimização** (o `userId` estável
  permanece em contribuições e no aceite), não anonimização irreversível.
- [x] **B8.** Anonimizar ator na auditoria quando a conta é excluída (`auditService.scrubUser`).
- [x] **B9.** `GET /api/user/data` (exportação consolidada: perfil, amizades, mensagens,
  publicações, pagamentos, aceites). Art. 18, II e V. Teste. Limitar dados de terceiros
  (interlocutores/colaboradores) na exportação — ver F33.
- [x] **B10.** Expurgo do contato do site — `pruneSiteMessages`, retenção de 90 dias
  (`CONTACT_MESSAGE_RETENTION_DAYS`). Teste.
- [x] **B11.** Gate +18 — feito (ver G34–G37). Metade de conteúdo: `StoryNsfwService` recusa flag
  +18 no envio/publicação com `AllowNSFW=false` (padrão; no oficial, permanentemente
  desligado). Falta a metade de verificação (seção G): o serviço separado de conferência
  que liga `is_adult_verified` por asserção assinada — hoje a flag é ligada por admin,
  sem método. Reaberto pela decisão de manter contas 18+ verificadas.
- [x] **B12.** Denúncias tipificadas e unificadas — `REPORT_TYPES`/`REPORT_TARGETS`
  (íntimo, copyright, spam/abuso, ilegal, outro × história, usuário, mensagem, publicação),
  fila no admin. Testes. (A fundamentação legal do copyright foi corrigida em F25.)
- [x] **B13.** Backups automáticos do Postgres oficial — rotina (`apps/api/deploy/backup.sh`,
  serviço `backup` no compose) com retenção padrão de **90 dias** (teto, F27), volume
  isolado no serviço de backup, cópia externa em armazenamento criptografado e
  procedimento de reaplicar apagamentos pós-restauração (`deploy/README.md`).

## C. Client

- [x] **C14.** Aceite do app no ColdInstall — bloqueia avanço sem aceitar (clickwrap pleno);
  guarda timestamp + método (`clientTermsAcceptance.ts`). Testes.
- [x] **C15.** Checagem de versão no lançamento — reapresenta ToS do app em bump; re-gate
  por servidor quando B6 sinaliza. Testes.
- [x] **C16.** Leitura da política — padrão TermsModal: botão no onboarding + Settings. Testes.
- [x] **C17.** ServerDetail — abre ToS e política do servidor (rotas + cópia local). Testes.
- [x] **C18.** Feito (ServerVerificationScreen + aviso no cadastro + linha no ServerDetail). Antes: Idade mínima 18+ no cadastro — havia só confirmação autodeclarada no
  registro. Com a decisão de manter contas 18+ (seção G), autodeclaração não basta:
  falta a tela genérica de verificação (a ação devolvida pelo serviço de verificação,
  no molde da tela de pagamento) no fluxo de cadastro. Reaberto.
- [x] **C19.** Seletor de tipo de denúncia (client de B12) em cada alvo reportável. Testes.

## D. Site + loja + governança

- [x] **D20.** Página pública legal no site — `LegalSection` (abas ToS/privacidade) na
  landing, alimentada por `keres-tos`/`keres-privacy`, com entrada no nav e links no
  rodapé (URL da política p/ a Play Console). Testes do site.
- [ ] **D21. (externo)** Play Console: package `me.keres.client`, links do D20, URL web de
  exclusão, Data Safety, IARC. Não é código. Só depois da seção G e do F31: a Data Safety
  (que passa a declarar o envio temporário de documento e foto ao serviço de verificação
  do servidor) e a URL da política não podem apontar para textos ou fluxos incompletos.
- [x] **D22.** Scripts de RELEASE (não CI — CI só avalia código): `set-android-version` +
  `patch-android-release-signing` em `scripts/ci/`, ligados ao `release.yml`.
- [ ] **D23. (externo)** Revisão advogatícia final, DPA Stripe/PayPal/Google **e também
  hospedagem/e-mail**, reembolso de 7 dias operacional, encarregado ou canal do titular
  (Res. CD/ANPD 2/2022, agentes de pequeno porte). Não é código.
- [x] **D24.** Governança em `docs/data-governance.md`: registro de tratamento + plano de
  resposta a incidentes (comunicação à ANPD e aos titulares em **3 dias úteis**) +
  tabela de retenção com prazo por categoria (auditoria 365d, logs 6 meses, backups 90d,
  contato 90d, pagamentos 1825d por padrão, prova de aceite com fim prescricional a
  validar no D23).

## E. Fora de escopo (explícito)

- Rotação do `--backup` (servidores domésticos).
- Moderação em servidores de terceiros (cada operador é controlador próprio; checklist
  p/ self-hosters sem código).

## F. Erros legais a corrigir antes de publicar

- [x] **F25. Copyright não tem "notice-and-takedown" na Lei 9.610/98.** Reformulado o §10
  dos ToS como política contratual de moderação, sem atribuir o procedimento à 9.610/98,
  com recurso do autor. (`ReportTypes.ts` e a política nunca citavam a lei — nada a mudar.)
- [x] **F26. "Continuar usando = aceitou" contradiz o re-gate e a LGPD.** `clientTerms` §7,
  `serverTerms` §7 e as duas políticas (§10/§8) dizem ao mesmo tempo "pedido de novo antes de
  valer" e "uso continuado significa aceite". Escolher um: mudança relevante de ToS exige
  aceite novo (o B6/C15 já implementam isso); política de privacidade **não se "aceita"** —
  comunica-se, e finalidade nova incompatível exige base legal própria/consentimento
  (LGPD Arts. 7º–9º). Cláusula de alteração unilateral sem saída real também esbarra no
  CDC Art. 51, IV. (Feito: "uso continuado = aceite" removido dos dois ToS e das duas
  políticas; mudança relevante exige aceite novo — o B6/C15 já implementam isso.)
- [x] **F27. Backup de 1–2 anos anula a promessa de apagar em 30 dias.** Rotação reduzida
  a 90 dias (teto) no script, no compose e na política; volume isolado no serviço de
  backup, cópia externa em armazenamento criptografado com acesso só de operadores, e
  expurgo pós-restauração documentado (`deploy/README.md`).
- [x] **F28. O "+18 verificado" ainda não existe como verificação — e os textos se contradizem.**
  (a) A premissa é "gate no servidor, nunca offline", mas `clientTerms` §8 proíbe menor de
  **usar o app** (inclusive escrever offline) e o §3 proíbe **criar** conteúdo explícito no
  próprio aparelho: inexequível e além da premissa. Decidir: serviço 18+ integral ou offline
  livre + gate no servidor. (b) No ECA Digital (Lei 15.211/2025, vigente desde mar/2026),
  autodeclaração não basta para conteúdo adulto: é preciso verificação etária confiável.
  Hoje `is_adult_verified` é uma flag de admin sem critério, sem coleta de idade no cadastro
  e sem a categoria "prova de idade" na política (A2 §2) — o que for coletado (data de
  nascimento, documento) entra na política, tem retenção própria e vai ao RIPD (D24).
  (a) Feito nos textos: `clientTerms` §3/§8 agora dizem offline livre + gate no servidor.
  (b) ~~Decidido pelo dono: sem conteúdo adulto no servidor oficial, nenhuma verificação
  coletada~~ — **superado pela decisão atual (seção G): contas 18+ verificadas em todo
  servidor.** O oficial segue sem conteúdo adulto (caminho 1 de conteúdo), mas a conta é
  verificada no cadastro (caminho 2 de conta), justamente para não existir conta de menor
  nem supervisão parental. A verificação em si é a pendência G34–G38.
- [x] **F29. Carve-outs sem prazo = retenção indefinida.** `PAYMENT_RETENTION_DAYS` com
  default de 1825 dias (5 anos, CDC Art. 27); "anonimização" trocada por
  "pseudonimização" onde o `userId` estável sobrevive (UserService, AuditService,
  termsAcceptances). O fim prescricional da prova de aceite vai ao D23.
- [x] **F30. "Sem garantia / as is" absoluto é cláusula nula contra consumidor.**
  `clientTerms` §6 exclui responsabilidade inclusive pelo plano pago; CDC Art. 51, I, torna
  nula a exoneração por vício do serviço, e o dever de segurança da LGPD (Art. 46) é
  inderrogável. Reformular com a mesma ressalva "exceto quando a lei exigir" já usada em
  pagamentos.
- [ ] **F31. Falta a identidade do operador.** ToS §11 e política §1 trazem só "equipe Keres
  (keres.me)" e um e-mail. O Decreto 7.962/2013, Art. 2º, exige razão social, CNPJ e endereço
  (físico e eletrônico) visíveis antes da compra, e a LGPD, Art. 9º, exige identidade e
  contato do controlador e do encarregado/canal. Sem isso, A1/A2 não estão prontas para
  publicar, por melhor que esteja o código.
- [x] **F32. Reembolso de 7 dias: separar os canais.** §9 redigido por canal (loja segue
  a loja + direitos legais; cobrança direta cancela em 7 dias da contratação com
  reembolso integral e atualizado). Alinhar com a operação real antes do D21 (D23).
- [x] **F33. Completar a política e a exportação.** A2 não mencionava: transferência
  internacional (Stripe/PayPal/Google fora do Brasil — LGPD Art. 33 e Res. CD/ANPD
  19/2024) e os direitos de anonimização/bloqueio (Art. 18, IV–VI) — acrescentados
  (política §5/§7). Exportação (`GET /user/data`) auditada: só dados do próprio
  titular em escopo de participação (perfil em colunas públicas, sem hashes;
  correspondência, colaborações, aceites, pagamentos, auditoria própria) — nada
  excessivo a cortar. (Item restaurado: o arquivo perdeu o resto do texto original.)

## G. Fechamento do modelo +18 (decisão atual)

Decisão: **manter contas 18+ verificadas, com a verificação como serviço separado no
molde do payments.** Sem conta de menor, não há vínculo nem supervisão parental
(Art. 24) e o modelo de dados não muda — mas a exclusão precisa ser eficaz, não
declarada. Descartados pelo dono: provedor externo de aferição e sinal de
loja/sistema operacional, ambos spoofáveis e fora do nosso controle. O serviço de
verificação é operado pelo operador de cada servidor (no oficial, pela equipe Keres):
recebe o documento, um revisor humano confere, e ele devolve ao servidor Keres só a
asserção assinada — o servidor principal nunca vê documento. Diferente do payments,
onde "sem conector" é um default seguro (não vende), aqui **sem serviço não pode
significar "cadastra sem verificar"**: os modos ao levantar o servidor são uma escolha
explícita de configuração, com as travas de G37. Caminho crítico:
G34 → G35/G36 → G37 → G38 → D21/D23.

- [x] **G34. Interface e serviço de verificação (estilo conector de pagamentos).**
  Contrato em `packages/shared` (tipos + schemas de fio, protocolo assinado
  HMAC como o `KERES-CONNECT-V1`, chaves `AGE_VERIFICATION_*` no mesmo padrão
  `PAYMENT_CONNECTOR_*`, `https` obrigatório fora de loopback) ligando o servidor
  Keres a um serviço de verificação que importa nada da Keres. Operações mínimas:
  criar verificação para uma conta pendente (resposta com a ação para o client, no
  molde do checkout: `redirect`/`instructions`), consultar status, e eventos
  assinados de volta (`aprovado | recusado | expirado`). A implementação de
  referência é um microsserviço próprio (molde `apps/payments`): recebe o documento
  de identidade **e uma foto ao vivo do solicitante** capturada na hora (para amarrar
  o documento ao titular — documento de terceiro não aprova), fila de revisão para os
  revisores do operador, decisão com motivo e descarte. O client tem **uma** tela
  genérica para a ação, igual à de pagamento: nenhum método novo exige código no app.
  Se um dia houver outro método atrás da mesma interface (sinal de loja/sistema),
  ele entra como outro serviço, sem tocar no cadastro.
- [x] **G35. Cadastro fail-closed (API + client).** Em modo obrigatório, conta é
  criada **pendente** e só ativa com evento `aprovado` do serviço; pendente não usa
  nada (sem login útil, perfil público, sincronização ou convite), recusa e expiração
  encerram o cadastro, e pendência abandonada apaga o envio sozinha (prazo curto,
  ex.: 30 dias). Sem serviço configurado ou com o serviço fora do ar, o cadastro
  responde "indisponível neste servidor" — inverso deliberado do payments, onde
  conector fora do ar nunca derruba histórias: aqui ele derruba **cadastros novos**,
  e só eles. Status aprovado é reutilizado na sessão; o gate +18 consulta
  `is_adult_verified` no servidor a cada acesso (o `StoryNsfwService` já faz isso).
  Testes: menor recusado, documento de terceiro recusado, pendente sem acesso,
  serviço fora do ar fechando cadastro sem afetar contas existentes, revogação
  derrubando acesso +18 (a expulsão de colaboradores já existe).
- [x] **G36. Rastro mínimo, compromisso HMAC e descarte de verdade.** O servidor
  Keres guarda só a asserção: `is_adult_verified`, `verification_method`,
  `verified_at`, referência opaca da verificação e `identity_commitment` =
  **HMAC-SHA256 com chave fora do banco** sobre nome normalizado + tipo + número do
  documento (nunca salted hash comum: CPF tem espaço pequeno demais e salt no mesmo
  banco é revertível por força bruta). O compromisso prova depois que *aquele*
  documento foi o conferido e impede o mesmo documento de verificar várias contas
  naquele servidor, sem revelar o documento. Ele só nasce para **aprovado**: para
  recusado/expirado, documento e compromisso são apagados após a janela de recurso —
  não se retém dado de menor num desenho que existe para não ter dado de menor. No
  serviço de verificação, documento e foto são meio de conferência, não acervo:
  cifrados por envio com chave própria, **apagados na decisão** com a chave destruída
  (crypto-shredding, para a cópia em backup nascer ilegível), cada visualização por
  revisor registrada em auditoria, e data do descarte devolvida na asserção. Nunca
  guardar no servidor Keres: cópia ou número do documento, data de nascimento, foto.
  Dados de verificação só para essa finalidade (Art. 13), vedado perfilamento a
  partir deles (Art. 26).
- [x] **G37. Modos ao levantar o servidor — e as travas do modo desabilitado.**
  Configuração simples no boot, espelhando o conector de pagamentos:
  `AGE_VERIFICATION_MODE=required` (padrão do Docker e do oficial; exige a URL e as
  chaves do serviço, e o cadastro nem abre sem ele) ou `disabled` (self-hosting
  caseiro: rede local/entre amigos, sem oferta ao público — a Keres não opera, não
  recebe dado nenhum e o controlador é quem hospeda). Desabilitar é seguro porque o
  código impõe, sem exceção: (1) `AllowNSFW` **não liga** e ninguém é marcado
  `is_adult_verified` com verificação desligada; (2) os ToS servidos e a tela do
  servidor no client declaram "sem verificação de idade neste servidor" — ele não
  pode se apresentar como servidor verificado; (3) o boot registra em log destacado
  que o servidor subiu sem verificação. Abrir ao público em `disabled` apresentando-se
  como 18+ é infração do operador; o produto não forneceu nem o selo nem a área
  adulta. (Arts. 9º, 14 e 15: a cadeia responde de forma solidária, e a parte da
  Keres é exatamente entregar esses defaults e travas.)
- [x] **G38. Textos: incluir tudo isto nos ToS e nas políticas (servidor e app), com
  bump de versão e re-aceite (B6/C15).** Cláusulas a acrescentar, em en/pt:
  - **ToS do servidor** (`serverTerms.ts`): conta é 18+ e só ativa após conferência;
    cadastro fica pendente até a decisão; documento de outra pessoa não verifica
    ninguém; conta descoberta de menor é encerrada; área +18 só existe para
    verificado e some junto com a revogação; servidor com verificação desabilitada
    não tem área adulta nem conta verificada (o texto servido reflete o modo).
  - **Política do servidor** (`apps/api/src/legal/privacyPolicy.ts`): nova categoria
    "verificação de idade" — o documento e a foto ao vivo vão ao **serviço de
    verificação daquele servidor** (operado pelo operador dele, nunca à Keres de
    outro servidor), são conferidos por revisor humano, **apagados na decisão** e
    não entram em backup legível; o que fica é resultado, método, datas, referência
    e o compromisso HMAC anti-reuso, retido com a conta e, após a exclusão, como
    prova pseudonimizada pelo prazo prescricional do D23; recusado tem tudo apagado
    após a janela de recurso; finalidade exclusiva de aferição (Art. 13).
  - **ToS do app** (`clientTerms.ts`): o app não verifica idade nem guarda documento;
    criar conta num servidor pode exigir a conferência daquele servidor antes da
    ativação; cada servidor responde pela sua conferência e pelas suas regras;
    servidor sem verificação não oferece área adulta.
  - **Política do app** (`apps/client/src/legal/privacyPolicy.ts`): o app não coleta
    documento de identidade; quando o usuário pede conta num servidor, o documento e
    a foto saem do aparelho **direto para o serviço de verificação daquele servidor**,
    sem cópia retida no aparelho nem nos servidores da Keres; o tratamento posterior
    segue a política daquele servidor.
  Recurso contra recusa = novo envio com revisão por outro revisor (recusa não pode
  ser beco sem saída), dito nos dois ToS.
- [x] **G39. Governança da verificação (atualiza D24).** RIPD e registro de tratamento
  em `docs/data-governance.md` passam a cobrir o serviço de verificação (roteiro do
  revisor: documento íntegro e legível, captura original e não print, rosto confere
  com o documento, maioridade confere; critério de aceite/recusa; descarte e
  crypto-shredding; auditoria de acesso; **risco residual de spoofing assumido por
  escrito** — conferência manual de imagem não inspeciona holograma/chip e é uma
  medida proporcional, não equivalente a verificação presencial); checklist do
  self-hoster (seção E) ganha a escolha de modo (`required` × `disabled`), a escolha
  caminho 1 × 2 de conteúdo e o dever de operar o próprio serviço antes de ligar
  o +18.
- [ ] **G40. Retenções — já fechadas, só conferir na publicação.** Backups em 90 dias
  (F27/B13) e `PAYMENT_RETENTION_DAYS` com default de 1825 dias (F29) estão prontos;
  na virada, confirmar os valores em produção e o fim prescricional da prova de aceite
  e do compromisso HMAC com o D23. Nenhum código novo previsto aqui. (Documento de
  identidade não entra em retenção em lugar nenhum: vive só no serviço de
  verificação, até a decisão — ver G36.)
- [ ] **G41. Externos destravados pela seção G.** F31 (CNPJ/endereço/encarregado — dados
  do dono) entra nos textos; D23 valida o desenho (serviço separado, procedimento de
  conferência, descarte, risco residual assumido) — sem DPA de provedor externo de
  idade, que não existe neste desenho, pois o serviço é do próprio operador; D21
  (Play Console) por último, com a Data Safety declarando o envio temporário de
  documento ao serviço de verificação do servidor.
- [ ] **G42. Fecho de engenharia.** Rodar as suítes (legais, NSFW, cadastro,
  integração, e a do serviço de verificação contra um serviço falso no molde de
  `apps/api/test/helpers/fakePaymentConnector.ts`) e commitar a árvore — hoje está
  tudo não commitado.

## Implementação da seção G (2026-10-12) — decisões tomadas e o que ficou

Código: `docs/age_verification.md` (desenho), contrato em `packages/shared/age-verification/`,
cliente do serviço na API (`apps/api/src/services/ageVerification/`), serviço de referência
`apps/verification`, tela do app, painel admin. Rodar tudo local: `bun run verification:local`
(`--drive` percorre o fluxo inteiro por HTTP; passou nos 9 passos).

Decisões que o plano não fechava (confirmar):

- **Modo sem configuração = `disabled` no código; `required` no compose do Docker.** O plano diz
  que o modo é escolha explícita; um `bun run` cru (dev, testes, caseiro) sobe `disabled`, com as
  travas da G37 e aviso destacado no log. O compose sobe `required` e **recusa subir** sem URL e
  chaves do serviço.
- **O compromisso HMAC é calculado pelo serviço**, não pelo servidor (o servidor nunca vê nome,
  tipo ou número). `COMMITMENT_KEY` é segredo de ambiente do serviço, fora dos dois volumes e fora
  do backup de dados; perdê-lo quebra a checagem de reuso dos aprovados antigos.
- **Menor de 18 (`underage`) não tem nova tentativa**: a conta é encerrada na hora. As demais
  recusas permitem reenviar (até `AGE_VERIFICATION_MAX_ATTEMPTS`, padrão 3), olhadas por outro revisor.
- **Área +18 só onde o operador a liga** (`allowNsfw`): nos ToS ela é condicional; no oficial segue
  desligada (caminho 1 de conteúdo). Contas continuam 18+ verificadas.
- **Contas já existentes não são verificadas retroativamente** ao ligar `required`: ficam ativas,
  sem selo +18. Não há ferramenta para exigir verificação das antigas.
- **Conta pendente**: sessão com claim `pending`, barrada no pipeline (sem consulta ao banco) fora de
  uma lista curta de rotas; ao aprovar, `GET /auth/verification` devolve a sessão nova uma vez.
- Reenvio limitado a 5/hora por conta; cadastro limitado por endereço (ver relatório).

Pendências desta frente:

- **Não testado em aparelho/navegador real:** o caminho da câmera da página de envio (o painel bloqueia
  câmera); só o envio por arquivo foi exercitado. A revisão achou e corrigiu um erro que só um
  navegador pega (`Referrer-Policy: no-referrer` faz o form mandar `Origin: null`).
- **Postgres não foi rodado** (migrações geradas e exercitadas só em sqlite).
- [x] **Rotina de backup do volume de dados do serviço** feita: o próprio serviço copia o banco de dados e as imagens cifradas para `BACKUP_DIR` (volume `verification-backups`), sem chaves, com retenção de 90 dias como teto, comando manual `backup:now` e restauração no README do serviço.
- **Manual do revisor em português** antes de operar (hoje só em inglês).
- Fila do revisor sem "soltar a reivindicação" (quem assume e some segura o envio até expirar).
- F31 (dados do operador), D21, D23, G40 (conferir valores em produção), G41 e o commit da árvore (G42).

## Ordem sugerida (restante)

G34 → G35/G36 → G37 → G38 → G39 → F31 → D23 → D21, com G40 conferido na virada e G42
fechando cada etapa.