# Campo Vivo

Aplicação web mobile-first para gestão de Centros de Treinamento Equestre (CTE) e
Haras. O backend usa Route Handlers do Next.js, PostgreSQL, autenticação por
credenciais e armazenamento local de arquivos. Não há serviço Supabase.

## Requisitos

- Node.js 22 ou superior
- Docker Desktop com Docker Compose

## Primeiro uso

1. Instale as dependências:

   ```powershell
   npm install
   ```

2. O arquivo `.env.local` foi criado na raiz. Confira `DATABASE_URL` e altere as
   senhas de desenvolvimento em `compose.yaml` e `.env.local` se necessário.
   Gere segredos locais com:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Use valores aleatórios diferentes para `NEXTAUTH_SECRET` e
   `PAYMENT_WEBHOOK_SECRET`. Não os publique nem os envie em mensagens.

3. Inicie o PostgreSQL:

   ```powershell
   npm run db:up
   ```

4. Crie as tabelas, índices e gatilhos:

   ```powershell
   npm run db:setup
   ```

   O esquema está em `database/schema.sql`. A operação é idempotente para o
   banco operacional deste projeto.

5. Configure `ADMIN_DATABASE_URL` em `.env.local` com um banco e usuário
   PostgreSQL dedicados ao Financeiro ADMIN. Para o ambiente local, use um nome
   de banco diferente de `campovivo`. Execute:

   ```powershell
   npm run db:admin-setup
   ```

   O comando prepara o banco e aplica `database/admin-finance-schema.sql`.
   Localmente, o bootstrap usa `DATABASE_URL`, que precisa ter permissões
   `CREATEROLE` e `CREATEDB`. Em outros ambientes, configure
   `ADMIN_DATABASE_BOOTSTRAP_URL` com uma conexão temporária que tenha essas
   permissões. A aplicação usa somente `ADMIN_DATABASE_URL` em runtime. Execute
   novamente após atualizações do esquema financeiro ADMIN; os novos campos são
   adicionados sem alterar os lançamentos existentes.

6. Preencha `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`,
   `INITIAL_ADMIN_PASSWORD` (mínimo de 12 caracteres), `INITIAL_TENANT_NAME` e
   `INITIAL_PLAN` em `.env.local`. Crie o primeiro usuário:

   ```powershell
   npm run db:seed
   ```

   O seed cria um usuário `ADMIN` vinculado ao tenant inicial em `TRIAL`; esse
   perfil tem acesso global e pode selecionar qualquer tenant no painel. O
   `SUPER_ADMIN` legado continua sendo uma conta separada. Remova os valores
   `INITIAL_*` de `.env.local` depois.

6. Inicie o Next.js:

   ```powershell
   npm run dev
   ```

   Acesse `http://localhost:3000`; a tela de login é sempre exibida ao abrir o
   endereço principal. Após autenticar, o painel fica em `/dashboard`.

## Banco e armazenamento

- O Docker Compose inicia somente o PostgreSQL; o Next.js roda com `npm run dev`
  no computador.
- Os dados do PostgreSQL ficam no volume Docker `postgres_data`. `npm run db:down`
  para o container sem apagar os dados. Não use `docker compose down -v` se quiser
  preservá-los.
- Uploads privados são gravados em `storage/uploads` e servidos por uma rota
  autenticada. Essa pasta é ignorada pelo Git. Em produção, use um volume
  persistente e faça backups; arquivos locais não são compartilhados entre várias
  instâncias do aplicativo.
- `DATABASE_URL` é uma credencial exclusivamente de servidor. Não use o prefixo
  `NEXT_PUBLIC_` nem a exponha no navegador.
- `ADMIN_DATABASE_URL` aponta para a base separada do Financeiro ADMIN e também
  é exclusivamente de servidor. Não reutilize a base operacional nem exponha
  esta credencial no navegador.
- O PostgreSQL local e as senhas padrão do Compose são apenas para desenvolvimento.
  Troque as credenciais e restrinja o acesso antes de qualquer implantação.

## Autenticação e isolamento

- O login usa NextAuth com e-mail e senha; as senhas são armazenadas com hash
  bcrypt. Não há cadastro público.
- O banco só é acessado pelo servidor Next.js. Route Handlers validam sessão,
  perfil, plano e tenant e usam consultas parametrizadas.
- O cadastro de prestação de serviços pertence a um CTE/Haras. Usuários CLIENTE
  vinculados ao mesmo cadastro compartilham os prestadores; ADMIN pode consultar
  e manter os cadastros de todos os centros, selecionando o centro no topo da
  tela. O complemento do endereço é opcional e limitado a 30 caracteres.
  Outros perfis não acessam a função.
- O cadastro de funcionários usa a mesma regra de acesso por CTE/Haras dos
  prestadores. O valor informado representa a diária ou o mês, conforme o
  tipo de contratação, e não gera lançamentos financeiros automaticamente.
- Fornecedores seguem a mesma regra de acesso. Cada produto exige um fornecedor
  cadastrado no mesmo CTE/Haras; "Ver produtos" filtra a lista pelo fornecedor.
- Na tela de produtos, a seleção de centro filtra a lista e a visualização
  mostra os detalhes de cada vigência. As permissões de alteração permanecem
  restritas às versões futuras elegíveis.
- O Financeiro ADMIN usa uma base própria. O Financeiro CTE/Haras permanece na
  base operacional; os dados financeiros dos dois módulos não são copiados ou
  combinados.
- Cada lançamento CTE/Haras é vinculado ao login criador e a um cliente
  cadastrado por esse login. Somente esse login pode consultar, alterar, baixar
  ou excluir seu lançamento; o perfil ADMIN não acessa os lançamentos
  financeiros CTE/Haras.
- O Financeiro ADMIN apresenta apenas os lançamentos do próprio login, com
  alteração e exclusão auditadas, filtros, resumo e exportação CSV.
- No novo lançamento ADMIN, a descrição tem até 30 caracteres, o valor deve
  ser positivo e o campo Conta aceita texto livre de até 20 caracteres. O
  CTE/Haras é escolhido entre cadastros feitos por ADMIN em todos os centros ou
  pela opção Administrador. A data de pagamento marca o lançamento como pago
  sem movimentar saldo. Pagamentos anteriores vinculados a contas preservam seu
  histórico; desfazê-los pode estornar o saldo associado.
- As rotas de comprovantes CTE/Haras validam o acesso pelo servidor. A interface
  operacional ainda não oferece todos os filtros e ações previstos na especificação.
- O perfil ADMIN existente tem acesso global às funções operacionais: selecione
  um tenant no painel para consultar e administrar seus dados e usuários CTE/Haras.
  Essa seleção não altera o isolamento do Financeiro CTE/Haras nem dá ao ADMIN
  acesso aos lançamentos operacionais.
- O perfil OPERACIONAL pode consultar e alterar somente os clientes cadastrados
  pelo próprio usuário, além de cadastrar novos clientes; não pode excluí-los.
  O mesmo cliente pode ser cadastrado separadamente por outro OPERACIONAL.
  Registros antigos sem autor identificado ficam visíveis somente ao ADMIN, que
  pode consultar, cadastrar, alterar e excluir clientes. O acesso operacional
  não inclui o financeiro; o plano CTE não habilita reprodução.
- Usuários CLIENTE vinculados a um cadastro CTE ou Haras podem cadastrar cavalos
  e clientes e consultar/alterar somente os registros que eles próprios criaram;
  podem excluir somente seus cavalos. O proprietário de um cavalo deve ser um
  cliente do mesmo login. ADMIN pode consultar os registros de todos os usuários
  do tenant selecionado e alternar entre os tenants cadastrados.
- No cadastro de cavalos, ADMIN tem acesso somente à consulta e vê o CTE/Haras
  responsável por cada registro, quando identificável. A inclusão, alteração e
  exclusão continuam disponíveis aos perfis CTE/Haras e OPERACIONAL autorizados.
- Cavalos podem receber vínculos opcionais de Feno, Ração, Baia e Outros produtos
  vigentes do mesmo CTE/Haras. A mensalidade continua informada manualmente.
- Na consulta de clientes, ADMIN vê o vínculo CTE/Haras de cada cadastro. Usuários
  CTE/Haras veem somente os clientes criados pelo próprio login e não recebem
  essa coluna. A consulta, alteração e exclusão de cadastros CTE/Haras ficam
  restritas ao perfil ADMIN.
- O cadastro separado CTE/Haras usa os mesmos dados do formulário de clientes,
  exige a escolha do tipo e fica disponível somente para usuários ADMIN.
- Produtos são separados por cadastro CTE/Haras e identificados por código
  alfanumérico de até cinco caracteres. ADMIN pode consultar todos, sem alterá-los.
  Um novo registro do mesmo código
  encerra a última vigência na data atual e cria outra para o dia seguinte até
  31/12/9999; não é possível versionar novamente antes de essa vigência começar.
  Ao repetir um código, os dados da última versão são preenchidos e apenas
  descrição e valor podem ser modificados. Essas mesmas informações podem ser
  alteradas em uma versão futura com fim em 31/12/9999.
  Uma versão pode ser excluída quando começa depois de hoje e termina em
  31/12/9999. Após a exclusão, a versão restante de mesmo código com maior
  data de início passa a terminar em 31/12/9999; se não houver outra versão,
  nenhuma atualização adicional é necessária.
  Excluir um cadastro CTE/Haras também exclui seus produtos.
  As datas de vigência seguem o horário de Brasília (`America/Sao_Paulo`).
  Execute `npm run db:setup` após atualizar o esquema. Em bases antigas,
  a migração bloqueia códigos com múltiplos subitens, vínculos com cavalos ou
  produtos sem fornecedor. Antes de continuar, faça backup, revise os dados e
  vincule os produtos a fornecedores do mesmo centro; a migração não os apaga.
  Se a coluna ainda não existir, prepare-a com
  `ALTER TABLE public.produtos ADD COLUMN IF NOT EXISTS fornecedor_id uuid`
  e preencha-a para cada produto antes de executar a migração novamente.
- A conta inicial tem perfil `ADMIN`. `SUPER_ADMIN` é criado separadamente pelo
  seed. Para provisionar usuários `ADMIN` ou `OPERACIONAL`, defina
  `USER_NAME`, `USER_EMAIL`, `USER_PASSWORD`, `USER_TENANT_ID` e `USER_ROLE` em
  `.env.local`, depois execute `npm run db:user`. Use uma senha forte e remova
  esses valores do arquivo após o uso.

## Webhook de pagamento

Configure `PAYMENT_WEBHOOK_SECRET` no servidor. O endpoint
`POST /api/webhooks/pagamento` espera o cabeçalho `x-webhook-secret` e um JSON:

```json
{
  "gateway_cobranca_id": "id-da-cobranca-no-provedor",
  "status": "PAGO"
}
```

Antes de encaminhar eventos, valide também a assinatura original do provedor de
pagamento. A atualização é idempotente; gatilhos do PostgreSQL ajustam o saldo e
geram comissões configuradas.

## PWA

O manifesto fica em `src/app/manifest.ts`; `public/sw.js` armazena somente os
ícones estáticos. Páginas autenticadas e respostas da API não são armazenadas em
cache.
