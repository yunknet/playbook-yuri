# Compra conjunta com Reels

Análise de webhook_logs_2026-10-09.xlsx, Sheet1 linha 2: o evento de aprovação foi enviado ao receptor do Playbook, HTTP 200, com os dois produtos em Products. O receptor anterior só gravava Playbook.
O ID dos Reels nessa compra é 167648e6-49ce-41c7-893f-49a97cf258ba. Registros mais antigos usavam outro ID; não foram incluídos automaticamente.

## Publicação
Atualize o código do serviço PLAYBOOK, mantendo domínio, porta, banco, token, segredo e ID principal atuais.
Acrescente no Ambiente do PLAYBOOK:
LASTLINK_REELS_PRODUCT_ID=167648e6-49ce-41c7-893f-49a97cf258ba

O serviço Reels já deve ter criado reels_compras no mesmo banco. O Playbook verifica a existência da tabela na inicialização quando esta variável está ativa.
No serviço REELS, configure para compras diretas e para sair do diagnóstico:
LASTLINK_PRODUCT_ID=167648e6-49ce-41c7-893f-49a97cf258ba

Não substitua LASTLINK_PRODUCT_ID do Playbook pelo ID do adicional. Não mude o destino do webhook principal: ele passa a registrar os dois produtos conforme Products.
O webhook próprio dos Reels pode continuar cadastrado para vendas separadas. Cada integração preserva seu token e segredo.

## Compras anteriores
Publicar código não reprocessa automaticamente eventos antigos. Reenvie o evento da compra conjunta pelo histórico da Lastlink, se disponível. Verifique o estado atual da transação antes; a planilha é um retrato do momento da exportação.
Se houver reembolso posterior, reenvie também os eventos posteriores em ordem cronológica. O armazenamento ignora eventos antigos em relação ao estado já gravado.

## Verificação
No log do Playbook uma compra conjunta deve gerar Lastlink Reels com result purchase, status aprovada e productMatched true.
Confira reels_compras para o comprador e teste login no virais. Após reembolso, confira status reembolsada e sessão bloqueada.
Testes locais: quatro testes passaram, com eventos sanitizados da planilha. PostgreSQL real e implantação ainda não executados por este agente.
