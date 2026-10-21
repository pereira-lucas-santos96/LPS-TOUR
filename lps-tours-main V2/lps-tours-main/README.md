# LUPES TOUR

A página inicial está em **index.html**, nesta pasta, junto de `CNAME` e `LICENSE`.

## Abrir o site

- Para visualizar o site e preparar um pedido pelo WhatsApp, abra `index.html` no navegador.
- Para salvar pedidos e usar o painel, execute `Portal LPS - GT/iniciar.cmd` e acesse `http://localhost:3000`. O servidor precisa de Node.js 22 ou superior.
- O painel fica em `http://localhost:3000/admin.html`.

## Organização

```text
index.html                  Página inicial e formulário
Portal LPS - GT/
  public/                   Estilos, scripts, imagens e painel
    destinos/               Páginas de São Paulo e Santos
    roteiros/               Páginas das experiências
  content/                  Conteúdo usado para gerar os roteiros
  server.mjs                Servidor e API
  iniciar.cmd               Inicialização no Windows
```

Os caminhos da página inicial e das páginas internas funcionam com o arquivo local e com o servidor. O servidor publica somente a página inicial e os arquivos permitidos de `public/`; as pastas de dados e o código do servidor permanecem privados.

O formulário está organizado em **Seus dados**, **Seu passeio** e **Quem vai com você**. O e-mail de atendimento é **pereira.lucas.santos96@gmail.com**.

As instruções de configuração, publicação e testes estão em [Portal LPS - GT/README.md](<Portal LPS - GT/README.md>).
