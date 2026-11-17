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
   banco local deste projeto.

5. Preencha `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_EMAIL`,
   `INITIAL_ADMIN_PASSWORD` (mínimo de 12 caracteres), `INITIAL_TENANT_NAME` e
   `INITIAL_PLAN` em `.env.local`. Crie o primeiro usuário:

   ```powershell
   npm run db:seed
   ```

   O seed cria um usuário `ADMIN` e um tenant em `TRIAL`. Para criar um
   `SUPER_ADMIN`, defina `INITIAL_ADMIN_ROLE=SUPER_ADMIN` e execute o seed com
   um e-mail diferente. Remova os valores `INITIAL_*` de `.env.local` depois.

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
- O PostgreSQL local e as senhas padrão do Compose são apenas para desenvolvimento.
  Troque as credenciais e restrinja o acesso antes de qualquer implantação.

## Autenticação e isolamento

- O login usa NextAuth com e-mail e senha; as senhas são armazenadas com hash
  bcrypt. Não há cadastro público.
- O banco só é acessado pelo servidor Next.js. Route Handlers validam sessão,
  perfil, plano e tenant e usam consultas parametrizadas.
- O perfil OPERACIONAL pode consultar e alterar somente os clientes cadastrados
  pelo próprio usuário, além de cadastrar novos clientes; não pode excluí-los.
  O mesmo cliente pode ser cadastrado separadamente por outro OPERACIONAL.
  Registros antigos sem autor identificado ficam visíveis somente ao ADMIN, que
  pode consultar, cadastrar, alterar e excluir clientes. O acesso operacional
  não inclui o financeiro; o plano CTE não habilita reprodução.
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
