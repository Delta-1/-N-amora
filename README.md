# Amora · aplicativo do casal

Versão 3.1 para Android e web, com backend Supabase WORKSPACE e vínculo exclusivo entre duas contas.

## Usar no celular

1. Baixe **Amora-Android.apk** em **Releases → Amora Android**. A primeira compilação é criada pelo workflow **Amora Android APK**, na aba Actions. Android 8 ou superior.
2. Instale e abra. Cada pessoa usa o próprio e-mail e senha. Confirme o e-mail se o projeto pedir.
3. Uma pessoa escolhe **Criar vínculo**. A outra entra na própria conta, escolhe **Tenho um convite** e informa o código de 16 caracteres. O código dura 24 horas e só pode ser usado uma vez. Gere outro nas configurações se necessário.
4. A navegação inferior tem quatro favoritos configuráveis e **Apps** no centro. A gaveta animada reúne câmera, álbum, arquivos, jogos, agenda, história, combinados, ideias, mapa, quadros, notas e Lilith. Em **Configurações → Meu app**, escolha os favoritos, os atalhos da bolinha e o tema claro, escuro ou automático. Em Apps → Organizar, altere a ordem e oculte atalhos.
5. Os dados reais começam vazios. A demonstração é opcional e identificada. Os números da planilha fornecida não foram importados para contas reais.

## Lilith

Depois de os dois entrarem no vínculo, um parceiro abre **Configurações → Lilith · Gemini**, informa a chave do Google AI Studio e o modelo disponível nessa chave. O app verifica o modelo antes de guardar a chave. O padrão é `gemini-3.5-flash`; ele pode ser alterado. Nenhuma chave de IA está no código, no APK ou nas configurações públicas.

A chave do casal fica criptografada com AES-GCM no servidor. Somente a Edge Function acessa o texto descriptografado. Trocar a `SUPABASE_SERVICE_ROLE_KEY` exige recadastrar as chaves dos casais. O outro parceiro pode usar a Lilith, substituir ou remover a chave, sem visualizar a anterior.

A Lilith conversa, interpreta imagens, prepara tarefas, eventos, despesas, memórias, notas e planos financeiros, abre áreas do aplicativo, sugere mensagens ao parceiro e altera nome, humor, status e tema. Alterações aparecem em cartões com detalhes e botão **Aplicar no Amora**. Exclusões e envio ao parceiro têm confirmação adicional. A IA não compra, transfere dinheiro, controla outros aplicativos ou altera permissões do celular.

**Planejar compra:** cadastrem renda, orçamento, dívidas e projetos. Peçam à Lilith um plano com objetivo, valor e prazo. O botão **Usar dados do casal** permite incluir registros financeiros e notas no pedido ao Google. Desligue para conversar sem esses dados. Imagens são enviadas somente ao apertar Enviar. O histórico da conversa da Lilith fica apenas na memória daquela janela, sem armazenamento remoto. Voz desligada por padrão; configure sua chave ElevenLabs, ID da voz e modelo em Configurações → Lilith. A voz é sintetizada no servidor e reproduzida no Android/navegador. O ditado usa o sistema do celular. Não é uma sessão Gemini Live.

**Bolinha Android:** Configurações → Ativar bolinha da Lilith. Conceda a permissão de aparecer sobre outros apps. Uma notificação permite parar o serviço. A amorinha pode ser arrastada, abre um painel inferior e pulsa durante a fala. O atalho para o parceiro abre o aplicativo diretamente na conversa. O sistema operacional pode encerrar o serviço; abra o app e ative novamente. Ao abrir o seletor de arquivo, salvar uma exportação ou usar o ditado, o painel é recolhido para liberar a tela do Android. Quando a ação parte da bolinha, o painel volta ao terminar ou cancelar o seletor/ditado. Ações iniciadas dentro do app mantêm o app aberto.

**Tela e seleção:** + → Capturar tela solicita o consentimento do Android em cada captura. É uma captura pontual, não transmissão contínua. Confira a imagem, circule uma região para formar o recorte e envie a pergunta. O Gemini interpreta texto e imagem da seleção; não há um serviço separado de OCR ou busca Google automática. Para nova tela, faça outra captura. No navegador que não permite captura, envie uma imagem pelo botão +. Telas protegidas podem ficar em branco.

## Despesas com cara de planilha

- **Lançamentos:** tabela editável com data, descrição, categoria, valor, pagador e divisão. Descrição e valor podem ser editados nas células; o lápis abre todos os campos. Exportação CSV; no Android, escolha a pasta no seletor do sistema. Os quadros também usam esse seletor para exportar SVG.
- **Rendas:** previsto e recebido por pessoa e mês.
- **Orçamento:** limites previstos e realizado dos lançamentos da mesma categoria. Use uma linha por categoria para ler esse comparativo sem repetir o realizado.
- **Dívidas:** saldo, parcela mensal, parcelas restantes, taxa informada e status.
- **Projetos:** custo, valor guardado, aporte mensal, contribuições e data desejada. Mostra o prazo estimado e sugestão de divisão proporcional à renda informada (metade para cada um se ambas forem zero).

Saldo realizado = renda recebida − lançamentos. Previsão livre = renda prevista − orçamento − parcelas − aportes. Não cadastre a mesma parcela/aporte novamente no orçamento. Projetos e dívidas são registros do mês selecionado; o app não lança pagamentos automaticamente nem calcula juros futuros. As projeções não incluem rendimentos. Valores monetários são armazenados em centavos.

## Compartilhado

- Chat de texto: mensagens persistidas no vínculo, com data e horário; ✓ significa salva no servidor, não confirmação de leitura. Sincroniza com a conversa aberta. Ainda não há push de novas mensagens com o app fechado.
- Jogo da velha, xadrez e dama: cada pessoa joga no próprio aparelho. O servidor valida a vez, a jogada e a versão da partida. Xadrez inclui roque, en passant, promoção selecionável e empates com histórico PGN. Dama usa regras americanas, com captura obrigatória, peças comuns para frente e damas de passo curto.
- Quadros: pontos vetoriais em SVG, cor e espessura, borracha por traço, desfazer próprio traço, exportar SVG e múltiplos quadros. O traço aparece para o parceiro ao soltar o dedo. Consulta paginada por quadro, com até 10.000 traços por quadro. Não há lousa por streaming de cada ponto.
- Notas: edição compartilhada, com controle de versão para rejeitar sobrescrita de uma edição mais recente.
- Datas, agenda, listas, humor, ideias e mapa anteriores preservados. GPS só enquanto o app estiver aberto e com consentimento individual; sem rastreamento contínuo de localização.
- Lembretes Android: até 60 datas/eventos/tarefas sincronizados ficam agendados no aparelho. Abra o app para receber alterações do parceiro. Android pode atrasar alarmes inexatos por economia de bateria. Permissão de notificações é necessária. Na web, avisos dependem do app aberto.

## Backend e desenvolvimento

Projeto WORKSPACE: `qaiqflcxfxygynumapyp`. Instalação base: `supabase/namora-install.sql`. Extensões aditivas: `supabase/amora-app-upgrade.sql` e `supabase/amora-mobile-upgrade.sql`. A Edge Function está em `supabase/functions/amora/`. As tabelas são `namora_*`; nenhum dado dos outros aplicativos é alterado.

RLS verifica o vínculo em cada leitura/escrita. Chat não aceita remetente forjado. Quadros e traços precisam pertencer ao mesmo casal. Estados dos jogos e credenciais só podem ser escritos pela função autenticada. A função valida o usuário com Auth e limita requisições de Gemini por casal (12/minuto). A tabela de credenciais não tem políticas para clientes de propósito; o aviso informativo do advisor para essa tabela representa negação de acesso.

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build:pages
pnpm test:pages
pnpm test:supabase
pnpm test:app
```

`web/` é a aplicação ativa; `docs/` é compilada para GitHub Pages. O Android empacota os mesmos arquivos localmente no APK, com ponte nativa Java para sobreposição, captura, voz e lembretes. O código anterior em `app/` e `worker/` permanece como referência.

## Compilação Android

`.github/workflows/android.yml` compila o frontend, roda os testes, cria o APK e publica o download em Releases. Um job separado tenta verificar a abertura e a bolinha sobre a tela inicial em emulador Android 15. Confira o resultado desse job: falhas da infraestrutura do emulador não representam validação do aplicativo. O APK é **de teste**, assinado com chave debug. Não é uma publicação Play Store. Builds em máquinas/execuções diferentes podem usar chaves debug diferentes; para atualizações preservando instalação, configure uma chave de assinatura persistente antes de distribuir novas versões. Não publique chaves ou senhas no repositório.

A validação em emulador cobre a abertura e a tela de conta. Sobreposição, síntese de voz, captura em outros aplicativos, autenticação real do casal e chamadas Gemini exigem teste no celular e uma chave válida. O sucesso do build não substitui esses testes.

## Fotos e arquivos

A câmera pede permissão individual, permite alternar frontal/traseira e salva fotos com moldura, frase e ícone opcional no álbum do vínculo. Também é possível importar imagens. Arquivos permitem criar pastas, buscar, renomear, mover, baixar e excluir. Limite de 20 MB por arquivo; metadados e conteúdo ficam no Supabase, no bucket privado `amora-private`, com acesso restrito ao casal. A consulta aberta atualiza a cada sete segundos; sem cache offline de arquivos.

**Google Drive opcional:** em Configurações → Drive, configure um cliente OAuth Web próprio com Drive API ativada, escopo `drive.file`, e URI `https://delta-1.github.io/-N-amora/docs/drive-callback.html`. Depois conecte a conta Google. Novos envios tentam salvar uma cópia na pasta do casal; o botão Drive permite tentar novamente ou copiar arquivos antigos. A conexão retorna ao Android por link `amora://drive-callback`. Não existe sincronização bidirecional: alterações externas no Drive não substituem os arquivos no Amora. Ao excluir no Amora, cópias no Drive permanecem. Credenciais OAuth, tokens e chave ElevenLabs ficam criptografados no servidor.

A configuração de voz requer dois membros no vínculo, chave ElevenLabs com acesso à voz e à síntese, e créditos disponíveis. Voz, câmera física e OAuth com credenciais reais precisam de validação no aparelho.

## GPS, lugares, passos e SOS · 3.2

Instale o APK atualizado. O Mapa abre mesmo sem posições e recalcula o tamanho ao trocar de aba. Cada parceiro escolhe **Mapa → Ativar meu acompanhamento**, confirma localização e notificações e, opcionalmente, atividade física. O serviço Android exibe notificação com **Parar** e continua sem a tela do app. Nenhum parceiro ativa o outro. Pausar remove a posição atual; o sensor para no aparelho. Forçar parada, reiniciar ou restrições de bateria podem interromper; reabra e ative. Na web o GPS exige a página aberta.

Em **Nossos lugares**, marque um ponto no mapa ou use sua posição, dê nome e escolha um raio de 100 m a 1 km. Chegadas usam posição atual e precisão conservadora, com margem de saída e intervalo de cinco minutos para evitar repetições. A primeira posição dentro do raio pode gerar uma chegada. O parceiro recebe avisos por consulta periódica (30 segundos enquanto seu acompanhamento estiver ativo), sem Firebase/push remoto. Offline, sem GPS ou com serviço encerrado, não há garantia de aviso imediato; os eventos sincronizados aparecem no histórico. O registro mostra a hora em que o servidor recebeu a chegada, não uma hora retroativa estimada.

O comparativo mensal usa o sensor STEP_COUNTER, apenas após ativação e enquanto o serviço funcionar. Não estima passos de GPS nem recupera períodos sem sensor. Registros offline de até 35 dias são reenviados. Cada dia preserva o maior total enviado, sem somar dois aparelhos. Use um celular por pessoa. Sem sensor ou permissão, o app mostra ausência de registros. Dados de passos e locais ficam restritos ao vínculo.

**Configurações → Meu app → Mostrar botão SOS** habilita o botão superior. O pedido é confirmado antes de salvar no vínculo e é limitado a um por minuto. Não aciona emergências nem telefona automaticamente. Um número opcional pode ser aberto no discador; o usuário confirma a chamada.

A câmera tem controles fixos, moldura BM, marca opcional de data/data e hora/nome, letras e frase; som de captura configurável. Android 10+ grava em Pictures/NAMORA pelo MediaStore e inclui descrição e data; Android 8/9 usa o seletor de arquivo. Também tenta enviar ao álbum privado. Sem internet, confira a cópia local; ela não é automaticamente reenviada ao álbum. Sobreposição é opt-in, com serviço independente da tela; uma notificação permite parar.

Backend adicional: `supabase/amora-safety-upgrade.sql`; RPC autenticada `namora_track`, com consentimento individual, RLS e lógica privada. Tokens nativos usam Android Keystore; a sessão é sincronizada com o WebView ao voltar ao app. Não existem credenciais de serviço no APK.

## Amora, convites e conversas · 3.3

O símbolo original de amora voltou à tela inicial, aos ícones web e Android e à câmera. Tocar na fruta faz ela cair. A apresentação e o tutorial do gato foram removidos.

A conta vem antes do vínculo: escolha **Criar nosso cantinho** ou **Tenho um convite**. Escolha papel de parede local (amoras, carinho, estrelas ou liso). Convites novos têm 10 caracteres aleatórios, validade de 24 horas, uso único e limite de tentativas; convites antigos de 16 caracteres continuam válidos. QR e link usam a mesma credencial do convite: compartilhe apenas com quem vai entrar. O QR pode ser lido pela câmera do outro celular; login é obrigatório e o vínculo só é criado após confirmar. A página oferece abrir o convite no APK via `amora://invite?code=...`. O banco ainda limita o vínculo a duas pessoas; múltiplos parceiros não fazem parte desta versão.

Conversa abre contatos e depois uma tela dedicada, com volta para início e composição fixa. A Lilith também usa uma tela de conversa; no painel sobre outros aplicativos, usa apresentação compacta e translúcida. A gaveta acompanha o arraste do risquinho, recolhe ao atingir distância/velocidade e volta ao lugar em arrastes curtos. A bolinha pode ser removida soltando no X inferior; isso desabilita o serviço até nova ativação.

O login oferece mostrar/ocultar senha e **Manter conectado**. Desmarcar usa armazenamento da sessão e interrompe os serviços persistentes locais. Android oferece bloqueio opcional por biometria ou credencial do dispositivo, implementado pelo sistema, sem acesso à digital. Precisa de bloqueio de tela cadastrado; Android 8 usa a credencial do dispositivo. É proteção local da sessão já autenticada, não um novo login no servidor. Sair da conta remove a sessão nativa e desabilita o bloqueio.

Aplicar `supabase/amora-invite-upgrade.sql` antes da publicação. As chaves Gemini/ElevenLabs continuam configuráveis e criptografadas no servidor; nenhuma chave global de produção foi fornecida para esta atualização, e cobrança por usuário continua fora do escopo.

### Versão 3.4: vínculo depois do login e mapa em tela cheia

Após entrar na conta, é possível adiar a vinculação e usar **Apps → Entrar com código** ou **Configurações → Meu app → Entrar com código**. O mesmo atalho aparece no mapa. O campo aceita convites novos de 10 caracteres e antigos de 16. Uma conta que já está em outro cantinho precisa confirmar a desvinculação antes de confirmar o novo convite; os registros não são transferidos.

O mapa ocupa toda a tela e identifica os balões pelo nome, inicial e cor fixa de cada integrante. O painel inferior pode ser expandido, recolhido e arrastado, com atalhos para pessoas, lugares/chegadas, passos e GPS. Toque num perfil para ver a última atualização, precisão e centralizar; os botões flutuantes mostram todos, centralizam você e abrem Apps. Posições sem atualização por 15 minutos saem do mapa. Na demonstração, as posições são fictícias e os controles de compartilhamento ficam desabilitados.
