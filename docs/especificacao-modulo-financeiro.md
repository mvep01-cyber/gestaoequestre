# Especificação do módulo Financeiro

**Status:** especificação funcional e de arquitetura; nenhuma base de dados foi criada ou alterada.
**Data:** 19/11/2026

## 1. Objetivo

Definir dois módulos financeiros distintos:

1. **Financeiro CTE/Haras:** dados operacionais dos centros e haras, em uma base compartilhada, com isolamento por tenant e por login.
2. **Financeiro da plataforma (ADMIN):** dados financeiros da própria plataforma, em uma base separada da base CTE/Haras.

Os lançamentos, consultas e relatórios de um módulo não devem ser misturados com os do outro. Esta especificação não autoriza criar bases, tabelas, migrações, conexões ou mover dados.

## 2. Perfis e limites de acesso

| Perfil/área | Dados acessíveis |
|---|---|
| Login CTE ou Haras | Somente lançamentos operacionais feitos por aquele login. |
| Outro login CTE ou Haras | Não consulta, altera, baixa, exclui, exporta nem recebe dados de lançamentos de outros logins, mesmo que pertençam ao mesmo tenant. |
| ADMIN financeiro da plataforma | Somente os lançamentos financeiros da plataforma armazenados na base separada. Não consulta lançamentos operacionais CTE/Haras por padrão. |

Cada lançamento operacional deve ter vínculo obrigatório ao tenant e ao login que o criou. O vínculo com um cliente, cavalo ou conta bancária não substitui o vínculo ao login criador.

**Ponto de compatibilidade antes da implementação:** o sistema atual diferencia `ADMIN` (gestor do tenant) de `SUPER_ADMIN` (gestor global). A expressão “ADMIN financeiro da plataforma” nesta especificação descreve a área financeira central, mas o perfil de autenticação responsável por ela deve ser mapeado para `SUPER_ADMIN` ou definido como um perfil próprio. Não se deve presumir que o `ADMIN` atual do tenant terá acesso à base financeira central.

## 3. Separação de dados

### 3.1 Base CTE/Haras

- Compartilhada pelos módulos operacionais CTE e Haras.
- Cada registro financeiro deve conter, no mínimo, `tenant_id` e identificador do login que lançou o registro.
- Todas as consultas e operações devem restringir os dados pelo usuário autenticado no servidor; esconder dados apenas na interface não é suficiente.
- Relações com contas, clientes, cavalos, contratos e demais entidades devem validar que os registros relacionados pertencem ao tenant correto e são acessíveis ao login.
- Não usar cópias de lançamentos na base financeira da plataforma.

### 3.2 Base financeira da plataforma

- Separada da base CTE/Haras, com credenciais e conexão exclusivas do servidor.
- Armazena somente as movimentações financeiras da plataforma, como cobranças de planos/assinaturas e despesas administrativas.
- Não contém lançamentos, saldos, comprovantes ou relatórios financeiros operacionais dos tenants.
- Não deve haver junção ou consulta direta entre as bases. Qualquer necessidade futura de suporte ou auditoria sobre dados do tenant requer decisão de acesso explícita, autorização específica e registro de auditoria.

## 4. Financeiro CTE/Haras — requisitos funcionais

### 4.1 Lançamentos

O módulo deve permitir registrar e consultar receitas e despesas do próprio login, incluindo:

- natureza: receita ou despesa;
- categoria, descrição e valor em reais;
- competência, vencimento e, quando pago, data do pagamento;
- status: pendente, pago ou atrasado;
- conta financeira usada na baixa;
- cliente/proprietário, cavalo, contrato ou origem operacional relacionada, quando aplicável;
- comprovante, quando anexado;
- login criador, tenant e data de criação.

As categorias iniciais devem contemplar mensalidades, repasses extras, parcelas de venda, comissões, alimentação/feno e despesas operacionais. A lista final pode ser ajustada antes da implementação.

### 4.2 Consultas e ações

- Listar lançamentos, totais e saldos exclusivamente do login autenticado.
- Filtrar por período/competência, vencimento, natureza, categoria e status, mantendo o mesmo isolamento.
- Permitir registrar pagamento/baixa e atualizar o saldo da conta associada sem duplicar movimentações.
- Impedir alteração, baixa ou exclusão usando IDs pertencentes a outro login.
- Relatórios e exportações devem aplicar os mesmos filtros de propriedade usados na consulta.

### 4.3 Geração automática

Mensalidades, parcelas, comissões ou cobranças geradas a partir de outras operações devem preservar o tenant e o login responsável pela operação de origem. A geração não pode ampliar a visibilidade de dados para outro login.

## 5. Financeiro ADMIN da plataforma — requisitos funcionais

- Registrar receitas da plataforma, especialmente cobranças de planos/assinaturas, e despesas administrativas.
- Relacionar cobranças a tenant, plano, competência, vencimento, pagamento e status, sem importar os lançamentos operacionais do CTE/Haras.
- Exibir totais e relatórios da plataforma por período, categoria, tenant/plano e status.
- Registrar contas e meios de recebimento/pagamento próprios da plataforma.
- Restringir criação, alteração, baixa, exclusão, exportação e consulta ao perfil administrativo que vier a ser definido para esta área.
- Manter trilha de auditoria para alterações financeiras e ações administrativas.

## 6. Requisitos de segurança e integridade

- A autorização deve ser validada no servidor em todas as rotas, inclusive para consultas, alterações, baixas, uploads e exportações.
- O identificador do login criador deve vir da sessão autenticada; não deve ser confiado quando enviado pelo navegador.
- IDs de lançamentos e registros relacionados devem ser validados no escopo correto antes de qualquer operação.
- As duas bases devem usar conexões e credenciais separadas, sem credenciais de banco no navegador.
- Erros de autorização devem ser explícitos e não retornar dados de outro usuário.
- Alterações e baixas devem registrar ator e data; exclusões financeiras devem preservar rastreabilidade, preferencialmente com cancelamento/estorno em vez de remoção física.
- Backups, restauração e retenção devem ser definidos separadamente para cada base.

## 7. Critérios de aceite

1. Um login CTE cria um lançamento e consegue consultá-lo após novo acesso.
2. Outro login CTE, ainda que no mesmo tenant, não encontra nem altera esse lançamento por listagem, busca, ID direto, exportação ou baixa.
3. Um login Haras tem o mesmo isolamento por login, e não consulta registros de logins CTE ou Haras alheios.
4. Lançamentos gerados automaticamente mantêm o escopo do login e tenant de origem.
5. O Financeiro da plataforma apresenta somente receitas e despesas da plataforma e não retorna registros financeiros operacionais CTE/Haras.
6. Usuários sem perfil autorizado recebem bloqueio do servidor, mesmo que chamem diretamente as rotas.
7. Uma operação em uma base não cria, altera ou replica silenciosamente lançamentos na outra.

## 8. Estado atual e etapas futuras

O sistema atual possui lançamentos financeiros na base operacional, com `tenant_id`, vínculo a entidades do tenant, contas, vencimento, pagamento e status. O esquema consultado não possui vínculo obrigatório ao login que criou o lançamento, e o painel atual disponibiliza dados financeiros ao perfil `ADMIN` do tenant. Portanto, o isolamento por login descrito aqui exige uma mudança posterior de modelo e autorização.

Antes de qualquer implementação ou criação de bases:

1. confirmar o perfil de autenticação que representa o ADMIN da plataforma (`SUPER_ADMIN` atual ou novo perfil);
2. aprovar categorias, estados e ações financeiras de cada módulo;
3. decidir política de estorno/exclusão e retenção de comprovantes;
4. definir estratégia de migração do financeiro operacional existente e de criação das conexões segregadas;
5. implementar e testar o isolamento por login, tenant e base antes de liberar os módulos.
