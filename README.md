# Dev-lojamobile

Aplicativo mobile/web de loja online desenvolvido com Expo + React Native para o projeto da disciplina.

## Stack

- Expo
- React Native
- Expo Router
- React 19
- TypeScript (parcial no projeto)
- React Native Paper

## Pre-requisitos

- Node.js 20+
- npm 10+
- Expo Go (para testes no celular) ou emulador Android/iOS

## Como rodar o projeto

```bash
npm install
npm run start
```

Comandos disponiveis:

```bash
npm run android   # Executa no Android
npm run ios       # Executa no iOS (macOS)
npm run web       # Executa no navegador
```

## Estrutura principal

```text
app/
  components/   # Componentes reutilizaveis de UI
  entities/     # Entidades/modelos do dominio
  services/     # Regras e servicos (auth, carrinho, favoritos etc.)
  views/        # Telas da aplicacao
  _layout.tsx   # Layout raiz de navegacao
  index.jsx     # Entrada principal da aplicacao
```

## Convencoes recomendadas

- Nao versionar arquivos locais/sensiveis (`.env`, logs, caches, backups).
- Manter componentes em `components/` e logica de negocio em `services/`.
- Evitar arquivos temporarios dentro de `views/` (ex.: `*.bak`).

## Observacoes

- Este projeto usa `npm` com `package-lock.json` versionado para garantir consistencia entre ambientes.
- Em caso de erro apos atualizacao de dependencias, tente remover `node_modules/` e executar `npm install` novamente.
