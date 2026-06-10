# YellowDuck

YellowDuck é um aplicativo mobile desenvolvido com Expo e React Native para funcionar como uma loja digital com temática Pokémon. A proposta do app é reunir catálogo de produtos, cartas, listas de interesse, carrinho, pedidos, chat, leilões e recursos administrativos em uma única experiência.

O projeto foi pensado como uma solução de comércio móvel: o cliente consegue navegar pelos produtos, salvar interesses, comprar itens e conversar com vendedores, enquanto usuários com permissões específicas podem gerenciar produtos, destaques, pedidos e contas.

## Principais recursos

- Autenticação de usuários com telas de login, cadastro e configuração de perfil.
- Home com catálogo de cartas e produtos selados.
- Busca e filtros para facilitar a navegação pelos itens.
- Página de detalhes para cartas e produtos.
- Carrinho de compras e fluxo de pedidos.
- Listas de favoritos/interesse para acompanhar cartas desejadas.
- Área "Minhas cartas" para cadastro e gerenciamento de cartas do usuário.
- Chat entre usuários para negociação e atendimento.
- Sistema de leilões com sala de lances.
- Perfil de usuário com dados, publicações e edição de informações.
- Dashboard do vendedor para acompanhamento de vendas.
- Área administrativa para usuários, produtos e destaques do carrossel.
- Integração com Supabase para persistência e sincronização dos dados.

## Como o aplicativo funciona

Ao abrir o app, o usuário passa pelo controle de autenticação. Caso não esteja logado, ele é direcionado para a tela de login ou cadastro. Depois do acesso, o app libera a navegação principal por abas.

A navegação central é composta por:

- **Perfil:** informações do usuário, publicações, cartas associadas e edição de dados.
- **Listas:** acompanhamento de cartas favoritas ou desejadas.
- **Home:** vitrine principal com cartas, produtos e destaques.
- **Chats:** conversas entre usuários.
- **Leilões:** listagem e participação em leilões.

Além das abas principais, o app possui telas internas para detalhes de produtos, carrinho, pedidos, gerenciamento de cartas, cadastro de produtos, painel do vendedor e administração.

Os serviços da aplicação ficam concentrados em `app/services`. Eles organizam as regras de leitura, gravação, cache local, sincronização e comunicação com o Supabase. As telas ficam em `app/views`, os componentes reutilizáveis em `app/components` e as entidades do domínio em `app/entities`.

## Tecnologias utilizadas

- Expo
- React Native
- Expo Router
- React Navigation
- Supabase
- Async Storage
- Expo Notifications
- Expo Image Picker
- TypeScript e JavaScript

## Estrutura do projeto

```text
app/
  _layout.tsx              Configuração principal de navegação e abas
  index.jsx                Entrada inicial do app
  components/              Componentes reutilizáveis da interface
  entities/                Modelos e entidades usados pelo app
  services/                Serviços de autenticação, dados, carrinho, chat e outros
  views/                   Telas principais e internas do aplicativo

assets/                    Imagens, ícones e recursos visuais
supabase/                  Migrações e configuração do banco
utils/                     Utilitários compartilhados
```

## Pré-requisitos

Antes de executar o projeto, é necessário ter instalado:

- Node.js
- npm
- Expo CLI, via `npx expo`
- Android Studio ou Expo Go, caso queira testar no Android
- Xcode, caso queira testar no iOS em ambiente macOS

## Configuração de ambiente

Crie um arquivo `.env.local` na raiz do projeto com as chaves do Supabase:

```env
EXPO_PUBLIC_SUPABASE_URL=sua_url_do_supabase
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua_chave_publica
```

Também é aceito o nome `EXPO_PUBLIC_SUPABASE_ANON_KEY` para a chave pública, caso esse padrão esteja sendo usado no ambiente.

## Instalação

Instale as dependências do projeto:

```bash
npm install
```

## Executando o app

Para iniciar o servidor de desenvolvimento:

```bash
npm start
```

Para executar no navegador:

```bash
npm run web
```

Para executar no Android:

```bash
npm run android
```

Para executar no iOS:

```bash
npm run ios
```

## Qualidade de código

O projeto possui comando de lint configurado:

```bash
npm run lint
```

## Banco de dados

As migrações e arquivos relacionados ao Supabase ficam na pasta `supabase/`. O app utiliza serviços próprios para centralizar o acesso aos dados, mantendo as telas mais focadas na interface e no fluxo do usuário.

## Objetivo do projeto

O YellowDuck nasceu como um trabalho acadêmico, mas foi desenvolvido com a ideia de evoluir para uma aplicação real de loja mobile. A estrutura permite adaptar o app para diferentes modelos de negócio, mantendo recursos importantes para comércio digital, relacionamento com clientes e gestão de produtos.
