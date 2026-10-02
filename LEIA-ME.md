# Playbook Yuri — aplicação independente

Pacote para um NOVO serviço App do EasyPanel, sugerido `playbook-yuri`. Não se destina ao serviço da landing page `yuriconsorcio`.

## O que foi implementado

- Página de login com a marca do HTML original, azul-marinho e dourado, senha pública `bookplay`, botão copiar e WhatsApp 5538991118169.
- Backend Node.js dentro do container, compatível com as tabelas `compradores` e `compras` já criadas. Não exige instalar PHP no host.
- Conteúdo principal entregue somente com sessão válida e compra aprovada para `playbook-yuri`.
- Cookie assinado, HttpOnly, Secure, SameSite=Lax, válido por oito horas. A situação da compra é conferida a cada requisição protegida.
- Bônus fora do HTML principal: servidor libera após 168 horas da primeira compra ainda aprovada. Mudar o relógio do navegador não antecipa a liberação.
- Progresso local separado pelo ID do comprador. Não sincroniza entre aparelhos.
- Botão Sair e comando administrativo para liberar/revogar acessos manuais.
- Limites de tentativas por e-mail e global, em memória. Use uma réplica inicialmente. Reiniciar limpa os contadores.

## Publicação no EasyPanel

1. Crie um serviço do tipo App, com nome `playbook-yuri`, no projeto desejado.
2. Em Source/Origem, escolha Upload e envie o ZIP deste pacote. Os arquivos estão na raiz do arquivo compactado.
3. Em Build/Construção, selecione Dockerfile e caminho `Dockerfile`. Não use o tipo de origem Dockerfile inline: ele não inclui os arquivos do ZIP.
4. Configure o domínio HTTPS exclusivo do playbook e porta interna 3000.
5. Em Environment/Ambiente, preencha as variáveis do `.env.example`. Não deixe os valores de exemplo.
6. Implante e confira os logs. O início só conclui se as duas tabelas estiverem acessíveis.

Documentação consultada: https://easypanel.io/docs/services/app e https://easypanel.io/docs/builders

### Variáveis

- APP_ORIGIN: endereço público HTTPS completo, por exemplo https://playbook.seudominio.com (não inclui caminho).
- PGHOST: endereço do PostgreSQL acessível DE DENTRO do container novo.
- PGPORT: 5432, salvo se seu banco usar outra porta.
- PGDATABASE e PGUSER: yuriconsorcio.
- PGPASSWORD: senha do banco, inserida somente no painel.
- SESSION_SECRET: segredo aleatório exclusivo. No terminal da VPS, `openssl rand -hex 32` gera um valor. Cole o resultado no painel; não é necessário enviá-lo no chat.
- PORT: 3000.

O endereço do banco ainda precisa ser confirmado. `127.0.0.1` dentro do container não aponta para o PostgreSQL instalado no host. Não use por suposição o banco da Evolution API. Se o banco estiver no host, precisamos identificar sua interface privada e permissões de conexão antes de configurar PGHOST. Não é necessário expor o PostgreSQL publicamente.

## Teste com comprador manual

No console DO NOVO SERVIÇO dentro do EasyPanel, execute com seu e-mail:

```sh
npm run comprador -- liberar "seu-email@exemplo.com" "Seu Nome"
```

Abra o domínio, informe o mesmo e-mail e `bookplay`. A repetição do comando não duplica a compra nem reinicia o prazo de um acesso manual já aprovado. Reativar uma compra manual cancelada inicia um novo prazo de sete dias.

Para cancelar somente as liberações manuais desse e-mail:

```sh
npm run comprador -- revogar "seu-email@exemplo.com"
```

Uma outra compra aprovada do mesmo produto continua concedendo acesso. Conteúdo já lido ou baixado não pode ser recolhido. Sair apaga o cookie do navegador; uma cópia roubada de um cookie continua válida até expirar ou a compra perder a aprovação.

## Checkout Lastlink e entrega por e-mail

O receptor fica desativado sem `LASTLINK_WEBHOOK_SECRET`. Gere esse segredo com `openssl rand -hex 32` e configure-o no ambiente do serviço; não o envie por chat nem o coloque no repositório. Com apenas o segredo configurado, o receptor opera em diagnóstico: recebe o teste, registra somente IDs dos produtos e nomes dos cabeçalhos, e não grava compradores nem compras. Após conferir o teste, configure `LASTLINK_PRODUCT_ID` com o `Products[].Id` real do Playbook para habilitar o processamento de compras. Um teste da Lastlink pode conter IDs fictícios; confira o ID com o produto real antes de ativar.

O painel da Lastlink também exibe um token próprio. Ele não é o segredo de 64 caracteres gerado acima. O mecanismo atual usa a URL secreta; a posição do token nativo no envio ainda precisa ser confirmada, e os logs de diagnóstico não mostram valores de cabeçalhos.

Após implantar e configurar o serviço, cadastre no produto da Lastlink a URL `https://playbook.yuriconsorcio.com/webhook/lastlink/SEU_SEGREDO`. Em Produtos → produto → Integrações → Lastlink - Webhook, escolha os eventos Compra Completa, Pagamento Reembolsado e Pagamento Estornado, teste e salve. O token na URL é a autorização para atualizar compras: mantenha a URL privada. Não há assinatura criptográfica documentada nos exemplos oficiais consultados.

O receptor verifica o ID do produto, ignora `IsTest: true`, grava `Purchase_Order_Confirmed` como `aprovada`, `Payment_Refund` como `reembolsada` e `Payment_Chargeback` como `chargeback`. Usa `Purchase.PaymentId` em `checkout='lastlink'` para identificar a compra e `CreatedAt` em `evento_em` para ignorar reenvios e eventos antigos. Em caso de erro de banco, devolve erro ao emissor para permitir nova tentativa. Fatura criada (`Purchase_Request_Confirmed`) não libera acesso.

Antes do primeiro uso real, valide no painel da Lastlink o ID do produto e um payload representativo de cada evento. Se o produto for assinatura, a política de expiração e renovação ainda precisa ser definida: este receptor cobre compra avulsa, reembolso e chargeback.

Na Lastlink, abra Configurações adicionais → Personalizar Emails e edite Boas-vindas e Confirmação de Pagamento. Inclua o endereço do Playbook, a instrução de usar o e-mail da compra, a senha `bookplay` e o prazo de sete dias do bônus. Faça um envio de teste. O e-mail é enviado pela Lastlink; o receptor não envia mensagens. O comprador pode abrir o link direto do e-mail sem passar pela área de membros da Lastlink, embora o conteúdo continue hospedado fora dela.

Documentação oficial: https://support.lastlink.com/pt-BR/articles/7238888-como-configurar-o-webhook-na-lastlink e https://support.lastlink.com/pt-BR/articles/4374827-e-mails-personalizados-edite-as-mensagens-de-disparo-no-funil-de-vendas

A senha pública compartilhada não prova identidade: quem conhece o e-mail de um comprador pode entrar. Este pacote implementa exatamente o modelo solicitado, sem promessa de acesso individual forte ou monitoramento por IP.

## Verificação realizada e limites

`npm test` executa testes HTTP com repositório de compradores simulado: visitante, e-mail não autorizado, senha errada, origem indevida, sessão expirada, bônus antes/depois do prazo, cancelamento e limite de tentativas. As consultas usam parâmetros, conforme https://node-postgres.com/features/queries.

O schema do PostgreSQL da VPS foi fornecido pelo proprietário e confere com as colunas, defaults e constraints usados aqui; não foi executado um teste de gravação no banco real. A construção Docker, a entrega de e-mails e a recepção de eventos reais dependem da configuração no ambiente publicado.
