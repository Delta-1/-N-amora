# Cinema e Biblioteca · Amora 4.1

## Cinema

Em Apps → Cinema, crie uma sala ou entre em um convite. O próprio vínculo pode entrar; outros casais precisam de amizade aceita e convite. Entrar é uma ação explícita de cada pessoa. Limite: 8 pessoas e até 3 casais amigos convidados.

Quem criou a sala compartilha a tela ou escolhe um link HTTPS direto MP4/WebM. Os controles do anfitrião sincronizam o vídeo; cada pessoa habilita o áudio no próprio aparelho. Há participantes identificados e conversa da sessão. Encerrar a sala ou revogar acesso fecha a transmissão.

No computador, a captura usa a seleção de tela/janela/aba do navegador. Áudio depende da fonte e da opção do navegador. Serviços com DRM podem bloquear a imagem ou o som.

No Android, o APK 4.1 oferece MediaProjection, autorização a cada sessão, serviço visível e botão Parar. O espelhamento Android desta versão transmite imagem, sem áudio interno. Links diretos de vídeo têm áudio normal. O Amora não grava os vídeos da sessão.

WebRTC usa o gateway existente para ICE. Sem TURN configurado, redes com NAT restritivo podem impedir a conexão. Configure TURN_URL, TURN_USERNAME e TURN_PASSWORD no AMORA-Connect para disponibilizar uma retransmissão autenticada. Não altere os serviços Workspaces/Starsis.

## Biblioteca

Apps → Biblioteca reúne Livros, Álbuns, Arquivos e Google Drive. Ambos os integrantes podem enviar arquivos, ler PDFs e baixar. PDF.js é empacotado localmente; nenhum documento é enviado a um visualizador público. Outros formatos podem ser baixados. Limite atual: 20 MB por arquivo.

As fotos da câmera do Amora e os uploads entram no mesmo acervo. Álbuns agrupam por ano da data do momento. Para uploads, a data inicial vem da última alteração do arquivo; ela pode ser corrigida no álbum. Não há leitura automática de EXIF.

Cada integrante conecta o próprio Drive e o casal escolhe o destino. Os arquivos ficam em pastas Livros, Documentos e Álbum ANO. Uma planilha privada registra ID, nome, tipo, pasta, datas, integrante, descrição, link, tamanho e formato. Escritas usam RAW, sem executar nomes como fórmulas. Retentativas encontram o mesmo ID no Drive e atualizam a linha existente.

O Amora mantém uma cópia no bucket privado para leitura pelos dois integrantes, sem tornar a pasta do Google pública. O indicador diferencia arquivo pendente, cópia no Drive e catálogo registrado. Sincronizar pendentes tenta até 10 arquivos carregados por vez; Carregar mais busca os próximos. Uma falha do Sheets não apaga a cópia confirmada no Drive. Exclusão no Amora mantém cópias e registros anteriores no Google. Edições feitas diretamente no Drive/Sheets não são importadas automaticamente.

## Configuração Google, uma vez pelo administrador

O administrador geral cadastra um cliente OAuth Web em Biblioteca → Google Drive → Configurar aplicativo Google. Habilite Google Drive API e Google Sheets API. Retorno autorizado:

https://delta-1.github.io/-N-amora/docs/drive-callback.html

Escopo: https://www.googleapis.com/auth/drive.file

Cadastre usuários de teste enquanto o aplicativo Google estiver em modo de teste; para uso público, conclua a configuração/publicação do consentimento no Google Cloud. Depois disso, usuários comuns apenas conectam a própria conta e escolhem o destino. Nunca coloque segredo do cliente no frontend.

Configuração global e tokens ficam criptografados no servidor. Conta antiga de um ex-integrante não recebe novos uploads. Cada integrante só pode desconectar sua própria conta. A biblioteca e as salas não dão acesso a dados privados de outros casais.

## Verificação

- TypeScript, build estático e regressões existentes.
- PostgreSQL/PGlite: convites, sessão por aba, controle de reprodução, bloqueios, revogação, isolamento de arquivos e credenciais.
- Provedores simulados: escolha do Drive, segredo ausente do status, RAW, retentativa de catálogo e falha de Sheets.
- Chrome real: duas abas decodificam vídeo WebRTC; encerramento para os tracks; PDF de duas páginas renderiza a cor esperada; Cinema/Biblioteca sem excesso horizontal em celular, tablet e PC.
- Emulador Android: cancelamento e autorização MediaProjection, frames reais, parada do serviço e leitor PDF interno, além das regressões de câmera, mapa, sobreposição e OTA.

A autorização de uma conta Google real depende das credenciais OAuth do administrador. Testes no Chrome/emulador não substituem o teste entre dois aparelhos em redes móveis diferentes.
