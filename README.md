# (N)amora 💜

Um cantinho para organizar a vida a dois: planos, tarefas, despesas e pequenos cuidados.

## O que está implementado

- Interface responsiva, navegação inferior, animações e respeito a movimento reduzido.
- Login individual com **Entrar com ChatGPT**, fornecido pelo ambiente Sites.
- Criar vínculo ou entrar com um código de 12 caracteres, válido por 24 horas. Cada vínculo comporta duas pessoas. Códigos são armazenados como hash e invalidados após o uso.
- Agenda com calendário mensal, edição de eventos e exportação `.ics`.
- Checklist com responsável, categoria, prazo, conclusão e edição.
- Despesas individuais ou compartilhadas, edição, filtro por mês, totais por categoria e saldo da divisão igual.
- Humor compartilhado, nome do cantinho e aniversário do relacionamento.
- Quatro temas: Amora, Jardim, Pêssego e Luar.
- Localização opcional com permissão individual, mapa OpenStreetMap e pausa que remove a posição.
- Banco de dados D1, isolamento por vínculo e sincronização por consulta a cada **6 segundos**, com o app visível. Edições usam versão para detectar conflitos.
- Lilith, mascote animada com chat, sugestões locais e integração opcional com a API OpenAI.
- Aplicativo web instalável (PWA), exportação dos registros em JSON e lembretes enquanto o app está aberto.

## Uso inicial

1. Abra o aplicativo e entre na sua própria conta.
2. Em **Começar**, escolha **Criar um vínculo**.
3. Em Configurações → Adicionar meu amor, gere e copie o convite.
4. A outra pessoa acessa com a própria conta, escolhe **Entrar em um vínculo** e informa o código.

A publicação inicial no Sites é **privada para o proprietário**. Para testar com o parceiro, libere o acesso dele no compartilhamento do site. O código de vínculo não substitui a permissão de acesso da hospedagem. Nenhum convite por e-mail é enviado pelo aplicativo.

O modo de demonstração é identificado, usa dados fictícios e mantém alterações apenas na memória da página. Contas reais começam sem exemplos ou despesas cadastradas.

## Executar e verificar

Requer Node.js 22.13+ e pnpm 11.

```sh
pnpm install --frozen-lockfile
pnpm db:generate # somente após mudanças no schema
pnpm build
pnpm exec tsc --noEmit
node tests/api.integration.mjs
```

O teste de integração executa o Worker compilado em Miniflare com banco temporário, sem publicar ou modificar registros reais. Ele verifica autenticação, vínculo, isolamento, edição compartilhada, conflitos, despesas, localização e desligamento do vínculo.

Para desenvolver neste ambiente, use o fluxo de preview do Sites. O starter mantém as instruções de execução e autenticação em `scripts/` e `app/chatgpt-auth.ts`. A identidade em produção depende dos cabeçalhos autenticados fornecidos pelo Sites; **não exponha este Worker diretamente com cabeçalhos de identidade controlados pelo visitante**.

## IA da Lilith

Sem chave, a Lilith funciona em **ajuda local**, com respostas por assunto e resumos dos registros. Isso é exibido no chat; não é apresentado como IA generativa.

Para habilitar IA generativa, configure **OPENAI_API_KEY** como segredo de servidor no ambiente de hospedagem. Nunca coloque a chave no código, em variáveis públicas ou neste repositório. O backend usa a API Responses, modelo `gpt-4.1-mini`, `store: false`, limite de saída e limite por usuário. As mensagens digitadas são enviadas à OpenAI; o resumo dos registros só é incluído quando a pessoa marca a autorização no chat. Localizações não são enviadas à IA. A conversa fica na memória da página e não é salva no banco.

## Limites desta versão

- **Localização em primeiro plano:** atualiza enquanto o app estiver aberto e o navegador permitir. Posições com mais de 15 minutos não aparecem no mapa. Não equivale a rastreamento contínuo de um app nativo como Life360.
- **Lembretes em primeiro plano:** verificações a cada 30 segundos, até 15 minutos antes do horário, com permissão do navegador. Não há push agendado com o aplicativo fechado.
- **PWA, não APK nativo:** pode ser adicionado à tela inicial; GPS em segundo plano e push agendado exigem outra etapa de desenvolvimento e infraestrutura.
- **Sincronização em poucos segundos:** usa polling; não há WebSocket.
- **GitHub Pages não executa o backend:** este projeto precisa de Worker, D1 e autenticação Sites. O repositório guarda o código; a hospedagem inicial usa Sites.

## Dados e segurança

Toda leitura e escrita real exige identidade, e toda operação compartilhada verifica a associação ao vínculo no servidor. Despesas usam centavos inteiros. A localização de uma pessoa só pode ser alterada por ela. As páginas autenticadas e as APIs não são armazenadas pelo service worker. Ao sair de um vínculo, a pessoa perde acesso aos registros, que permanecem no vínculo; para apagar registros específicos, use a edição correspondente antes de sair.

Estrutura principal: `app/components/` (interface), `app/api/` (API), `lib/` (validação e regras), `db/schema.ts`, `drizzle/` (migrações) e `public/` (ícones e PWA).
