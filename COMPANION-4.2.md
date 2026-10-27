# (N)AMORA 4.2 — atalhos, música, status e SOS

## Uso

- **Menu:** um toque em Apps abre o arco e o perfil; outro toque recolhe os dois. Segurar por 550 ms abre todos os aplicativos. Teclado: foque Apps e pressione seta para cima; Escape recolhe os atalhos. Gire o arco com dedo ou rolagem.
- **Minimizar:** no APK 4.2, o botão de seta no cabeçalho ativa a bolinha e minimiza. Na primeira vez, autorize Aparecer sobre outros aplicativos. Arrastar a bolinha para o X desativa a sobreposição.
- **Câmera:** ocupa a área inteira do aplicativo. Voltar, personalizar, álbum, obturador e alternar câmera ficam sobre a imagem. A moldura exportada continua sendo a escolhida nas configurações.
- **Mensagens:** no desktop, conversas do casal e caixa de entrada da comunidade usam lista lateral e conversa ao lado. No celular, a conversa continua em tela própria.
- **Status:** menu Apps → Status. Perfil individual, ícone, biografia, humor de 1 a 5 e recado visíveis somente no vínculo. O perfil da comunidade é separado.
- **Dados do aparelho:** cada titular habilita no próprio aparelho. Bateria, carregando, conexão Wi-Fi/dados móveis, tela ligada e bloqueio precisam do APK 4.2. Aplicativo recente e resumo de tempo de uso de hoje exigem uma opção separada e o acesso especial de uso concedido no Android. Dados aproximados, atualizados a cada 15 segundos com execução ativa; deixam de aparecer como atuais após dois minutos. Não coleta conteúdo dos apps, senha ou nome do Wi-Fi. No navegador, há apenas presença do Amora.
- **SOS:** Configurações → SOS. Configure botão, telefone e alertas. Configurações → Notificações também permite mensagens, chegadas e SOS. O teste de SOS cria uma notificação apenas no próprio celular, sem enviar ao parceiro. A vibração usa um canal Android específico e respeita permissões, Não perturbe e ajustes do sistema. Não há promessa de entrega imediata.

## Música

A playlist e a reprodução são compartilhadas pelo vínculo. Os dois podem adicionar ou remover até 100 itens, escolher a faixa, pausar e avançar. Cada aparelho precisa tocar em **Ouvir neste aparelho**. Há sincronização aproximada com relógio do servidor; anúncios, buffers, rede e bloqueios de autoplay podem causar diferenças.

**YouTube:** aceita links de compartilhamento, Music, Shorts, Live, embed, site móvel e site normal. Usa player oficial visível; não remove anúncios, não extrai o áudio e não mantém reprodução oculta. No APK, o player abre numa WebView isolada, sem ponte nativa, identificada por `https://com.amora.app`. O player pausa quando a tela própria sai de primeiro plano. Vídeos podem ser bloqueados pelo autor, região, idade ou pelo serviço; existe botão para abrir na fonte.

**Busca por nome:** administrador → Ouvindo juntos → Configurar pesquisa do YouTube. Ative YouTube Data API v3 num projeto Google Cloud e cadastre uma chave restrita a essa API. A chave é criptografada no backend, nunca devolvida ao cliente. Sem configuração, é possível adicionar links; a busca por nome apresenta uma explicação. Resultado oficial limitado a seis vídeos incorporáveis; cache por cinco minutos e controle de uso. Nenhuma chave foi inventada ou cadastrada nesta entrega.

**Áudio próprio:** links HTTPS diretos MP3/M4A/OGG/WAV/AAC têm controles de música, sem vídeo. No navegador, o áudio permanece ao trocar de aba dentro do Amora; o sistema controla reprodução de navegador em segundo plano. No APK 4.2, há um serviço de mídia, foco de áudio e notificação com Pausar/Parar para tocar com tela apagada; consulta a reprodução compartilhada a cada dez segundos. Requer acesso ao arquivo pela internet. Sair da escuta ou da conta interrompe o serviço.

## Conectar Spotify

1. Entre em https://developer.spotify.com/dashboard com sua conta e crie um aplicativo.
2. Cadastre exatamente a Redirect URI: `https://amora-connect-production.up.railway.app/spotify/callback`.
3. Copie o Client ID e, no login administrador do Amora, abra Administração e salve em Conexões. Não há necessidade de entregar Client Secret ao frontend; a conexão existente usa PKCE.
4. Em modo de desenvolvimento, o proprietário do app precisa de Spotify Premium e os e-mails Spotify dos parceiros precisam estar em Users Management (até cinco usuários conforme limite atual do Spotify).
5. Cada parceiro abre Ouvindo juntos → Conectar meu Spotify e autoriza sua própria conta. Ative Compartilhar o que estou ouvindo.
6. Abra o Spotify e toque uma faixa. Enquanto a aba de música está aberta, o Amora consulta a faixa atual aproximadamente a cada 15 segundos. Status sem atualização por dois minutos sai da tela.

Esta integração mostra a faixa atual; não duplica o áudio do Spotify, não controla a conta do parceiro e não é um Spotify Jam. A playlist própria do Amora e o Spotify são funções distintas.

## Operação e privacidade

SQL aditivo: `supabase/amora-companion-upgrade.sql`. Novas tabelas têm RLS e nenhum acesso direto de anon/authenticated. RPC público é security invoker; helper privado verifica auth.uid e vínculo. Consentimento e escrita são sempre do próprio uid; não existe override de administrador. A API de música é acrescentada somente à função amora, preservando os outros produtos do projeto WORKSPACE.

Acompanhamento usa serviço Android explicitamente ativado, notificação persistente e Parar. Não reinicia silenciosamente após reinício/forçar parada. Polling exige internet, pode atrasar e não é push FCM. Alertas do navegador exigem página aberta; não há Web Push com navegador fechado nesta versão. Notificações sociais seguem o vínculo; os dados de Status nunca entram na comunidade.

Instale o APK 4.2 uma vez para os novos serviços, player isolado e permissões. APKs 4.0/4.1 continuam recebendo o bundle web compatível pelo botão Atualizar, com mensagens explicando recursos nativos indisponíveis.
