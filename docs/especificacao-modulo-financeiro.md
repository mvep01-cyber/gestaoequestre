# Especificação do módulo Financeiro

**Status:** especificação funcional e de arquitetura; nenhuma base de dados foi criada ou alterada.
**Data:** 19/11/2026

## 1. Objetivo

Definir dois módulos financeiros distintos:

1. **Financeiro CTE/Haras:** dados operacionais dos centros e haras, em uma base compartilhada, com isolamento por tenant e por login.
2. **Financeiro ADMIN:** dados financeiros próprios da plataforma, em uma base separada da base CTE/Haras.

Os lançamentos, consultas e relatórios de um módulo não devem ser misturados com os do outro. O perfil ADMIN existente administra os acessos de todos os CTEs/Haras e tem acesso amplo às demais funções operacionais desses perfis. Como exceção específica, os lançamentos financeiros CTE/Haras só podem ser consultados, alterados ou excluídos pelo login que os criou; o ADMIN não tem acesso a esses lançamentos. Esta especificação não autoriza criar bases, tabelas, migrações, conexões ou mover dados.

## 2. Perfis e limites de acesso

| Perfil/área | Dados acessíveis |
|---|---|
| Login CTE ou Haras que criou o lançamento | Pode consultar, alterar e excluir os próprios lançamentos financeiros. |
| Outro login CTE ou Haras | Não consulta, altera, baixa, exclui, exporta nem recebe dados de lançamentos de outros logins, mesmo que pertençam ao mesmo tenant. |
| ADMIN existente | Administra os acessos de todos os CTEs/Haras e tem acesso amplo às demais funções operacionais. Não consulta, altera, dá baixa nem exclui lançamentos financeiros criados por logins CTE/Haras. Acessa o Financeiro ADMIN, que contém somente as finanças próprias da plataforma. |

Cada lançamento operacional deve ter vínculo obrigatório ao tenant, ao login que o criou e a um cliente da lista vinculada àquele login. O vínculo com um cavalo ou conta bancária não substitui esses vínculos.

**Perfis:** usar o perfil `ADMIN` existente; não criar perfil novo para o Financeiro. O acesso amplo do ADMIN às funções CTE/Haras não se estende aos lançamentos financeiros criados por esses logins. As autorizações atuais da aplicação deverão ser alinhadas a esse requisito antes da implementação.

## 3. Separação de dados

### 3.1 Base CTE/Haras

- Compartilhada pelos módulos operacionais CTE e Haras.
- Cada registro financeiro deve conter, no mínimo, `tenant_id`, identificador do login criador e identificador do cliente selecionado.
- Todas as consultas e operações devem aplicar no servidor o escopo do perfil autenticado. Para lançamentos financeiros, somente o login criador pode consultar, alterar ou excluir o registro, sem exceção para ADMIN. Esconder dados apenas na interface não é suficiente.
- O login CTE/Haras só pode associar o lançamento a clientes vinculados ao próprio login. A API deve validar essa relação, além do tenant.
- Relações com contas, clientes, cavalos, contratos e demais entidades devem validar que os registros relacionados pertencem ao tenant correto e são acessíveis ao login.
- Não usar cópias de lançamentos na base financeira da plataforma.

### 3.2 Base financeira da plataforma

- Separada da base CTE/Haras, com credenciais e conexão exclusivas do servidor.
- Armazena somente as movimentações financeiras da plataforma, como cobranças de planos/assinaturas e despesas administrativas.
- Não contém lançamentos, saldos, comprovantes ou relatórios financeiros operacionais dos tenants.
- O ADMIN não consulta nem altera lançamentos financeiros CTE/Haras. Sua base não contém cópias desses lançamentos.
- As bases e seus relatórios permanecem separados. Não deve haver junção direta entre as bases nem consolidação automática de lançamentos operacionais em relatórios da plataforma.

## 4. Financeiro CTE/Haras — requisitos funcionais

### 4.1 Lançamentos

O módulo deve permitir que logins CTE/Haras registrem e consultem suas próprias receitas e despesas. Cada lançamento deve incluir:

- natureza: receita ou despesa;
- categoria, descrição e valor em reais;
- competência, vencimento e, quando pago, data do pagamento;
- status: pendente, pago ou atrasado;
- conta financeira usada na baixa;
- cavalo, contrato ou origem operacional relacionada, quando aplicável;
- cliente selecionado, obrigatório, associado ao login que está cadastrando o lançamento;
- comprovante, quando anexado;
- login criador, tenant e data de criação.

O campo **Nome do cliente** deve ser uma lista de seleção, não texto livre. Deve apresentar somente clientes vinculados ao login CTE/Haras autenticado, exigir uma seleção para salvar e persistir o identificador do cliente. A API deve rejeitar clientes vinculados a outro login ou tenant. Esse campo não se aplica aos lançamentos do Financeiro ADMIN da plataforma.

As categorias iniciais devem contemplar mensalidades, repasses extras, parcelas de venda, comissões, alimentação/feno e despesas operacionais. A lista final pode ser ajustada antes da implementação.

### 4.2 Consultas e ações

- Listar lançamentos, totais e saldos exclusivamente do login CTE/Haras autenticado.
- Filtrar por período/competência, vencimento, natureza, categoria e status, mantendo o escopo do login criador.
- Permitir registrar pagamento/baixa e atualizar o saldo da conta associada sem duplicar movimentações.
- Somente o login que criou o lançamento pode consultá-lo, alterá-lo, dar baixa, excluí-lo, exportá-lo ou acessar seu comprovante. ADMIN não pode realizar essas ações nos lançamentos financeiros CTE/Haras.
- Relatórios e exportações devem incluir somente os lançamentos do login autenticado.

### 4.3 Geração automática

Mensalidades, parcelas, comissões ou cobranças geradas a partir de outras operações devem preservar o tenant, o login responsável e o cliente selecionado na origem. A geração não pode ampliar a visibilidade de dados para outro login.

## 5. Financeiro ADMIN da plataforma — requisitos funcionais

- Registrar receitas da plataforma, especialmente cobranças de planos/assinaturas, e despesas administrativas.
- Relacionar cobranças a tenant, plano, competência, vencimento, pagamento e status, sem importar os lançamentos operacionais do CTE/Haras.
- Exibir totais e relatórios da plataforma por período, categoria, tenant/plano e status.
- Registrar contas e meios de recebimento/pagamento próprios da plataforma.
- Restringir criação, alteração, baixa, exclusão, exportação e consulta ao perfil `ADMIN` existente.
- Manter este módulo e seus relatórios separados do Financeiro CTE/Haras. A base e os relatórios ADMIN contêm somente as contas da plataforma.
- Manter trilha de auditoria para alterações financeiras e ações administrativas.

## 6. Requisitos de segurança e integridade

- A autorização deve ser validada no servidor em todas as rotas, inclusive para consultas, alterações, baixas, uploads e exportações.
- O identificador do login criador deve vir da sessão autenticada; não deve ser confiado quando enviado pelo navegador.
- A seleção do cliente deve ser validada no servidor contra a lista vinculada ao login autenticado.
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
5. O Financeiro ADMIN apresenta somente receitas e despesas da plataforma e não permite consultar ou alterar lançamentos financeiros CTE/Haras.
6. Nem outro login CTE/Haras nem ADMIN consegue consultar, alterar, baixar, excluir, exportar ou acessar o comprovante de um lançamento financeiro que não criou, inclusive por acesso direto às rotas e relatórios.
7. Ao criar lançamento CTE/Haras, o campo Nome do cliente exige seleção e apresenta somente clientes vinculados ao login autenticado; um ID de cliente de outro login é rejeitado pelo servidor.
8. Usuários sem perfil autorizado recebem bloqueio do servidor, mesmo que chamem diretamente as rotas.
9. Uma operação em uma base não cria, altera ou replica silenciosamente lançamentos na outra.

## 8. Estado atual e etapas futuras

O sistema atual possui lançamentos financeiros na base operacional, com `tenant_id`, vínculo a entidades do tenant, contas, vencimento, pagamento e status. O esquema consultado não possui vínculo obrigatório ao login criador nem ao cliente exigido nesta especificação, e o painel atual disponibiliza os lançamentos ao perfil `ADMIN` do tenant. Portanto, a propriedade por login, a seleção obrigatória de cliente, a restrição financeira também para ADMIN e a separação da base financeira da plataforma exigem mudanças posteriores de modelo e autorização.

Antes de qualquer implementação ou criação de bases:

1. manter o acesso amplo do perfil `ADMIN` às demais funções CTE/Haras, mas restringir os lançamentos financeiros ao login criador, sem criar um perfil novo;
2. aprovar categorias, estados e ações financeiras de cada módulo;
3. decidir política de estorno/exclusão e retenção de comprovantes;
4. definir estratégia de migração do financeiro operacional existente e de criação das conexões segregadas;
5. implementar e testar o isolamento por login para CTE/Haras, o acesso administrativo e a separação entre as bases antes de liberar os módulos.
