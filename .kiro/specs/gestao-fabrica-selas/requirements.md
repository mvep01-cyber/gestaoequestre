# Requirements Document

## Introduction

Este documento define os requisitos para o sistema web responsivo de gestão e controle de fábrica de selas para equinos e muares. O sistema abrange os módulos de Cadastros Base, Produção, Estoque, Vendas e Financeiro, com foco em usabilidade prática e navegação simples para uso interno. O modelo de produção é misto: ordens por encomenda (cliente específico) e produção para estoque (pronta-entrega). O controle de custos de produção (mão de obra e materiais por peça), comissões de representantes/vendedores e fretes/transportes são contemplados.

---

## Glossary

- **Sistema**: Aplicação web responsiva de gestão da fábrica de selas.
- **Usuário**: Pessoa autenticada que opera o Sistema (perfis: Administrador, Operacional).
- **Administrador**: Usuário com acesso irrestrito a todos os módulos e configurações.
- **Operacional**: Usuário com acesso às funcionalidades do dia a dia, sem acesso a configurações de sistema e relatórios financeiros consolidados.
- **Cliente**: Pessoa física ou jurídica que realiza pedidos de selas.
- **Fornecedor**: Pessoa física ou jurídica que fornece matérias-primas ou serviços.
- **Funcionário**: Colaborador da fábrica registrado no sistema, podendo ser artesão, costureiro, vendedor ou representante.
- **Modelo de Sela**: Especificação técnica de um tipo de sela, contendo nome, descrição, lista de materiais padrão e custo estimado.
- **Matéria-Prima**: Insumo utilizado na fabricação de selas (couro, espuma, ferragem, linha, etc.).
- **Ordem de Produção**: Documento que registra a fabricação de uma ou mais selas, podendo ser por encomenda (vinculada a um Cliente) ou para estoque.
- **Etapa de Produção**: Fase específica do processo de fabricação (ex.: corte, costura, montagem, acabamento).
- **Apontamento de Produção**: Registro de execução de uma Etapa de Produção, contendo o Funcionário responsável, tempo e custo de mão de obra.
- **Requisição de Material**: Registro de consumo de Matéria-Prima vinculado a uma Ordem de Produção.
- **Sela Acabada**: Unidade de sela concluída pela produção e disponível no estoque de produtos acabados.
- **Pedido de Venda**: Documento comercial que registra a venda de uma ou mais Selas Acabadas a um Cliente.
- **Fatura**: Documento financeiro gerado a partir de um Pedido de Venda, representando o valor a receber.
- **Comissão**: Percentual ou valor fixo devido a um Funcionário (representante/vendedor) pela realização de uma venda.
- **Frete**: Custo de transporte associado a um Pedido de Venda.
- **Conta a Receber**: Registro de valor a ser recebido de um Cliente, originado de uma Fatura.
- **Conta a Pagar**: Registro de valor a ser pago a um Fornecedor ou Funcionário.
- **Fluxo de Caixa**: Visão consolidada de entradas e saídas financeiras em um período.
- **Estoque de MP**: Quantidade disponível de cada Matéria-Prima no almoxarifado.
- **Estoque de PA**: Quantidade disponível de cada Sela Acabada no depósito de produtos acabados.

---

## Requirements

### Requisito 1 — Autenticação e Controle de Acesso

**User Story:** Como Usuário, quero autenticar-me com e-mail e senha para acessar o Sistema com segurança.

#### Critérios de Aceite

1. WHEN um Usuário submete e-mail e senha válidos no formulário de login, THE Sistema SHALL autenticar o Usuário e redirecionar para o dashboard principal.
2. IF um Usuário submete credenciais inválidas, THEN THE Sistema SHALL exibir a mensagem "E-mail ou senha inválidos" e manter o Usuário na tela de login.
3. WHEN um Usuário autenticado solicita logout, THE Sistema SHALL encerrar a sessão e redirecionar para a tela de login.
4. WHILE um Usuário não está autenticado, THE Sistema SHALL redirecionar qualquer acesso a rotas protegidas para a tela de login.
5. THE Sistema SHALL suportar dois perfis de acesso: Administrador e Operacional.
6. WHILE o Usuário autenticado possui perfil Operacional, THE Sistema SHALL ocultar as funcionalidades restritas ao Administrador, incluindo configurações de sistema, exclusão de registros e relatórios financeiros consolidados.

---

### Requisito 2 — Cadastro de Clientes

**User Story:** Como Usuário, quero cadastrar e gerenciar clientes para vincular encomendas e pedidos de venda.

#### Critérios de Aceite

1. THE Sistema SHALL permitir o cadastro de Clientes com os campos: nome/razão social, CPF/CNPJ, telefone, e-mail e endereço completo.
2. WHEN um Usuário submete o formulário de cadastro de Cliente com CPF/CNPJ já existente no Sistema, THE Sistema SHALL exibir a mensagem "CPF/CNPJ já cadastrado" e impedir a duplicação.
3. THE Sistema SHALL exibir a lista de Clientes cadastrados com busca por nome e CPF/CNPJ.
4. WHEN um Usuário edita os dados de um Cliente e confirma, THE Sistema SHALL salvar as alterações e exibir mensagem de confirmação.
5. WHERE o perfil do Usuário é Administrador, THE Sistema SHALL permitir a inativação de um Cliente, impedindo que o Cliente seja vinculado a novas Ordens de Produção ou Pedidos de Venda.

---

### Requisito 3 — Cadastro de Fornecedores

**User Story:** Como Usuário, quero cadastrar e gerenciar fornecedores para registrar as compras de matérias-primas.

#### Critérios de Aceite

1. THE Sistema SHALL permitir o cadastro de Fornecedores com os campos: nome/razão social, CPF/CNPJ, telefone, e-mail, endereço completo e categoria (matéria-prima, serviço ou ambos).
2. WHEN um Usuário submete o formulário de cadastro de Fornecedor com CPF/CNPJ já existente no Sistema, THE Sistema SHALL exibir a mensagem "CPF/CNPJ já cadastrado" e impedir a duplicação.
3. THE Sistema SHALL exibir a lista de Fornecedores com busca por nome e CPF/CNPJ.
4. WHERE o perfil do Usuário é Administrador, THE Sistema SHALL permitir a inativação de um Fornecedor.

---

### Requisito 4 — Cadastro de Funcionários

**User Story:** Como Usuário, quero cadastrar funcionários para registrar mão de obra na produção e comissões nas vendas.

#### Critérios de Aceite

1. THE Sistema SHALL permitir o cadastro de Funcionários com os campos: nome completo, CPF, telefone, função (artesão, costureiro, vendedor, representante ou múltiplas funções), salário/hora e percentual de comissão.
2. WHEN um Usuário submete o formulário de cadastro de Funcionário com CPF já existente, THE Sistema SHALL exibir a mensagem "CPF já cadastrado" e impedir a duplicação.
3. THE Sistema SHALL exibir a lista de Funcionários com busca por nome e função.
4. WHERE o perfil do Usuário é Administrador, THE Sistema SHALL permitir a inativação de um Funcionário.

---

### Requisito 5 — Cadastro de Matérias-Primas

**User Story:** Como Usuário, quero cadastrar matérias-primas para controlar o estoque e os custos de produção.

#### Critérios de Aceite

1. THE Sistema SHALL permitir o cadastro de Matérias-Primas com os campos: nome, unidade de medida (metro, quilograma, unidade, par), custo unitário de referência e estoque mínimo.
2. THE Sistema SHALL exibir a lista de Matérias-Primas com busca por nome e unidade de medida.
3. WHEN o Estoque de MP de uma Matéria-Prima atingir ou ficar abaixo do estoque mínimo, THE Sistema SHALL exibir um alerta visual na listagem de Matérias-Primas e no dashboard.
4. WHERE o perfil do Usuário é Administrador, THE Sistema SHALL permitir a inativação de uma Matéria-Prima.

---

### Requisito 6 — Cadastro de Modelos de Sela

**User Story:** Como Usuário, quero cadastrar modelos de sela com suas composições padrão para agilizar a criação de ordens de produção.

#### Critérios de Aceite

1. THE Sistema SHALL permitir o cadastro de Modelos de Sela com os campos: nome, descrição, categoria (sela de vaqueiro, sela inglesa, cangalha, etc.) e lista de Matérias-Primas padrão com quantidade por peça.
2. THE Sistema SHALL calcular e exibir o custo estimado de materiais do Modelo de Sela com base nas quantidades padrão e nos custos unitários de referência das Matérias-Primas vinculadas.
3. THE Sistema SHALL exibir a lista de Modelos de Sela com busca por nome e categoria.
4. WHEN um Usuário edita a lista de materiais de um Modelo de Sela, THE Sistema SHALL recalcular e atualizar o custo estimado de materiais automaticamente.

---

### Requisito 7 — Gestão de Estoque de Matérias-Primas

**User Story:** Como Usuário, quero registrar entradas e saídas de matérias-primas para manter o controle de estoque atualizado.

#### Critérios de Aceite

1. WHEN um Usuário registra uma entrada de Matéria-Prima informando o Fornecedor, quantidade, custo unitário e data, THE Sistema SHALL incrementar o Estoque de MP da Matéria-Prima pelo valor informado.
2. WHEN uma Requisição de Material é confirmada em uma Ordem de Produção, THE Sistema SHALL decrementar automaticamente o Estoque de MP das Matérias-Primas requisitadas pelas quantidades informadas.
3. IF uma Requisição de Material solicitar quantidade superior ao Estoque de MP disponível, THEN THE Sistema SHALL exibir alerta indicando "Estoque insuficiente para [nome da matéria-prima]" e impedir a confirmação da requisição.
4. THE Sistema SHALL exibir o saldo atual do Estoque de MP de cada Matéria-Prima.
5. THE Sistema SHALL registrar um histórico de movimentações (entradas e saídas) por Matéria-Prima, contendo data, tipo de movimentação, quantidade, custo unitário e documento de origem.
6. WHERE o perfil do Usuário é Administrador, THE Sistema SHALL permitir o registro de ajustes de inventário com justificativa obrigatória.

---

### Requisito 8 — Gestão de Ordens de Produção

**User Story:** Como Usuário, quero criar e acompanhar ordens de produção para controlar a fabricação de selas, seja por encomenda ou para estoque.

#### Critérios de Aceite

1. THE Sistema SHALL permitir a criação de Ordens de Produção com os campos: tipo (encomenda ou estoque), Modelo de Sela, quantidade, data de abertura, data prevista de conclusão e, quando do tipo encomenda, o Cliente vinculado.
2. WHEN uma Ordem de Produção é criada a partir de um Modelo de Sela, THE Sistema SHALL pré-preencher a lista de Matérias-Primas necessárias com base na composição padrão do Modelo, permitindo ajustes antes da confirmação.
3. THE Sistema SHALL registrar as Etapas de Produção associadas à Ordem de Produção, contendo: nome da etapa, Funcionário responsável, data de execução, horas trabalhadas e custo de mão de obra calculado (horas × salário/hora do Funcionário).
4. THE Sistema SHALL calcular e exibir o custo total de cada Ordem de Produção como a soma dos custos de materiais (Matérias-Primas consumidas × custo unitário) e dos custos de mão de obra (soma dos Apontamentos de Produção).
5. THE Sistema SHALL suportar os seguintes status para Ordens de Produção: Aberta, Em Produção, Concluída e Cancelada.
6. WHEN uma Ordem de Produção é marcada como Concluída, THE Sistema SHALL incrementar o Estoque de PA com a quantidade de Selas Acabadas produzidas, vinculando o custo unitário de produção ao lote.
7. IF uma Ordem de Produção do tipo encomenda for cancelada, THEN THE Sistema SHALL notificar o Usuário para verificar o impacto no Pedido de Venda vinculado, caso exista.
8. THE Sistema SHALL exibir a lista de Ordens de Produção com filtros por status, tipo, período e Modelo de Sela.
9. WHILE uma Ordem de Produção possui status Concluída ou Cancelada, THE Sistema SHALL impedir a edição dos Apontamentos de Produção e Requisições de Material vinculados.

---

### Requisito 9 — Gestão de Estoque de Produtos Acabados

**User Story:** Como Usuário, quero visualizar e controlar o estoque de selas acabadas para gerenciar a disponibilidade para venda.

#### Critérios de Aceite

1. THE Sistema SHALL exibir o saldo atual do Estoque de PA por Modelo de Sela, incluindo quantidade disponível e custo médio unitário.
2. WHEN uma Sela Acabada é vinculada a um Pedido de Venda confirmado, THE Sistema SHALL decrementar o Estoque de PA pela quantidade vendida.
3. IF um Pedido de Venda solicitar quantidade superior ao Estoque de PA disponível de um Modelo de Sela, THEN THE Sistema SHALL exibir alerta indicando "Estoque insuficiente para [nome do modelo]" antes da confirmação do pedido.
4. THE Sistema SHALL registrar um histórico de movimentações do Estoque de PA por Modelo de Sela, contendo data, tipo (entrada por produção ou saída por venda), quantidade e documento de origem.
5. WHERE o perfil do Usuário é Administrador, THE Sistema SHALL permitir o registro de ajustes de inventário no Estoque de PA com justificativa obrigatória.

---

### Requisito 10 — Gestão de Pedidos de Venda

**User Story:** Como Usuário, quero registrar pedidos de venda para controlar as negociações e faturamento.

#### Critérios de Aceite

1. THE Sistema SHALL permitir a criação de Pedidos de Venda com os campos: Cliente, data do pedido, Funcionário responsável pela venda (vendedor ou representante), lista de Selas Acabadas (Modelo, quantidade e preço unitário), valor do Frete e observações.
2. THE Sistema SHALL calcular e exibir o valor total do Pedido de Venda como a soma dos valores dos itens mais o Frete.
3. WHEN um Pedido de Venda é confirmado, THE Sistema SHALL calcular a Comissão devida ao Funcionário responsável com base no percentual de comissão cadastrado aplicado sobre o valor total dos itens (excluindo o Frete).
4. WHEN um Pedido de Venda é confirmado, THE Sistema SHALL gerar uma Fatura com o valor total do pedido e as parcelas de pagamento definidas pelo Usuário.
5. WHEN um Pedido de Venda é confirmado e os itens são do tipo estoque, THE Sistema SHALL decrementar o Estoque de PA pelas quantidades vendidas.
6. THE Sistema SHALL suportar os seguintes status para Pedidos de Venda: Rascunho, Confirmado, Faturado, Entregue e Cancelado.
7. IF um Pedido de Venda for cancelado após confirmação, THEN THE Sistema SHALL reverter o decremento do Estoque de PA e marcar a Fatura vinculada como Cancelada.
8. THE Sistema SHALL exibir a lista de Pedidos de Venda com filtros por status, Cliente, Funcionário responsável e período.

---

### Requisito 11 — Gestão de Comissões

**User Story:** Como Usuário, quero visualizar e controlar as comissões devidas aos vendedores e representantes para garantir o pagamento correto.

#### Critérios de Aceite

1. THE Sistema SHALL exibir a lista de Comissões calculadas por Pedido de Venda confirmado, contendo: Funcionário, Pedido de Venda de origem, valor da venda base (sem Frete), percentual aplicado e valor da Comissão.
2. THE Sistema SHALL suportar os seguintes status de Comissão: Pendente, Paga e Cancelada.
3. WHEN um Usuário registra o pagamento de uma Comissão, THE Sistema SHALL atualizar o status da Comissão para Paga e gerar um lançamento na Conta a Pagar correspondente.
4. THE Sistema SHALL exibir o total de Comissões pendentes por Funcionário.

---

### Requisito 12 — Contas a Receber

**User Story:** Como Usuário, quero gerenciar as contas a receber para acompanhar os pagamentos dos clientes.

#### Critérios de Aceite

1. WHEN uma Fatura é gerada a partir de um Pedido de Venda, THE Sistema SHALL criar automaticamente os registros de Contas a Receber com as parcelas, datas de vencimento e valores definidos.
2. THE Sistema SHALL exibir a lista de Contas a Receber com filtros por Cliente, status (Em Aberto, Recebida, Vencida, Cancelada) e período de vencimento.
3. WHEN um Usuário registra o recebimento de uma parcela informando a data e o valor recebido, THE Sistema SHALL atualizar o status da parcela para Recebida e registrar o valor no Fluxo de Caixa como entrada.
4. WHEN a data atual superar a data de vencimento de uma Conta a Receber com status Em Aberto, THE Sistema SHALL atualizar o status da parcela para Vencida.
5. THE Sistema SHALL exibir o total de Contas a Receber em aberto e o total vencido, agrupados por Cliente.

---

### Requisito 13 — Contas a Pagar

**User Story:** Como Usuário, quero gerenciar as contas a pagar para controlar os compromissos financeiros da fábrica.

#### Critérios de Aceite

1. THE Sistema SHALL permitir o registro manual de Contas a Pagar com os campos: Fornecedor ou Funcionário beneficiário, descrição, valor, data de vencimento e categoria (matéria-prima, serviço, comissão, frete, outros).
2. WHEN um Usuário registra uma entrada de Matéria-Prima vinculada a um Fornecedor, THE Sistema SHALL criar automaticamente uma Conta a Pagar para o Fornecedor com o valor total da nota de entrada e a data de vencimento informada.
3. THE Sistema SHALL exibir a lista de Contas a Pagar com filtros por beneficiário, status (Em Aberto, Paga, Vencida, Cancelada) e período de vencimento.
4. WHEN um Usuário registra o pagamento de uma Conta a Pagar informando a data e o valor pago, THE Sistema SHALL atualizar o status para Paga e registrar o valor no Fluxo de Caixa como saída.
5. WHEN a data atual superar a data de vencimento de uma Conta a Pagar com status Em Aberto, THE Sistema SHALL atualizar o status para Vencida.
6. THE Sistema SHALL exibir o total de Contas a Pagar em aberto e o total vencido.

---

### Requisito 14 — Fluxo de Caixa

**User Story:** Como Usuário Administrador, quero visualizar o fluxo de caixa para acompanhar a saúde financeira da fábrica.

#### Critérios de Aceite

1. WHILE o Usuário autenticado possui perfil Administrador, THE Sistema SHALL exibir o módulo de Fluxo de Caixa.
2. THE Sistema SHALL consolidar no Fluxo de Caixa todas as entradas (recebimentos de Contas a Receber) e saídas (pagamentos de Contas a Pagar) registradas no Sistema.
3. THE Sistema SHALL exibir o saldo atual do caixa como a diferença entre o total de entradas e o total de saídas registradas.
4. WHEN um Usuário Administrador seleciona um período, THE Sistema SHALL exibir o extrato de movimentações de caixa do período selecionado com data, descrição, tipo (entrada ou saída), valor e saldo acumulado.
5. THE Sistema SHALL exibir o total de entradas, o total de saídas e o saldo líquido do período selecionado.
6. WHERE o perfil do Usuário é Administrador, THE Sistema SHALL permitir o registro de lançamentos avulsos no Fluxo de Caixa com descrição, tipo (entrada ou saída), valor e data obrigatórios.

---

### Requisito 15 — Dashboard e Navegação

**User Story:** Como Usuário, quero uma tela inicial com indicadores resumidos e navegação simples para acessar rapidamente os módulos do sistema.

#### Critérios de Aceite

1. WHEN um Usuário autenticado acessa o dashboard, THE Sistema SHALL exibir os seguintes indicadores: ordens de produção em andamento, pedidos de venda confirmados no mês, total de Contas a Receber em aberto, alertas de Matérias-Primas abaixo do estoque mínimo e (exclusivo para Administrador) saldo atual do Fluxo de Caixa.
2. THE Sistema SHALL apresentar navegação por menu lateral ou superior com acesso direto aos módulos: Clientes, Fornecedores, Funcionários, Matérias-Primas, Modelos de Sela, Produção, Estoque, Vendas e Financeiro.
3. WHILE o Usuário acessa o Sistema em dispositivo com largura de tela inferior a 768 pixels, THE Sistema SHALL apresentar o menu de navegação em formato colapsável (hamburguer) e os formulários e tabelas em layout adaptado para tela pequena.
4. THE Sistema SHALL garantir que todos os formulários, tabelas e botões sejam operáveis por toque em dispositivos móveis, com área mínima de toque de 44×44 pixels para elementos interativos.
5. THE Sistema SHALL exibir mensagens de confirmação de sucesso e de erro em operações de criação, edição e exclusão de registros.
