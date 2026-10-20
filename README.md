# (N)amora 💜

Nossa história, nossos planos e a vida a dois. **Versão 2: GitHub Pages + Supabase.**

## Novidades

- Transições direcionais entre abas, animação dos atalhos, botões e confirmações, mascote Lilith e corações nas memórias salvas. Respeita `prefers-reduced-motion`.
- **História do casal**: data em que se conheceram, primeiro encontro, pedido de namoro, noivado, casamento e outras memórias. Texto, edição, aniversário anual, contagem regressiva e lembretes de hoje/amanhã com o app aberto.
- **Potinho de ideias**: sugestões gratuitas por categoria, troca das sugestões, ideias salvas e agendamento de um encontro. IA personalizada paga marcada como etapa futura; não há cobrança nem ativação simulada.
- Sons suaves opcionais nas abas, confirmações e lembretes, desligados por padrão.
- Mapa Leaflet/OpenStreetMap com **os dois marcadores**, precisão, distância e status voluntários (estudando, trabalhando, a caminho…). O mapa de demonstração usa posições explicitamente fictícias.
- Login e cadastro com e-mail/senha, recuperação de senha, convite de 16 caracteres para formar o casal, Supabase Realtime e fallback de atualização a cada 30 segundos.
- Agenda, checklist, despesas individuais/compartilhadas, humor, temas, exportação JSON/ICS e aplicativo web instalável.

## Publicar no GitHub Pages

Os arquivos **já compilados estão em `docs/`**, com caminhos relativos. A aplicação não faz chamadas para o servidor da versão anterior.

1. No repositório, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **Deploy from a branch**.
3. Selecione **main** e a pasta **/docs**, depois **Save**.
4. Aguarde a publicação do Pages. O endereço publicado aparecerá nessa mesma tela.

Não é necessário Node.js no servidor, Vercel ou Cloudflare Worker para a versão de Pages. O Supabase funciona como backend remoto. `docs/.nojekyll` evita processamento pelo Jekyll.

Para atualizar os arquivos publicados depois de editar o código:

```sh
pnpm install --frozen-lockfile
pnpm build:pages
# commit e push de web/, public/, docs/ e dos demais arquivos alterados
```

`pnpm dev` inicia o Vite; o código da versão nova fica em **`web/`**. `app/`, `db/` e `worker/` mantêm a implementação anterior para referência/continuidade da antiga publicação. O build padrão e a pasta `docs/` usam somente `web/`.

## Escolher e configurar o Supabase

**Nenhum projeto existente foi alterado nesta etapa.** Foram encontrados sete projetos, todos ativos e com registros: SHKTWEB, WORKSPACE, GRASSI PDV ERP, PontoNorte, Floralis PDV ERP, CPUSIS Cursos e ONG01.

Depois de escolher um projeto:

1. Execute **`supabase/namora-install.sql`** no SQL Editor desse projeto. O script cria apenas tabelas `namora_*` e o schema privado `namora_private`, sem modificar tabelas de outros aplicativos. É preferível usar um projeto separado; reaproveitar um projeto também compartilha autenticação e limites de recursos.
2. Em **Authentication → URL Configuration**, inclua a URL exata publicada pelo Pages em Site URL/Redirect URLs para os e-mails de confirmação e recuperação. Não altere o Site URL de um projeto compartilhado sem avaliar os outros apps; nesse caso, preserve o existente e adicione apenas a URL do (N)amora à lista de redirects.
3. Em **Authentication → Providers**, confira se e-mail/senha está habilitado. Respeite a configuração de confirmação por e-mail do projeto.
4. Edite **`public/namora-config.json`** com `supabaseUrl` e **somente a chave publishable ou a antiga anon**. Compile novamente e envie `docs/` ao GitHub.

A configuração é pública por design; as regras RLS e o JWT de cada usuário protegem os dados. Nunca publique `service_role`, `sb_secret_`, senha de banco ou chave de IA. Há uma tela de configuração local para testes; ela só salva URL e chave pública neste aparelho e não substitui a configuração publicada para o parceiro.

Sem um banco configurado, o app abre em **demonstração identificada**, sem persistir dados reais ou criar contas. Contas reais não recebem os exemplos. Se já houver dados na publicação antiga, exporte-os antes de uma migração; esta etapa não copia nem apaga esses registros automaticamente.

## Acesso do casal e dados

Cada pessoa usa sua própria conta. Uma cria o vínculo e compartilha o código de 16 caracteres (24 horas de validade); a outra escolhe entrar no vínculo. O convite é armazenado como hash, consumido após o uso, e o vínculo aceita duas pessoas. Não há envio de convite por e-mail pelo app.

Toda leitura é protegida por RLS. Escritas passam pelo RPC `namora_action`, que valida identidade, associação ao casal, valores e versão do registro. O código privilegiado fica no schema privado, com `search_path` fixo e execução somente por usuários autenticados. Nenhum usuário recebe permissão de escrita direta nas tabelas. Pedidos de vínculo inválidos contam para o limite de tentativas.

## Localização, lembretes e IA

- Cada pessoa compartilha **somente a própria posição**, com permissão do navegador. Pausar remove a posição. Posições sem atualização há mais de 15 minutos não são exibidas.
- A atividade exibida é escolhida pela pessoa; não há inferência automática de trabalho, estudo ou deslocamento.
- GPS e lembretes funcionam **com o app aberto**. GitHub Pages/PWA não oferece rastreamento contínuo equivalente ao Life360 com o aplicativo fechado. Isso exige uma etapa nativa ou infraestrutura adicional.
- Sons são opt-in. O navegador pode suspender áudio e GPS com o app em segundo plano.
- A Lilith oferece ajuda local. Geração personalizada por IA e acesso pago ficam para depois. Essa futura integração deverá usar **Supabase Edge Function**, chave secreta no servidor e validação de assinatura/limites no backend; esconder um botão no frontend não é controle de pagamento.

## Verificação

```sh
pnpm exec tsc --noEmit
pnpm build:pages
pnpm test:pages
pnpm test:supabase
```

Os testes verificam datas anuais (inclusive 29/02), distância, caminhos relativos e ausência de dependência do servidor anterior. O teste PostgreSQL/RLS usa **PGlite local**, aplica o script em banco temporário e verifica convites, isolamento entre casais, operações, despesas, memórias, ideias, localização e revogação de acesso. Não altera os projetos Supabase conectados.

A integração real de Auth/Realtime/e-mails deve ser verificada novamente depois da escolha e configuração do projeto. A pasta `docs/` é o resultado do build; não edite seus arquivos gerados manualmente.
