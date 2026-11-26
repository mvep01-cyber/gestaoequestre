# Design Document — Gestão Fábrica de Selas

## Overview

O sistema é uma aplicação web responsiva construída com **Next.js 16 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS 4** e **PostgreSQL** via driver `pg`, seguindo os padrões já estabelecidos no projeto `gestaoequestre`. A autenticação é gerenciada por **NextAuth v4**. O modelo de acesso é multi-perfil (Administrador / Operacional) dentro de um único tenant.

A arquitetura segue o padrão já adotado no projeto:

- **Páginas / Componentes** — React Server Components e Client Components na pasta `src/app/`
- **API Routes** — Next.js Route Handlers em `src/app/api/`
- **Acesso a dados** — funções utilitárias em `src/lib/db.ts` usando `pg`
- **Autenticação** — NextAuth em `src/app/api/auth/[...nextauth]/`
- **Utilitários** — `src/lib/`

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Browser (React 19 + Tailwind CSS 4)                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │  Layout responsivo (menu lateral / hamburguer < 768px)  │ │
│  │  Módulos: Clientes · Fornecedores · Funcionários        │ │
│  │           MP · Modelos de Sela · Produção · Estoque PA  │ │
│  │           Vendas · Comissões · Fin. (ADM) · Dashboard   │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS / fetch
┌───────────────────────────▼──────────────────────────────────┐
│  Next.js 16 App Router (Edge / Node.js runtime)              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Route Handlers (src/app/api/**)                       │  │
│  │  Middleware de autenticação (NextAuth + src/middleware) │  │
│  │  Server Actions opcionais para formulários simples     │  │
│  └───────────────────────┬────────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │ SQL (pg)
┌───────────────────────────▼──────────────────────────────────┐
│  PostgreSQL 16 (Docker / compose.yaml)                       │
│  Schema: selas_*  (namespace próprio, não polui schema atual)│
└──────────────────────────────────────────────────────────────┘
```

---

## Estrutura de Diretórios

```
src/
  app/
    api/
      selas/
        clientes/route.ts
        clientes/[id]/route.ts
        fornecedores/route.ts
        fornecedores/[id]/route.ts
        funcionarios/route.ts
        funcionarios/[id]/route.ts
        materias-primas/route.ts
        materias-primas/[id]/route.ts
        materias-primas/[id]/movimentacoes/route.ts
        modelos-sela/route.ts
        modelos-sela/[id]/route.ts
        ordens-producao/route.ts
        ordens-producao/[id]/route.ts
        ordens-producao/[id]/etapas/route.ts
        ordens-producao/[id]/requisicoes/route.ts
        estoque-pa/route.ts
        estoque-pa/[id]/movimentacoes/route.ts
        pedidos-venda/route.ts
        pedidos-venda/[id]/route.ts
        comissoes/route.ts
        comissoes/[id]/route.ts
        contas-receber/route.ts
        contas-receber/[id]/route.ts
        contas-pagar/route.ts
        contas-pagar/[id]/route.ts
        fluxo-caixa/route.ts
        dashboard/route.ts
    selas/
      layout.tsx               ← layout com menu lateral responsivo
      page.tsx                 ← redireciona para /selas/dashboard
      dashboard/page.tsx
      clientes/page.tsx
      fornecedores/page.tsx
      funcionarios/page.tsx
      materias-primas/page.tsx
      modelos-sela/page.tsx
      producao/page.tsx
      estoque/page.tsx
      vendas/page.tsx
      comissoes/page.tsx
      financeiro/page.tsx      ← visível somente para ADMIN
  lib/
    selas/
      db-selas.ts              ← funções de acesso ao banco (schema selas_*)
      auth-selas.ts            ← helpers de verificação de perfil
      calculations.ts          ← funções puras: custos, comissões, totais
  components/
    selas/
      SideNav.tsx
      DataTable.tsx
      FormModal.tsx
      StatusBadge.tsx
      AlertBadge.tsx
      ConfirmToast.tsx
```

---

## Data Models

### Tabelas principais (schema `public`, prefixo `selas_`)

#### `selas_clientes`
```sql
CREATE TABLE selas_clientes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  cpf_cnpj    TEXT NOT NULL UNIQUE,
  telefone    TEXT,
  email       TEXT,
  endereco    TEXT,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_fornecedores`
```sql
CREATE TABLE selas_fornecedores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  cpf_cnpj    TEXT NOT NULL UNIQUE,
  telefone    TEXT,
  email       TEXT,
  endereco    TEXT,
  categoria   TEXT NOT NULL CHECK (categoria IN ('MATERIA_PRIMA','SERVICO','AMBOS')),
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_funcionarios`
```sql
CREATE TABLE selas_funcionarios (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                 TEXT NOT NULL,
  cpf                  TEXT NOT NULL UNIQUE,
  telefone             TEXT,
  funcoes              TEXT[] NOT NULL DEFAULT '{}',
  salario_hora         NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (salario_hora >= 0),
  percentual_comissao  NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (percentual_comissao BETWEEN 0 AND 100),
  ativo                BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_materias_primas`
```sql
CREATE TABLE selas_materias_primas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT NOT NULL,
  unidade_medida    TEXT NOT NULL CHECK (unidade_medida IN ('METRO','QUILOGRAMA','UNIDADE','PAR')),
  custo_unitario    NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (custo_unitario >= 0),
  estoque_minimo    NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (estoque_minimo >= 0),
  estoque_atual     NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (estoque_atual >= 0),
  ativo             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_movimentacoes_mp`
```sql
CREATE TABLE selas_movimentacoes_mp (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  materia_prima_id  UUID NOT NULL REFERENCES selas_materias_primas(id),
  tipo              TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA','AJUSTE')),
  quantidade        NUMERIC(12,4) NOT NULL,
  custo_unitario    NUMERIC(12,4),
  fornecedor_id     UUID REFERENCES selas_fornecedores(id),
  ordem_producao_id UUID,
  justificativa     TEXT,
  data              DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_modelos_sela`
```sql
CREATE TABLE selas_modelos_sela (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  descricao   TEXT,
  categoria   TEXT NOT NULL,
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_modelos_materiais` (composição padrão)
```sql
CREATE TABLE selas_modelos_materiais (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id        UUID NOT NULL REFERENCES selas_modelos_sela(id) ON DELETE CASCADE,
  materia_prima_id UUID NOT NULL REFERENCES selas_materias_primas(id),
  quantidade       NUMERIC(12,4) NOT NULL CHECK (quantidade > 0),
  UNIQUE (modelo_id, materia_prima_id)
);
```

#### `selas_ordens_producao`
```sql
CREATE TABLE selas_ordens_producao (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo                  TEXT NOT NULL CHECK (tipo IN ('ENCOMENDA','ESTOQUE')),
  modelo_id             UUID NOT NULL REFERENCES selas_modelos_sela(id),
  cliente_id            UUID REFERENCES selas_clientes(id),
  quantidade            INTEGER NOT NULL CHECK (quantidade > 0),
  data_abertura         DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista         DATE,
  status                TEXT NOT NULL DEFAULT 'ABERTA'
                          CHECK (status IN ('ABERTA','EM_PRODUCAO','CONCLUIDA','CANCELADA')),
  custo_total_materiais NUMERIC(14,2) NOT NULL DEFAULT 0,
  custo_total_mao_obra  NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_etapas_producao`
```sql
CREATE TABLE selas_etapas_producao (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id          UUID NOT NULL REFERENCES selas_ordens_producao(id) ON DELETE CASCADE,
  nome_etapa        TEXT NOT NULL,
  funcionario_id    UUID NOT NULL REFERENCES selas_funcionarios(id),
  data_execucao     DATE NOT NULL,
  horas_trabalhadas NUMERIC(6,2) NOT NULL CHECK (horas_trabalhadas > 0),
  custo_mao_obra    NUMERIC(12,2) NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_requisicoes_material`
```sql
CREATE TABLE selas_requisicoes_material (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem_id         UUID NOT NULL REFERENCES selas_ordens_producao(id) ON DELETE CASCADE,
  materia_prima_id UUID NOT NULL REFERENCES selas_materias_primas(id),
  quantidade       NUMERIC(12,4) NOT NULL CHECK (quantidade > 0),
  custo_unitario   NUMERIC(12,4) NOT NULL,
  confirmada       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_estoque_pa`
```sql
CREATE TABLE selas_estoque_pa (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id         UUID NOT NULL UNIQUE REFERENCES selas_modelos_sela(id),
  quantidade        INTEGER NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  custo_medio       NUMERIC(12,4) NOT NULL DEFAULT 0 CHECK (custo_medio >= 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_movimentacoes_pa`
```sql
CREATE TABLE selas_movimentacoes_pa (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id         UUID NOT NULL REFERENCES selas_modelos_sela(id),
  tipo              TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA','AJUSTE')),
  quantidade        INTEGER NOT NULL,
  custo_unitario    NUMERIC(12,4),
  ordem_id          UUID REFERENCES selas_ordens_producao(id),
  pedido_id         UUID,
  justificativa     TEXT,
  data              DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_pedidos_venda`
```sql
CREATE TABLE selas_pedidos_venda (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID NOT NULL REFERENCES selas_clientes(id),
  funcionario_id  UUID NOT NULL REFERENCES selas_funcionarios(id),
  data_pedido     DATE NOT NULL DEFAULT CURRENT_DATE,
  valor_frete     NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_itens     NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total     NUMERIC(14,2) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'RASCUNHO'
                    CHECK (status IN ('RASCUNHO','CONFIRMADO','FATURADO','ENTREGUE','CANCELADO')),
  observacoes     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_itens_pedido`
```sql
CREATE TABLE selas_itens_pedido (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id        UUID NOT NULL REFERENCES selas_pedidos_venda(id) ON DELETE CASCADE,
  modelo_id        UUID NOT NULL REFERENCES selas_modelos_sela(id),
  quantidade       INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario   NUMERIC(12,2) NOT NULL CHECK (preco_unitario >= 0),
  subtotal         NUMERIC(14,2) NOT NULL
);
```

#### `selas_faturas`
```sql
CREATE TABLE selas_faturas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id   UUID NOT NULL REFERENCES selas_pedidos_venda(id),
  valor_total NUMERIC(14,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA','CANCELADA')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_comissoes`
```sql
CREATE TABLE selas_comissoes (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id            UUID NOT NULL REFERENCES selas_pedidos_venda(id),
  funcionario_id       UUID NOT NULL REFERENCES selas_funcionarios(id),
  valor_base           NUMERIC(14,2) NOT NULL,
  percentual_aplicado  NUMERIC(5,2) NOT NULL,
  valor_comissao       NUMERIC(12,2) NOT NULL,
  status               TEXT NOT NULL DEFAULT 'PENDENTE'
                         CHECK (status IN ('PENDENTE','PAGA','CANCELADA')),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_contas_receber`
```sql
CREATE TABLE selas_contas_receber (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id       UUID NOT NULL REFERENCES selas_faturas(id),
  cliente_id      UUID NOT NULL REFERENCES selas_clientes(id),
  parcela         SMALLINT NOT NULL DEFAULT 1,
  valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data_vencimento DATE NOT NULL,
  status          TEXT NOT NULL DEFAULT 'EM_ABERTO'
                    CHECK (status IN ('EM_ABERTO','RECEBIDA','VENCIDA','CANCELADA')),
  data_recebimento DATE,
  valor_recebido  NUMERIC(12,2),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_contas_pagar`
```sql
CREATE TABLE selas_contas_pagar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beneficiario_tipo TEXT NOT NULL CHECK (beneficiario_tipo IN ('FORNECEDOR','FUNCIONARIO')),
  fornecedor_id    UUID REFERENCES selas_fornecedores(id),
  funcionario_id   UUID REFERENCES selas_funcionarios(id),
  descricao        TEXT NOT NULL,
  valor            NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  data_vencimento  DATE NOT NULL,
  categoria        TEXT NOT NULL
                     CHECK (categoria IN ('MATERIA_PRIMA','SERVICO','COMISSAO','FRETE','OUTROS')),
  status           TEXT NOT NULL DEFAULT 'EM_ABERTO'
                     CHECK (status IN ('EM_ABERTO','PAGA','VENCIDA','CANCELADA')),
  data_pagamento   DATE,
  valor_pago       NUMERIC(12,2),
  origem_entrada_id UUID REFERENCES selas_movimentacoes_mp(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

#### `selas_fluxo_caixa`
```sql
CREATE TABLE selas_fluxo_caixa (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo            TEXT NOT NULL CHECK (tipo IN ('ENTRADA','SAIDA')),
  valor           NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  descricao       TEXT NOT NULL,
  data            DATE NOT NULL,
  conta_receber_id UUID REFERENCES selas_contas_receber(id),
  conta_pagar_id  UUID REFERENCES selas_contas_pagar(id),
  lancamento_avulso BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## Components and Interfaces

### Layout Responsivo

O layout principal (`selas/layout.tsx`) utiliza um menu lateral fixo em viewports ≥ 768 px e um menu colapsável com ícone hamburguer em viewports menores, usando a classe `md:flex hidden` do Tailwind e estado React para controle da abertura.

```tsx
// Estrutura simplificada do layout
<div className="flex min-h-screen">
  {/* Menu lateral — oculto em mobile */}
  <aside className="hidden md:flex flex-col w-56 bg-gray-900 text-white">
    <SideNav perfil={session.user.perfil} />
  </aside>

  {/* Menu hamburguer — visível em mobile */}
  <MobileNav perfil={session.user.perfil} />

  {/* Conteúdo principal */}
  <main className="flex-1 p-4">{children}</main>
</div>
```

### Itens de Navegação por Perfil

| Item de Menu      | ADMIN | OPERACIONAL |
|-------------------|:-----:|:-----------:|
| Dashboard         | ✓     | ✓           |
| Clientes          | ✓     | ✓           |
| Fornecedores      | ✓     | ✓           |
| Funcionários      | ✓     | ✓           |
| Matérias-Primas   | ✓     | ✓           |
| Modelos de Sela   | ✓     | ✓           |
| Produção          | ✓     | ✓           |
| Estoque           | ✓     | ✓           |
| Vendas            | ✓     | ✓           |
| Comissões         | ✓     | ✓           |
| Financeiro        | ✓     | ✗           |

### Padrões de UI Reutilizáveis

- **`DataTable`** — tabela com paginação, busca e filtros; renderiza lista completa em desktop e cards empilhados em mobile.
- **`FormModal`** — modal de formulário com validação inline; `dialog` HTML nativo para acessibilidade.
- **`StatusBadge`** — pastilha colorida para status (Aberta, Em Produção, Concluída, Cancelada, etc.).
- **`AlertBadge`** — ícone de alerta vermelho exibido quando estoque ≤ mínimo.
- **`ConfirmToast`** — notificação toast de sucesso / erro, posicionada no canto superior direito com `aria-live="polite"`.
- Todos os elementos interativos têm `min-w-[44px] min-h-[44px]` via classe Tailwind, garantindo área de toque mínima.

---

## Interfaces das API Routes

Todas as rotas seguem o padrão REST com JSON. Cada handler verifica a sessão NextAuth e o perfil antes de processar.

### Padrão de Resposta

```typescript
// Sucesso
{ data: T, message?: string }

// Erro
{ error: string, details?: string }
```

### Endpoints Principais

| Método | Rota                                        | Descrição                                        | Perfil mínimo  |
|--------|---------------------------------------------|--------------------------------------------------|----------------|
| GET    | `/api/selas/clientes`                       | Lista clientes (busca por nome/CPF)              | OPERACIONAL    |
| POST   | `/api/selas/clientes`                       | Cria cliente                                     | OPERACIONAL    |
| PUT    | `/api/selas/clientes/[id]`                  | Edita cliente                                    | OPERACIONAL    |
| PATCH  | `/api/selas/clientes/[id]`                  | Inativa/ativa cliente                            | ADMIN          |
| GET    | `/api/selas/fornecedores`                   | Lista fornecedores                               | OPERACIONAL    |
| POST   | `/api/selas/fornecedores`                   | Cria fornecedor (cria Conta a Pagar se entrada)  | OPERACIONAL    |
| GET    | `/api/selas/funcionarios`                   | Lista funcionários                               | OPERACIONAL    |
| POST   | `/api/selas/funcionarios`                   | Cria funcionário                                 | OPERACIONAL    |
| GET    | `/api/selas/materias-primas`                | Lista MPs com saldo e alerta de estoque          | OPERACIONAL    |
| POST   | `/api/selas/materias-primas`                | Cria MP                                          | OPERACIONAL    |
| POST   | `/api/selas/materias-primas/[id]/movimentacoes` | Registra entrada / ajuste de estoque         | OPERACIONAL / ADMIN |
| GET    | `/api/selas/modelos-sela`                   | Lista modelos com custo estimado                 | OPERACIONAL    |
| POST   | `/api/selas/modelos-sela`                   | Cria modelo com materiais                        | OPERACIONAL    |
| PUT    | `/api/selas/modelos-sela/[id]`              | Edita modelo (recalcula custo)                   | OPERACIONAL    |
| GET    | `/api/selas/ordens-producao`                | Lista OPs com filtros                            | OPERACIONAL    |
| POST   | `/api/selas/ordens-producao`                | Cria OP                                          | OPERACIONAL    |
| PUT    | `/api/selas/ordens-producao/[id]`           | Atualiza status da OP                            | OPERACIONAL    |
| POST   | `/api/selas/ordens-producao/[id]/etapas`    | Adiciona apontamento de produção                 | OPERACIONAL    |
| POST   | `/api/selas/ordens-producao/[id]/requisicoes` | Confirma requisição de materiais               | OPERACIONAL    |
| GET    | `/api/selas/estoque-pa`                     | Saldo do estoque PA por modelo                   | OPERACIONAL    |
| GET    | `/api/selas/pedidos-venda`                  | Lista pedidos com filtros                        | OPERACIONAL    |
| POST   | `/api/selas/pedidos-venda`                  | Cria pedido (Rascunho)                           | OPERACIONAL    |
| PUT    | `/api/selas/pedidos-venda/[id]`             | Confirma / cancela pedido                        | OPERACIONAL    |
| GET    | `/api/selas/comissoes`                      | Lista comissões com totais por funcionário       | OPERACIONAL    |
| PUT    | `/api/selas/comissoes/[id]`                 | Registra pagamento de comissão                   | OPERACIONAL    |
| GET    | `/api/selas/contas-receber`                 | Lista contas a receber com filtros               | OPERACIONAL    |
| PUT    | `/api/selas/contas-receber/[id]`            | Registra recebimento de parcela                  | OPERACIONAL    |
| GET    | `/api/selas/contas-pagar`                   | Lista contas a pagar com filtros                 | OPERACIONAL    |
| POST   | `/api/selas/contas-pagar`                   | Cria conta a pagar manualmente                   | OPERACIONAL    |
| PUT    | `/api/selas/contas-pagar/[id]`              | Registra pagamento                               | OPERACIONAL    |
| GET    | `/api/selas/fluxo-caixa`                    | Extrato por período                              | ADMIN          |
| POST   | `/api/selas/fluxo-caixa`                    | Lançamento avulso                                | ADMIN          |
| GET    | `/api/selas/dashboard`                      | Indicadores do dashboard                         | OPERACIONAL    |

---

## Fluxos de Negócio Críticos

### Fluxo de Produção

```
Criar OP (tipo + modelo + cliente?)
  → pré-preencher materiais do modelo
  → ajustar quantidades se necessário
  → Confirmar requisição de materiais
      → decrementar selas_materias_primas.estoque_atual
      → inserir selas_movimentacoes_mp (SAIDA)
      → inserir/atualizar selas_contas_pagar (se entrada de MP)
  → Registrar etapas de produção (apontamentos)
      → calcular custo_mao_obra = horas × salario_hora do funcionário
  → Concluir OP (status = CONCLUIDA)
      → incrementar selas_estoque_pa.quantidade
      → recalcular custo_medio_pa
      → inserir selas_movimentacoes_pa (ENTRADA)
```

### Fluxo de Venda

```
Criar Pedido (Rascunho)
  → adicionar itens (modelo + qty + preço)
  → calcular valor_itens = Σ(qty × preço)
  → calcular valor_total = valor_itens + frete
  → Confirmar Pedido
      → verificar estoque_pa ≥ quantidade vendida
      → decrementar selas_estoque_pa
      → inserir selas_movimentacoes_pa (SAIDA)
      → calcular comissão = valor_itens × percentual_comissao
      → inserir selas_comissoes
      → gerar selas_faturas
      → inserir selas_contas_receber (parcelas)
```

### Fluxo Financeiro

```
Recebimento de parcela (contas_receber)
  → status = RECEBIDA
  → inserir selas_fluxo_caixa (ENTRADA)

Pagamento de conta (contas_pagar)
  → status = PAGA
  → inserir selas_fluxo_caixa (SAIDA)

Atualização de Vencidos (job diário ou verificação on-read)
  → contas_receber: EM_ABERTO + data_vencimento < hoje → VENCIDA
  → contas_pagar:  EM_ABERTO + data_vencimento < hoje → VENCIDA
```

### Cancelamento de Pedido

```
Cancelar Pedido (após confirmação)
  → reverter selas_estoque_pa (+quantidade)
  → inserir selas_movimentacoes_pa (ENTRADA — reversão)
  → marcar selas_faturas como CANCELADA
  → marcar selas_contas_receber como CANCELADA
  → marcar selas_comissoes como CANCELADA
```

---

## Funções Puras de Cálculo (`src/lib/selas/calculations.ts`)

```typescript
/** Custo estimado de materiais de um modelo */
export function calcularCustoModeloSela(
  materiais: { quantidade: number; custo_unitario: number }[]
): number {
  return materiais.reduce((acc, m) => acc + m.quantidade * m.custo_unitario, 0);
}

/** Custo de mão de obra de uma etapa */
export function calcularCustoEtapa(
  horasTrabalhadas: number,
  salarioHora: number
): number {
  return horasTrabalhadas * salarioHora;
}

/** Custo total de uma Ordem de Produção */
export function calcularCustoOrdem(
  custoMateriais: number,
  custoMaoObra: number
): number {
  return custoMateriais + custoMaoObra;
}

/** Valor total de um Pedido de Venda */
export function calcularTotalPedido(
  itens: { quantidade: number; preco_unitario: number }[],
  frete: number
): { valorItens: number; valorTotal: number } {
  const valorItens = itens.reduce((acc, i) => acc + i.quantidade * i.preco_unitario, 0);
  return { valorItens, valorTotal: valorItens + frete };
}

/** Valor de comissão */
export function calcularComissao(
  valorItens: number,
  percentualComissao: number
): number {
  return (valorItens * percentualComissao) / 100;
}

/** Saldo do fluxo de caixa em um período */
export function calcularSaldoCaixa(
  movimentacoes: { tipo: 'ENTRADA' | 'SAIDA'; valor: number }[]
): number {
  return movimentacoes.reduce(
    (acc, m) => (m.tipo === 'ENTRADA' ? acc + m.valor : acc - m.valor),
    0
  );
}

/** Verifica se uma conta está vencida */
export function isVencida(dataVencimento: Date, hoje: Date = new Date()): boolean {
  return dataVencimento < hoje;
}
```

---

## Error Handling

| Situação                                          | Resposta HTTP | Mensagem retornada                                  |
|---------------------------------------------------|:-------------:|-----------------------------------------------------|
| Credenciais inválidas                             | 401           | "E-mail ou senha inválidos"                         |
| Acesso sem autenticação                           | 401           | "Não autenticado"                                   |
| Acesso a rota restrita por perfil                 | 403           | "Acesso negado"                                     |
| CPF/CNPJ duplicado (clientes, fornecedores, func.)| 409           | "CPF/CNPJ já cadastrado" / "CPF já cadastrado"      |
| Estoque de MP insuficiente                        | 422           | "Estoque insuficiente para [nome da matéria-prima]" |
| Estoque de PA insuficiente                        | 422           | "Estoque insuficiente para [nome do modelo]"        |
| Edição de OP Concluída/Cancelada                  | 422           | "Ordem de produção não pode ser editada neste status"|
| Campos obrigatórios ausentes                      | 400           | "Campo obrigatório: [campo]"                        |
| Recurso não encontrado                            | 404           | "Registro não encontrado"                           |
| Erro interno                                      | 500           | "Erro interno. Tente novamente."                    |

Erros de validação são exibidos inline nos formulários e também como `ConfirmToast` de erro.

---

## Segurança

- Senhas são armazenadas com hash `bcryptjs` (já utilizado no projeto).
- Todas as API Routes verificam a sessão NextAuth via `getServerSession` antes de processar qualquer operação.
- Operações de inativação e exclusão são restritas ao perfil ADMIN, verificado no handler.
- Consultas SQL usam parâmetros posicionais (`$1`, `$2`) via `pg` para evitar injeção SQL.
- O módulo Financeiro (Fluxo de Caixa) só é renderizado e acessível para perfil ADMIN.

---

## Responsividade e Acessibilidade

- Tailwind CSS 4 com breakpoints `md:` para separar layout desktop/mobile.
- Menu lateral fixo em `md:` e hamburguer colapsável em mobile.
- `DataTable` renderiza tabela em `md:` e cartões em mobile (`block md:table`).
- Todos os botões e links têm `min-w-[44px] min-h-[44px]` e `touch-action: manipulation`.
- Formulários usam `<label>` associado a cada `<input>` via `htmlFor`.
- Alertas de estoque mínimo e mensagens de erro usam `role="alert"` e `aria-live="polite"`.
- Modais usam `<dialog>` nativo com `autofocus` no primeiro campo e trap de foco.

---

## Testing Strategy

A estratégia de testes combina testes unitários para funções puras e testes de propriedade para invariantes universais do domínio.

### Testes Unitários (baseados em exemplos)
- Fluxos de autenticação (login válido, logout, redirecionamento sem sessão)
- Transições de status (OP: Aberta → Em Produção → Concluída; Pedido: Rascunho → Confirmado → Cancelado)
- Navegação: verificar que todos os módulos do menu estão presentes e acessíveis
- Cancelamento de Pedido com OP do tipo encomenda (exibição de alerta)

### Testes de Propriedade (property-based)
Usando geração aleatória de entradas para validar invariantes universais:

- **Cálculos financeiros** (`calculations.ts`): custo estimado de modelos, custo de etapas, total de pedidos, valor de comissão, saldo de caixa — verificar com entradas numéricas arbitrárias
- **Unicidade de documentos**: para qualquer CPF/CNPJ gerado, tentativa duplicada deve ser rejeitada
- **Consistência de estoque**: para qualquer sequência de entradas e saídas, saldo = Σentradas − Σsaídas
- **Comissão sem frete**: para qualquer pedido com itens e frete variados, comissão = valor_itens × taxa (nunca inclui frete)
- **Parcelas de fatura**: para qualquer número N de parcelas e valor total V, Σparcelas = V
- **Reversibilidade de cancelamento**: para qualquer pedido confirmado→cancelado, estoque PA retorna ao valor pré-venda

### Cobertura de Casos de Borda
Os geradores de propriedade devem incluir:
- Estoque zerado (edge: requisição de qualquer quantidade > 0 deve ser rejeitada)
- Whitespace em campos de texto obrigatórios (edge: deve ser tratado como vazio)
- Frete zero (edge: comissão não deve mudar; total = valor_itens)
- Datas de vencimento no passado (edge: status VENCIDA exibido imediatamente)

### Framework de Testes
O projeto usa Node.js; recomenda-se **Vitest** com **fast-check** para testes de propriedade, já que ambos são compatíveis com TypeScript e integram-se ao ecossistema Next.js sem configuração adicional. Para execução única (CI): `vitest --run`.

---

## Correctness Properties

*Uma propriedade é uma característica ou comportamento que deve ser verdadeiro em todas as execuções válidas do sistema — essencialmente, uma afirmação formal sobre o que o sistema deve fazer. Propriedades servem como ponte entre especificações legíveis por humanos e garantias de correção verificáveis por máquina.*

### Property 1: Rejeição universal de credenciais inválidas

*Para qualquer* par (e-mail, senha) que não corresponda a um usuário cadastrado no sistema, a tentativa de login deve ser rejeitada com a mensagem "E-mail ou senha inválidos" e nenhuma sessão deve ser criada.

**Validates: Requirements 1.2**

---

### Property 2: Redirecionamento de rotas protegidas

*Para qualquer* rota protegida do sistema acessada sem sessão autenticada, o sistema deve redirecionar para a tela de login.

**Validates: Requirements 1.4**

---

### Property 3: Ocultação de funcionalidades restritas ao perfil OPERACIONAL

*Para qualquer* funcionalidade marcada como exclusiva de Administrador (inativação de registros, configurações, módulo Financeiro), um usuário com perfil OPERACIONAL não deve conseguir acessar nem via UI nem via chamada direta à API.

**Validates: Requirements 1.6, 2.5, 3.4, 4.4, 5.4, 7.6, 9.5, 14.1, 14.6**

---

### Property 4: Unicidade de CPF/CNPJ em Clientes, Fornecedores e Funcionários

*Para qualquer* CPF/CNPJ ou CPF já existente no cadastro respectivo, uma nova tentativa de cadastro com o mesmo documento deve ser rejeitada com a mensagem correspondente ("CPF/CNPJ já cadastrado" ou "CPF já cadastrado") e nenhum registro duplicado deve ser criado.

**Validates: Requirements 2.2, 3.2, 4.2**

---

### Property 5: Consistência dos resultados de busca

*Para qualquer* termo de busca aplicado à listagem de Clientes, Fornecedores, Funcionários, Matérias-Primas ou Modelos de Sela, todos os registros retornados devem conter o termo buscado no campo indexado (nome, CPF/CNPJ, categoria ou função), e nenhum registro que não contenha o termo deve ser retornado.

**Validates: Requirements 2.3, 3.3, 4.3, 5.2, 6.3**

---

### Property 6: Alerta de estoque mínimo de Matérias-Primas

*Para qualquer* Matéria-Prima em que `estoque_atual <= estoque_minimo`, o alerta visual deve ser exibido na listagem e no dashboard. *Para qualquer* Matéria-Prima em que `estoque_atual > estoque_minimo`, o alerta não deve ser exibido.

**Validates: Requirements 5.3**

---

### Property 7: Correção do custo estimado de Modelos de Sela

*Para qualquer* Modelo de Sela com lista de materiais, o custo estimado exibido deve ser igual à soma `Σ(quantidade_i × custo_unitario_i)` sobre todos os materiais vinculados, e deve ser recalculado automaticamente após qualquer edição da lista de materiais.

**Validates: Requirements 6.2, 6.4**

---

### Property 8: Invariante de estoque de Matérias-Primas

*Para qualquer* sequência de operações de entrada, saída (requisição confirmada) e ajuste sobre uma Matéria-Prima, o saldo exibido deve ser sempre igual à soma algébrica de todas as movimentações registradas no histórico, e cada operação deve aparecer no histórico com data, tipo, quantidade e documento de origem corretos.

**Validates: Requirements 7.1, 7.2, 7.4, 7.5**

---

### Property 9: Rejeição de requisição com estoque insuficiente

*Para qualquer* Requisição de Material cuja quantidade solicitada supere o `estoque_atual` da Matéria-Prima, o sistema deve exibir "Estoque insuficiente para [nome da matéria-prima]" e impedir a confirmação sem alterar o saldo.

**Validates: Requirements 7.3**

---

### Property 10: Pré-preenchimento de materiais na Ordem de Produção

*Para qualquer* Modelo de Sela existente, ao criar uma Ordem de Produção a partir desse modelo, a lista de materiais pré-preenchida deve conter exatamente os mesmos materiais e quantidades definidos na composição padrão do modelo (antes de ajustes manuais).

**Validates: Requirements 8.2**

---

### Property 11: Correção do custo de mão de obra por etapa

*Para qualquer* Apontamento de Produção com `horas_trabalhadas` e Funcionário com `salario_hora`, o custo calculado deve ser exatamente `horas_trabalhadas × salario_hora`.

**Validates: Requirements 8.3**

---

### Property 12: Correção do custo total da Ordem de Produção

*Para qualquer* Ordem de Produção, o custo total exibido deve ser igual à soma dos custos dos materiais consumidos (quantidade × custo_unitário) mais a soma de todos os apontamentos de mão de obra.

**Validates: Requirements 8.4**

---

### Property 13: Atualização do estoque de PA na conclusão da OP

*Para qualquer* Ordem de Produção marcada como Concluída com quantidade Q de um Modelo M, o `selas_estoque_pa.quantidade` para o Modelo M deve aumentar em exatamente Q, e uma movimentação de ENTRADA deve ser registrada no histórico do Estoque de PA.

**Validates: Requirements 8.6, 9.1, 9.4**

---

### Property 14: Imutabilidade de OPs em status terminal

*Para qualquer* Ordem de Produção com status Concluída ou Cancelada, qualquer tentativa de adicionar, editar ou remover Apontamentos de Produção ou Requisições de Material deve ser rejeitada com erro.

**Validates: Requirements 8.9**

---

### Property 15: Rejeição de Pedido de Venda com estoque de PA insuficiente

*Para qualquer* Pedido de Venda cujo item solicite uma quantidade superior ao `selas_estoque_pa.quantidade` disponível para aquele Modelo, o sistema deve exibir "Estoque insuficiente para [nome do modelo]" e impedir a confirmação sem alterar o estoque.

**Validates: Requirements 9.3, 10.5**

---

### Property 16: Correção do valor total do Pedido de Venda

*Para qualquer* Pedido de Venda com itens e frete, o `valor_total` deve ser exatamente `Σ(quantidade_i × preco_unitario_i) + frete`, e o `valor_itens` deve ser exatamente `Σ(quantidade_i × preco_unitario_i)`.

**Validates: Requirements 10.2**

---

### Property 17: Correção do cálculo de Comissão

*Para qualquer* Pedido de Venda confirmado com Funcionário responsável, o valor da comissão gerada deve ser exatamente `valor_itens × (percentual_comissao / 100)`, sem incluir o frete.

**Validates: Requirements 10.3**

---

### Property 18: Consistência das parcelas da Fatura com o total do Pedido

*Para qualquer* Pedido de Venda confirmado com N parcelas definidas, a soma dos valores de todas as parcelas em `selas_contas_receber` deve ser igual ao `valor_total` do pedido.

**Validates: Requirements 10.4, 12.1**

---

### Property 19: Reversibilidade do cancelamento de Pedido

*Para qualquer* Pedido de Venda que estava Confirmado e é cancelado, o `selas_estoque_pa.quantidade` deve retornar ao valor anterior à confirmação, a Fatura deve ter status CANCELADA e as parcelas em `selas_contas_receber` devem ter status CANCELADA.

**Validates: Requirements 10.7**

---

### Property 20: Pagamento de comissão gera Conta a Pagar

*Para qualquer* Comissão cujo pagamento é registrado, o status da comissão deve ser atualizado para PAGA e um registro correspondente deve ser criado em `selas_contas_pagar` com o mesmo valor.

**Validates: Requirements 11.3**

---

### Property 21: Recebimento de parcela atualiza Fluxo de Caixa

*Para qualquer* parcela de `selas_contas_receber` cujo recebimento é registrado, o status deve ser atualizado para RECEBIDA e um lançamento de ENTRADA deve ser inserido em `selas_fluxo_caixa` com o valor recebido.

**Validates: Requirements 12.3**

---

### Property 22: Atualização automática para status VENCIDA

*Para qualquer* conta a receber ou conta a pagar com status EM_ABERTO e `data_vencimento < data_atual`, o sistema deve exibir o status VENCIDA na listagem.

**Validates: Requirements 12.4, 13.5**

---

### Property 23: Entrada de MP gera Conta a Pagar automaticamente

*Para qualquer* entrada de Matéria-Prima vinculada a um Fornecedor, um registro deve ser criado automaticamente em `selas_contas_pagar` com o valor total da entrada e a data de vencimento informada.

**Validates: Requirements 13.2**

---

### Property 24: Pagamento de Conta a Pagar registra saída no Fluxo de Caixa

*Para qualquer* Conta a Pagar cujo pagamento é registrado, o status deve ser atualizado para PAGA e um lançamento de SAIDA deve ser inserido em `selas_fluxo_caixa` com o valor pago.

**Validates: Requirements 13.4**

---

### Property 25: Correção do saldo do Fluxo de Caixa

*Para qualquer* estado do sistema ou período selecionado, o saldo exibido no Fluxo de Caixa deve ser exatamente `Σ(entradas) − Σ(saídas)` dos lançamentos registrados, e o saldo acumulado a cada linha do extrato deve refletir a soma cumulativa até aquele ponto.

**Validates: Requirements 14.2, 14.3, 14.4, 14.5**

---

### Property 26: Indicadores do Dashboard condicionados ao perfil

*Para qualquer* usuário ADMIN, o dashboard deve exibir todos os 5 indicadores, incluindo o saldo do Fluxo de Caixa. *Para qualquer* usuário OPERACIONAL, o dashboard deve exibir 4 indicadores, sem o saldo do Fluxo de Caixa.

**Validates: Requirements 15.1**

---

### Property 27: Responsividade do menu de navegação

*Para qualquer* viewport com largura inferior a 768 px, o menu de navegação deve ser exibido em formato colapsável com ícone hamburguer, e os formulários e tabelas devem estar em layout adaptado para tela pequena (sem scroll horizontal).

**Validates: Requirements 15.3**

---

### Property 28: Área mínima de toque

*Para qualquer* elemento interativo da interface (botão, link, campo de formulário, ícone clicável), a área de toque computada deve ser de pelo menos 44 × 44 pixels.

**Validates: Requirements 15.4**

---

### Property 29: Feedback de operações CRUD

*Para qualquer* operação de criação, edição ou exclusão de registro — bem-sucedida ou com erro —, o sistema deve exibir uma mensagem de feedback correspondente ao resultado da operação.

**Validates: Requirements 15.5**
