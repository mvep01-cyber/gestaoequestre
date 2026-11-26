# Especificação: imagem do CTE/Haras

**Situação:** proposta para avaliação; funcionalidade ainda não implementada.

## Objetivo e escopo

Permitir que o perfil **ADMIN** selecione uma imagem ao incluir um cadastro de
CTE/Haras. Quando um usuário com perfil **CLIENTE** vinculado a esse cadastro
entrar no sistema, apresentar a imagem do seu próprio CTE/Haras no canto
superior esquerdo do painel.

Esta função refere-se ao menu **Cadastro CTE/Haras**, não ao menu **Clientes**.
Não altera login, dados dos clientes, cavalos, financeiro ou permissões atuais.
A imagem deve pertencer ao cadastro CTE/Haras, não ao tenant inteiro, pois um
tenant pode conter mais de um cadastro.

## Avaliação do projeto atual

- O formulário de inclusão e alteração de CTE/Haras já é restrito ao ADMIN e
  está em [cte-haras-registrations.tsx](../src/app/cte-haras-registrations.tsx).
- O usuário CLIENTE possui um `cadastro_cte_haras_id`; o servidor verifica esse
  vínculo e o tenant no acesso ao painel. Ver
  [current-user.ts](../src/lib/current-user.ts) e
  [page.tsx](../src/app/dashboard/page.tsx).
- O cabeçalho lateral do painel apresenta atualmente a marca Campo Vivo. Em
  telas menores a barra lateral muda de disposição; a imagem precisa ser
  prevista também para esse layout. Ver [dashboard.tsx](../src/app/dashboard.tsx)
  e [globals.css](../src/app/globals.css).
- Há armazenamento local privado e rotas autenticadas de upload e leitura.
  Elas aceitam atualmente somente arquivos vinculados a equinos ou comprovantes,
  e a tabela `arquivos` restringe esses tipos. Assim, a rota atual **não pode
  ser usada para o novo vínculo sem adaptação**. Ver
  [upload](../src/app/api/uploads/route.ts),
  [leitura de arquivos](../src/app/api/uploads/%5Bid%5D/route.ts) e
  [schema.sql](../database/schema.sql).

**Conclusão:** a funcionalidade é viável, desde que sejam implementados o vínculo
específico, a autorização de leitura e gravação e o tratamento de arquivos.
Não basta acrescentar um campo de imagem no formulário.

## Requisitos funcionais propostos

1. Na inclusão, o ADMIN pode selecionar uma imagem local. A imagem é opcional;
   cadastros existentes e novos sem imagem continuam funcionando.
2. O formulário mostra uma prévia da imagem escolhida antes de salvar e permite
   descartá-la antes da confirmação.
3. Na alteração, propõe-se permitir ao ADMIN visualizar a imagem atual,
   substituí-la ou removê-la. Não selecionar uma nova imagem deve preservar a
   imagem existente. Ao cancelar, nenhuma alteração deve ser persistida.
4. Ao salvar com imagem válida, o cadastro e a imagem ficam vinculados ao
   CTE/Haras correto. O ADMIN recebe confirmação somente após o vínculo ter sido
   persistido.
5. Na primeira carga do painel após o login, o usuário CLIENTE visualiza a
   imagem do cadastro ao qual seu login está vinculado, no alto à esquerda.
   Ela permanece visível durante a navegação no painel.
6. Sem imagem, ou se o arquivo estiver indisponível, a tela continua utilizável
   e apresenta a marca padrão Campo Vivo. Falhas de leitura devem ser registradas
   no servidor, sem expor caminhos internos ao usuário.
7. ADMIN, OPERACIONAL e SUPER_ADMIN mantêm a apresentação atual do painel.
   O usuário CLIENTE não pode cadastrar, alterar ou remover a imagem.
8. A imagem deve adaptar-se a desktop e dispositivos móveis, sem distorção,
   sem sobrepor a navegação e com texto alternativo que identifique o CTE/Haras.

## Regras técnicas propostas

### Formato e validação

- Aceitar JPEG, PNG e WebP; rejeitar SVG, PDF e outros formatos. Um arquivo JFIF
  pode ser aceito se o conteúdo for JPEG válido, independentemente da extensão.
- **Proposta para aprovação:** limitar a 5 MB por imagem. Validar tamanho,
  formato e conteúdo no servidor, não apenas no navegador. Limitar também
  dimensões e quantidade de pixels decodificados para evitar imagens excessivas.
- Usar nomes internos gerados pelo servidor; nunca confiar no nome enviado como
  caminho. Não aceitar URLs externas como substituto do upload.
- Informar claramente quando o arquivo for inválido ou o limite for excedido.

### Persistência e acesso

- Guardar a referência da imagem com o identificador do cadastro CTE/Haras e do
  tenant, garantindo que correspondam ao mesmo registro. Cadastros anteriores
  devem permanecer com imagem nula, sem exigir preenchimento ou migração de dados.
- Reaproveitar o padrão de armazenamento privado existente, adaptando a tabela
  `arquivos`, suas restrições e as rotas, ou adotar uma estrutura equivalente
  com os mesmos controles. Não misturar o novo tipo com comprovantes ou equinos.
- Validar no servidor que apenas ADMIN pode enviar, substituir ou remover, e
  que o cadastro pertence ao tenant selecionado. Na leitura, CLIENTE só pode
  acessar a imagem do seu próprio `cadastro_cte_haras_id` e tenant, mesmo que
  conheça o identificador de outro arquivo. O ADMIN pode ler a imagem do
  cadastro que administra; demais perfis não recebem novo acesso.
- Servir a imagem por rota autenticada, com tipo de conteúdo apropriado e sem
  cache compartilhado. Não expor a pasta de armazenamento como diretório público.
- Ao substituir ou remover, manter a imagem anterior até o novo vínculo estar
  confirmado; após a confirmação, remover o arquivo antigo com tratamento e
  registro de erros. Na exclusão do cadastro, definir limpeza segura do arquivo.
  O processo deve evitar registros ou arquivos órfãos inclusive se o salvamento
  do cadastro, do arquivo ou da transação falhar.
- Como banco e arquivos não compartilham uma transação, definir uma estratégia
  explícita de armazenamento temporário, confirmação e limpeza compensatória.
  Em falha, não apresentar sucesso; permitir nova tentativa sem duplicar o
  cadastro nem apagar a imagem anterior. Prever limpeza de temporários
  abandonados e substituições concorrentes.
- Para implantação, aplicar migração idempotente antes da versão da aplicação
  que consulta os novos campos. Fazer backup do banco e do armazenamento.
  `storage/uploads` é ignorado pelo Git; em produção é necessário volume
  persistente, backup e armazenamento compartilhado quando houver múltiplas
  instâncias.

## Critérios de aceite e testes

1. ADMIN cadastra CTE e Haras com imagens diferentes; cada login CLIENTE vê
   somente a imagem do seu cadastro, inclusive quando ambos pertencem ao mesmo
   tenant.
2. Cadastro sem imagem e registros anteriores funcionam e exibem a marca padrão.
3. Inclusão sem imagem, alteração de outros dados, login, navegação e demais
   funções mantêm o comportamento atual.
4. ADMIN consegue pré-visualizar, trocar, remover e cancelar; uma falha no
   upload ou no banco não confirma sucesso, não cria duplicatas e não perde a
   imagem anteriormente salva.
5. Cliente de outro cadastro ou tenant não consegue ler a imagem por acesso
   direto à rota; perfis não autorizados não conseguem enviá-la ou alterá-la.
6. Arquivo vazio, acima do limite, com tipo ou conteúdo inválido é recusado com
   mensagem; imagens JPEG, PNG e WebP válidas são exibidas corretamente.
7. A imagem fica no topo à esquerda em desktop e celular, preserva a proporção,
   não cobre controles e possui descrição acessível.
8. Falha de leitura mantém a tela utilizável e produz registro de erro; teste
   substituição, exclusão, concorrência, limpeza e reaplicação da migração.

## Decisões para aprovação antes da implementação

- Confirmar se a imagem será exibida **junto à marca Campo Vivo**, preservando-a
  (recomendado), ou se substituirá a marca apenas no painel CLIENTE.
- Confirmar o limite proposto de 5 MB e os formatos JPEG, PNG e WebP.
- Confirmar a possibilidade de alteração e remoção posterior pelo ADMIN.
- Definir o tamanho visual e, se necessário, a política de recorte ou redução
  automática para imagens com proporções diferentes.
