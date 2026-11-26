# Implementation Plan: Gestão Fábrica de Selas — Especificação

## Overview

Este plano organiza as tarefas de revisão, validação e refinamento dos artefatos de especificação do sistema de gestão da fábrica de selas. O objetivo é garantir que requirements.md e design.md estejam completos, consistentes e prontos para uma futura fase de implementação.

## Tasks

- [ ] 1. Revisar e validar os requisitos de Cadastros Base
  - [ ] 1.1 Verificar cobertura dos requisitos de Autenticação e Controle de Acesso (Req. 1)
    - Confirmar que os critérios de aceite cobrem login, logout, redirecionamento e controle por perfil
    - Verificar se o requisito menciona explicitamente o comportamento de expiração de sessão
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ] 1.2 Verificar cobertura dos requisitos de Clientes, Fornecedores e Funcionários (Req. 2, 3, 4)
    - Confirmar que campos obrigatórios e opcionais estão claramente distinguidos
    - Verificar se o comportamento de reativação de registros inativos está coberto
    - Confirmar que a busca por múltiplos critérios está descrita
    - _Requirements: 2.1–2.5, 3.1–3.4, 4.1–4.4_

  - [ ] 1.3 Verificar cobertura dos requisitos de Matérias-Primas e Modelos de Sela (Req. 5, 6)
    - Confirmar que os tipos de unidade de medida aceitos estão listados
    - Verificar se o comportamento do custo estimado quando uma MP é inativada está especificado
    - Confirmar que a composição padrão do modelo pode ter zero itens (modelo vazio)
    - _Requirements: 5.1–5.4, 6.1–6.4_

- [ ] 2. Revisar e validar os requisitos de Produção e Estoque
  - [ ] 2.1 Verificar cobertura dos requisitos de Gestão de Estoque de MP (Req. 7)
    - Confirmar que o histórico de movimentações inclui o documento de origem em todos os tipos
    - Verificar se o ajuste de inventário exige aprovação ou apenas justificativa
    - Confirmar o comportamento quando a saída zera exatamente o estoque (caso limite)
    - _Requirements: 7.1–7.6_

  - [ ] 2.2 Verificar cobertura dos requisitos de Ordens de Produção (Req. 8)
    - Confirmar que todas as transições de status permitidas estão descritas (ex.: Aberta → Cancelada é permitido?)
    - Verificar se existe requisito para editar a data prevista de uma OP em andamento
    - Confirmar o comportamento de cancelamento de OP quando há requisições de material já confirmadas (reversão de estoque)
    - _Requirements: 8.1–8.9_

  - [ ] 2.3 Verificar cobertura dos requisitos de Estoque de Produtos Acabados (Req. 9)
    - Confirmar que o custo médio unitário no Estoque de PA é calculado pelo método de custo médio ponderado
    - Verificar se o ajuste de inventário de PA gera movimentação no histórico
    - _Requirements: 9.1–9.5_

- [ ] 3. Revisar e validar os requisitos de Vendas e Financeiro
  - [ ] 3.1 Verificar cobertura dos requisitos de Pedidos de Venda (Req. 10)
    - Confirmar que o parcelamento da fatura tem regras definidas (mínimo de parcelas, datas)
    - Verificar se pedidos com itens mistos (estoque + encomenda) são contemplados
    - Confirmar o comportamento do status "Faturado" vs "Entregue" (qual ação dispara cada um)
    - _Requirements: 10.1–10.8_

  - [ ] 3.2 Verificar cobertura dos requisitos de Comissões (Req. 11)
    - Confirmar que comissão cancelada (via cancelamento de pedido) está descrita em Req. 11
    - Verificar se existe requisito para estorno de comissão já paga quando pedido é cancelado
    - _Requirements: 11.1–11.4_

  - [ ] 3.3 Verificar cobertura dos requisitos de Contas a Receber e a Pagar (Req. 12, 13)
    - Confirmar que a atualização automática para status VENCIDA está descrita como comportamento de leitura (on-read) ou job periódico
    - Verificar se existe requisito para cancelamento de parcela individual (vs cancelamento total da fatura)
    - _Requirements: 12.1–12.5, 13.1–13.6_

  - [ ] 3.4 Verificar cobertura dos requisitos de Fluxo de Caixa e Dashboard (Req. 14, 15)
    - Confirmar que o escopo dos lançamentos avulsos está restrito ao Administrador nos requisitos
    - Verificar se os indicadores do dashboard são suficientes para o perfil Operacional
    - Confirmar que o requisito de responsividade (Req. 15.3, 15.4) está alinhado com o design
    - _Requirements: 14.1–14.6, 15.1–15.5_

- [ ] 4. Checkpoint — Requisitos revisados
  - Confirmar que todos os itens de verificação das tarefas 1–3 foram resolvidos ou documentados como decisões de projeto.

- [ ] 5. Revisar o design de banco de dados e fluxos de negócio
  - [ ] 5.1 Verificar consistência do schema SQL com os requisitos
    - Confirmar que todos os campos obrigatórios dos requisitos têm colunas NOT NULL correspondentes no schema
    - Verificar que as constraints CHECK do schema cobrem todos os valores de enumeração listados nos requisitos
    - Confirmar que a FK `selas_movimentacoes_mp.ordem_producao_id` está sem REFERENCES (intencional?) e documentar a decisão
    - _Requirements: 7.5, 8.3_

  - [ ] 5.2 Verificar cobertura dos fluxos de negócio críticos no design
    - Confirmar que o fluxo de cancelamento de OP com requisições confirmadas está descrito (reversão de MP)
    - Verificar se o recálculo do custo médio do Estoque de PA está detalhado no design
    - Confirmar que o fluxo de geração automática de Conta a Pagar na entrada de MP está no design
    - _Requirements: 7.1, 8.6, 13.2_

  - [ ] 5.3 Verificar as funções puras de cálculo (`calculations.ts`)
    - Confirmar que todas as fórmulas de negócio dos requisitos têm uma função pura correspondente no design
    - Verificar se falta função para custo médio ponderado do Estoque de PA
    - Confirmar que a função `isVencida` cobre o caso de `data_vencimento === hoje` (vence hoje = vencida?)
    - _Requirements: 8.4, 10.2, 10.3, 14.3_

- [ ] 6. Revisar a arquitetura de componentes e API
  - [ ] 6.1 Verificar completude da tabela de endpoints da API
    - Confirmar que todos os módulos têm endpoints GET, POST e PUT/PATCH listados na tabela
    - Verificar se faltam endpoints de DELETE ou se a inativação substitui exclusão em todos os casos
    - Confirmar que o endpoint de ajuste de inventário de PA (`/api/selas/estoque-pa/[id]/movimentacoes`) está listado
    - _Requirements: 9.5_

  - [ ] 6.2 Verificar consistência do controle de acesso nos endpoints
    - Confirmar que todos os endpoints de inativação têm perfil mínimo ADMIN na tabela
    - Verificar se o endpoint do fluxo de caixa (GET e POST) está restrito a ADMIN
    - _Requirements: 1.5, 1.6, 14.1_

  - [ ] 6.3 Verificar os componentes de UI reutilizáveis
    - Confirmar que `DataTable` tem comportamento de cards em mobile descrito no design
    - Verificar se `FormModal` cobre o caso de formulários com campos condicionais (ex.: cliente obrigatório apenas em OP tipo encomenda)
    - _Requirements: 15.3, 15.4_

- [ ] 7. Revisar as propriedades de correção (Correctness Properties)
  - [ ] 7.1 Verificar cobertura das propriedades em relação aos requisitos
    - Mapear cada requisito funcional para ao menos uma propriedade de correção
    - Identificar requisitos que não têm propriedade associada (ex.: Req. 8.5 — suporte a status)
    - Confirmar que Property 25 cobre o saldo acumulado linha a linha do extrato
    - _Requirements: todos os requisitos_

  - [ ] 7.2 Verificar clareza e testabilidade das propriedades
    - Confirmar que cada propriedade tem precondição, invariante e pós-condição implícitas identificáveis
    - Verificar se as propriedades de estoque (8, 9, 13) cobrem sequências com ajustes intercalados
    - Confirmar que Property 19 (reversibilidade de cancelamento) descreve o estado do Estoque de PA antes e depois
    - _Requirements: 7.2, 7.3, 9.2, 10.7_

- [ ] 8. Checkpoint final — Especificação completa
  - Confirmar que requirements.md, design.md e tasks.md estão consistentes entre si.
  - Registrar quaisquer decisões de projeto abertas que precisem de resposta antes da implementação.
  - Confirmar que o glossário cobre todos os termos técnicos utilizados nos três documentos.

## Notes

- Todas as tarefas são de revisão/validação documental — nenhuma envolve escrita de código
- Itens marcados com `*` seriam opcionais numa fase de implementação, mas aqui todos são relevantes para a qualidade da spec
- Decisões de projeto em aberto encontradas durante a revisão devem ser registradas como comentários nos documentos de spec ou em um arquivo de decisões separado
- A ordem das tarefas segue a dependência natural: requisitos → design de dados → design de API → propriedades formais

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3"] },
    { "id": 5, "tasks": ["7.1", "7.2"] }
  ]
}
```
