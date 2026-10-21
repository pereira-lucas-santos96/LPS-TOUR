# LUPES TOUR · Lucas Pereira

Site em português para turismo regional em São Paulo, litoral e região, com fotografias reais, seis propostas de roteiro, filtros, álbum ampliável, formulário e painel de solicitações.

## Abrir neste computador

1. Dê dois cliques em **iniciar.cmd**. Mantenha a janela aberta enquanto usar o site.
2. Abra **http://localhost:3000** no navegador.
3. A área do guia está em **http://localhost:3000/admin.html**.
4. A senha é gerada no primeiro início e fica no arquivo **data/admin-key.txt**. Abra esse arquivo para copiar a senha. Ela não aparece no site nem é exposta pelo servidor.

O inicializador usa o Node.js portátil em `.tools/node.exe`, quando disponível, ou o Node.js instalado no computador. Se necessário, instale Node.js 22 ou superior e use `npm start` ou `node server.mjs`. Não há dependências para instalar. O arquivo `../index.html`, na raiz ao lado de CNAME e LICENSE, também pode ser aberto diretamente para visualizar o layout; nesse modo o formulário oferece envio pelo WhatsApp e o painel não funciona.

## Atendimento

- O formulário registra nome, telefone, e-mail opcional, múltiplos interesses, cidade do passeio, data opcional, quantidade de pessoas, perfil, duração opcional (meio dia, dia completo ou 2+ dias), transporte opcional (sim, não ou a combinar), observações e consentimento.
- O formulário está dividido em três blocos: “Seus dados”, “Seu passeio” e “Quem vai com você”, com campos opcionais identificados.
- A cidade é escolhida em uma lista suspensa dos 645 municípios de São Paulo, que abre ao clicar. A opção inicial é “Ainda não escolhi”. A lista fica disponível inclusive ao abrir o HTML localmente.
- Ao escolher “Dois dias ou mais”, aparece a data de término opcional. Quando preenchida, exige uma data de início e deve ser posterior a ela. Ao voltar para outra duração, a data de término é limpa e deixa de ser enviada.
- Ao solicitar, o site abre o WhatsApp com o resumo pronto, incluindo cidade e período, e tenta registrar o pedido no servidor. O cliente precisa confirmar o envio no aplicativo. Caso o navegador bloqueie a abertura, o retorno do formulário mantém um link para abrir a conversa. Na prévia local, o resumo também abre automaticamente, sem registro no servidor.
- Os contatos feitos apenas pelo WhatsApp não são importados automaticamente para o painel. Não há disparo automático de WhatsApp ou e-mail.
- No painel: busca, filtros, etapas de atendimento, anotações internas, contato por WhatsApp/e-mail, exportação CSV e exclusão com confirmação.
- Cidade, datas, duração e transporte aparecem no resumo do WhatsApp, nos detalhes do pedido e no CSV. O painel lembra os pontos para o próximo contato: logística, perfil do grupo, acessibilidade, restrições alimentares e orçamento.
- Etapas: Novo → Em conversa → Proposta enviada → Confirmado → Concluído, com opção de Cancelado.
- A solicitação não confirma disponibilidade, contratação ou pagamento.

## Personalização

- **public/config.js**: WhatsApp `5513981435302` e e-mail.
- **../index.html**: apresentação, conteúdo e privacidade. Ao alterar telefone/e-mail, atualize também os links HTML de fallback e os textos visíveis.
- **content/experiences.mjs**: roteiros, detalhes, sugestões de duração e destinos. Após editar, execute `npm run build` para atualizar as páginas e `public/tours-data.js`.
- **public/app.js**: formulário, interações da página inicial e álbum.
- **cities-sp.json**: lista oficial de municípios usada na validação do servidor. As mesmas opções estão no campo `city` de `../index.html` para funcionar sem conexão; ao atualizar a lista, mantenha ambos sincronizados. Os testes verificam essa correspondência.
- **public/styles.css**: cores, fontes, layout e adaptação para celular.
- **public/assets/**: imagens otimizadas e fontes locais. Os arquivos originais do usuário foram preservados.

O e-mail de atendimento informado pelo responsável é: `pereira.lucas.santos96@gmail.com`. O WhatsApp foi confirmado pelo usuário. O CADASTUR **25.480226.33-3**, informado pelo usuário, aparece na apresentação do guia e no rodapé. As vivências internacionais são apresentadas como **12 países e regiões**, respeitando Inglaterra e Escócia como regiões do Reino Unido.

## Dados e publicação

Os pedidos ficam em `data/requests.json`, no servidor. Faça backup regular e restrinja acesso à pasta `data`. A senha inicial fica em `data/admin-key.txt`; nunca publique essa pasta como conteúdo estático. Exporte dados apenas para uso do atendimento e exclua também cópias exportadas quando necessário. O aviso de privacidade orienta exclusão manual de pedidos sem contratação após 180 dias; não há exclusão automática.

Para receber solicitações de clientes pela internet, publique o servidor Node.js em uma hospedagem com **disco persistente** e HTTPS. Uma publicação somente dos arquivos estáticos permite o WhatsApp, mas não disponibiliza o painel nem salva solicitações no servidor.

Variáveis de ambiente:

| Variável | Uso |
| --- | --- |
| `PORT` | Porta HTTP, padrão 3000 |
| `HOST` | Padrão 127.0.0.1; na hospedagem use 0.0.0.0 |
| `DATA_DIR` | Diretório privado persistente para os pedidos |
| `ADMIN_PASSWORD` | Senha forte com pelo menos 12 caracteres; substitui a senha gerada |
| `NODE_ENV` | Defina `production` na hospedagem |
| `PUBLIC_ORIGIN` | URL pública exata, com HTTPS e sem barra final; obrigatória em produção |

Use uma única instância do processo com esse armazenamento em JSON. Se precisar de vários servidores simultâneos, migre a persistência para um banco de dados. O servidor faz gravações atômicas, valida entradas, restringe arquivos servidos, exige autenticação no painel, usa cookie HttpOnly/SameSite, protege mudanças contra origens externas e limita tentativas de login/envio. O limite considera o IP da conexão; atrás de proxy, configure limites na borda conforme a hospedagem. As sessões duram até oito horas e terminam ao reiniciar o servidor.

Antes da divulgação pública, revise a disponibilidade real dos roteiros, as condições comerciais e seu cadastro profissional. O site ainda não foi publicado em um domínio.

## Verificação

`npm test` executa testes com dados temporários, sem alterar solicitações reais: formulário, autenticação, proteção dos dados, finanças, conflitos de agenda, histórico do funil, páginas de captação, exportação, persistência, exclusão e logout.

Em ambientes que bloqueiam subprocessos, os testes do servidor também aceitam `IN_PROCESS_TESTS=1` com `node --test --test-isolation=none tests/server.test.mjs`. Esse modo mantém servidor e testes no mesmo processo e usa o mesmo armazenamento temporário isolado dos dados reais. Os testes puros de operação e páginas podem ser executados com a mesma opção `--test-isolation=none`.

O teste visual opcional `node scripts/check-browser.mjs` usa um servidor local separado (padrão `http://127.0.0.1:3001`) e um navegador de teste com depuração remota (padrão `http://127.0.0.1:9222`). Inicie esse servidor com `DATA_DIR` apontando para uma pasta de testes vazia, como `artifacts/browser-data`, e use um perfil separado do navegador. O teste cria, altera e exclui um pedido fictício. `BROWSER_BASE`, `BROWSER_CDP` e `BROWSER_DATA_DIR` permitem configurar esses caminhos. As capturas e os dados de teste em `artifacts/` são recriados quando necessário.

Logs, capturas, dados locais e executáveis portáteis estão no `.gitignore` da raiz. As páginas em `public/roteiros/`, `public/destinos/` e `public/tours-data.js` são geradas, mas fazem parte do site e devem ser mantidas. Fontes e fotografias em `public/assets/` têm referências no site; os arquivos de licença também devem ser preservados.

## Gestão da operação

- Abra um pedido no painel para registrar **próximo contato**, **valor da proposta**, **custos previstos**, **início e fim da reserva**. Valores são em reais e armazenados em centavos inteiros. Campos vazios significam informação ausente; zero é um valor válido.
- Margem prevista = proposta − custos previstos. Margem percentual = margem ÷ proposta × 100, apenas quando a proposta é maior que zero. Inclua nos custos previstos tudo que fizer parte da operação, como transporte, fornecedores, trabalho do guia, taxas e impostos aplicáveis. Os valores não substituem controle financeiro ou contábil.
- Os lembretes ficam em **Próximos contatos**, com indicação de atraso. Após o contato, limpe a data ou agende a próxima. Não há envio automático de e-mail, WhatsApp ou notificações do sistema.
- A agenda é mensal e usa o horário de **São Paulo (UTC-03:00)**. As datas pedidas pelo cliente continuam preservadas; o período reservado é preenchido com os horários efetivamente combinados. Inclua deslocamento e preparação nesse período.
- Para um único guia, reservas confirmadas ou concluídas não podem se sobrepor. Intervalos adjacentes são aceitos. Pedidos em conversa e propostas não bloqueiam horários; cancelamentos liberam o período. Reservas antigas sem horários precisam ser completadas no painel.
- O resumo financeiro considera apenas reservas confirmadas/concluídas com proposta e custos preenchidos. O painel informa quantas ficaram de fora por falta de valores. São estimativas, não pagamentos recebidos ou lucro realizado.
- O CSV inclui os campos operacionais, valores, margem e identificação da origem do contato.

## Captação e conversão

- Há seis páginas em `public/roteiros/` e duas em `public/destinos/`, para São Paulo e Santos. O conteúdo fica no HTML para navegação e indexação sem depender de JavaScript. As páginas levam ao formulário com cidade e interesse preenchidos.
- `npm run build` regenera as páginas a partir de `content/experiences.mjs`. Os arquivos gerados já estão incluídos no projeto.
- Configure `PUBLIC_ORIGIN` com o domínio definitivo. O servidor gera `/robots.txt`, `/sitemap.xml` e URLs canônicas nesse domínio. Sem a configuração, o sitemap retorna 503; não são publicadas URLs fictícias. Na hospedagem somente estática, será necessário gerar/configurar sitemap e URLs canônicas na plataforma.
- O formulário registra a página de origem e os parâmetros `utm_source` e `utm_campaign`. Não há cookies nem contagem de visitantes. As taxas medem contatos registrados no formulário, e não aberturas do WhatsApp ou mensagens enviadas somente pelo aplicativo.
- O funil usa etapas acumuladas: **contatos → propostas → reservas**. Marcar Confirmado ou Concluído também registra que houve proposta. Cancelar ou retroceder o status não apaga as etapas alcançadas. Cada contato conta uma única vez em cada etapa.
- O filtro de datas considera quando o contato entrou, no horário de São Paulo, e permite comparar os resultados da mesma turma de contatos. Os totais não são metas nem projeções de vendas futuras.
- Para pedidos anteriores à atualização, a etapa disponível serve de estimativa do histórico; o painel identifica essa limitação. Contatos excluídos deixam de compor os indicadores.
- O material para o Perfil da Empresa no Google está em [GOOGLE-EMPRESA.md](GOOGLE-EMPRESA.md). A criação/verificação do perfil e a publicação do site dependem da conta e dos dados comerciais do responsável.

## Créditos

- Municípios de São Paulo: [API de localidades do IBGE](https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios?orderBy=nome), 645 municípios, consultada em 20/10/2026.
- Fotografias de viagens e retratos: acervo pessoal fornecido por Lucas Pereira; nove imagens utilizadas. O e-mail anexo contém links para Google Drive. Foram usadas as nove fotos fornecidas localmente, sem depender de acesso a arquivos privados do Drive.
- Fotografia da Avenida Paulista: [Unsplash, arquivo original](https://images.unsplash.com/photo-1543059080-f9b1272213d5), utilizada sob a [licença Unsplash](https://unsplash.com/license).
- Fontes: [DM Sans](https://fonts.google.com/specimen/DM+Sans) e [DM Serif Display](https://fonts.google.com/specimen/DM+Serif+Display), SIL Open Font License. Licenças em `public/assets/`.
- Ilustrações dos roteiros: SVGs criados para este projeto; não são fotografias dos locais.
