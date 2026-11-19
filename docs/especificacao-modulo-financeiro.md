# Especificação do módulo Financeiro

**Status:** especificação funcional e de arquitetura; nenhuma base de dados foi criada ou alterada.
**Data:** 19/11/2026

## 1. Objetivo

Definir dois módulos financeiros distintos:

1. **Financeiro CTE/Haras:** dados operacionais dos centros e haras, em uma base compartilhada, com isolamento por tenant e por login.
2. **Financeiro ADMIN:** dados financeiros próprios da plataforma, em uma base separada da base CTE/Haras.

Os lançamentos, consultas e relatórios de um módulo não devem ser misturados com os do outro. O perfil ADMIN existente administra os acessos de todos os CTEs/Haras e tem acesso amplo e irrestrito às funções e aos dados operacionais desses perfis. Esse acesso é feito na base CTE/Haras; não significa copiar os lançamentos para a base financeira ADMIN. Esta especificação não autoriza criar bases, tabelas, migrações, conexões ou mover dados.

## 2. Perfis e limites de acesso

| Perfil/área | Dados acessíveis |
|---|---|
| Login CTE ou Haras | Somente lançamentos operacionais feitos por aquele login. |
| Outro login CTE ou Haras | Não consulta, altera, baixa, exclui, exporta nem recebe dados de lançamentos de outros logins, mesmo que pertençam ao mesmo tenant. |
| ADMIN existente | Administra os acessos de todos os CTEs/Haras e pode consultar e administrar, sem a restrição por login, as funções e os dados operacionais de todos esses perfis. Também acessa o Financeiro ADMIN, que contém somente as finanças próprias da plataforma. |

Cada lançamento operacional deve ter vínculo obrigatório ao tenant e ao login que o criou. O vínculo com um cliente, cavalo ou conta bancária não substitui o vínculo ao login criador.

**Perfis:** usar o perfil `ADMIN` existente; não criar perfil novo para o Financeiro. A especificação define que esse perfil administra os acessos CTE/Haras e tem acesso amplo e irrestrito às funções e aos dados desses perfis. As autorizações atuais da aplicação deverão ser alinhadas a esse requisito antes da implementação.

## 3. Separação de dados

### 3.1 Base CTE/Haras

- Compartilhada pelos módulos operacionais CTE e Haras.
- Cada registro financeiro deve conter, no mínimo, `tenant_id` e identificador do login que lançou o registro.
- Todas as consultas e operações devem aplicar no servidor o escopo do perfil autenticado: próprios registros para CTE/Haras e acesso amplo para ADMIN. Esconder dados apenas na interface não é suficiente.
- A restrição por login aplica-se a usuários CTE/Haras. O ADMIN pode consultar e administrar os lançamentos de todos os logins CTE/Haras.
- Relações com contas, clientes, cavalos, contratos e demais entidades devem validar que os registros relacionados pertencem ao tenant correto e são acessíveis ao login.
- Não usar cópias de lançamentos na base financeira da plataforma.

### 3.2 Base financeira da plataforma

- Separada da base CTE/Haras, com credenciais e conexão exclusivas do servidor.
- Armazena somente as movimentações financeiras da plataforma, como cobranças de planos/assinaturas e despesas administrativas.
- Não contém lançamentos, saldos, comprovantes ou relatórios financeiros operacionais dos tenants.
- O ADMIN mantém acesso às funções financeiras CTE/Haras consultando a base operacional de origem; esses dados não são copiados para esta base.
- As bases e seus relatórios permanecem separados. Não deve haver junção direta entre as bases nem consolidação automática de lançamentos operacionais em relatórios da plataforma.

## 4. Financeiro CTE/Haras — requisitos funcionais

### 4.1 Lançamentos

O módulo deve permitir que logins CTE/Haras registrem e consultem suas próprias receitas e despesas. O ADMIN pode executar essas funções e consultar os lançamentos de todos os logins CTE/Haras. Cada lançamento deve incluir:

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

- Para logins CTE/Haras, listar lançamentos, totais e saldos exclusivamente do login autenticado. O ADMIN pode listar os dados de todos os logins CTE/Haras.
- Filtrar por período/competência, vencimento, natureza, categoria e status, mantendo o escopo correspondente ao perfil.
- Permitir registrar pagamento/baixa e atualizar o saldo da conta associada sem duplicar movimentações.
- Impedir que um login CTE/Haras altere, dê baixa ou exclua registros pertencentes a outro login. O ADMIN pode realizar essas operações em todos os registros CTE/Haras, preservando a auditoria.
- Relatórios e exportações devem aplicar o escopo correspondente: próprios registros para CTE/Haras e todos os registros para ADMIN.

### 4.3 Geração automática

Mensalidades, parcelas, comissões ou cobranças geradas a partir de outras operações devem preservar o tenant e o login responsável pela operação de origem. A geração não pode ampliar a visibilidade de dados para outro login.

## 5. Financeiro ADMIN da plataforma — requisitos funcionais

- Registrar receitas da plataforma, especialmente cobranças de planos/assinaturas, e despesas administrativas.
- Relacionar cobranças a tenant, plano, competência, vencimento, pagamento e status, sem importar os lançamentos operacionais do CTE/Haras.
- Exibir totais e relatórios da plataforma por período, categoria, tenant/plano e status.
- Registrar contas e meios de recebimento/pagamento próprios da plataforma.
- Restringir criação, alteração, baixa, exclusão, exportação e consulta ao perfil `ADMIN` existente.
- Manter este módulo e seus relatórios separados do Financeiro CTE/Haras. O acesso amplo do ADMIN aos dados operacionais não deve misturar esses dados com as contas da plataforma.
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
5. O Financeiro ADMIN apresenta somente receitas e despesas da plataforma. O acesso amplo do ADMIN ao Financeiro CTE/Haras ocorre no módulo e na base operacional, sem copiar ou consolidar esses lançamentos na base da plataforma.
6. ADMIN consegue consultar e administrar lançamentos de todos os logins CTE/Haras, inclusive por acesso direto às rotas autorizadas.
7. Usuários sem perfil autorizado recebem bloqueio do servidor, mesmo que chamem diretamente as rotas.
8. Uma operação em uma base não cria, altera ou replica silenciosamente lançamentos na outra.

## 8. Estado atual e etapas futuras

O sistema atual possui lançamentos financeiros na base operacional, com `tenant_id`, vínculo a entidades do tenant, contas, vencimento, pagamento e status. O esquema consultado não possui vínculo obrigatório ao login que criou o lançamento, e o painel atual restringe os dados do perfil `ADMIN` ao tenant. Portanto, o isolamento por login para CTE/Haras, o acesso amplo do ADMIN e a separação da base financeira da plataforma exigem mudanças posteriores de modelo e autorização.

Antes de qualquer implementação ou criação de bases:

1. alinhar a autorização do perfil `ADMIN` existente ao acesso amplo às funções e aos dados CTE/Haras, sem criar um perfil novo;
2. aprovar categorias, estados e ações financeiras de cada módulo;
3. decidir política de estorno/exclusão e retenção de comprovantes;
4. definir estratégia de migração do financeiro operacional existente e de criação das conexões segregadas;
5. implementar e testar o isolamento por login para CTE/Haras, o acesso administrativo e a separação entre as bases antes de liberar os módulos.
