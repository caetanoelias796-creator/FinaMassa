# Pasta de Dados — Roloff Lanches

Esta pasta reúne a estrutura de dados, configurações, esquema de cardápio e regras do banco de dados do projeto **Roloff Lanches**.

---

## Conteúdo da Pasta `dados/`

1. **`menu.json`**:
   - Cardápio base de lanches, hambúrgueres artesanais, porções, bebidas, sobremesas e adicionais.

2. **`configuracoes.json`**:
   - Modelo de exportação/importação das configurações da loja (WhatsApp, taxas de entrega e chaves de rastreamento limpas).

3. **`database.rules.json`**:
   - Regras de segurança do **Firebase Realtime Database**.
   - Leitura pública para cardápio e status, e gravação restrita para o painel com autenticação.

4. **`storage.rules`**:
   - Regras de segurança do **Firebase Storage** para upload de fotos de produtos no painel.

---

## Como Utilizar / Importar

- **No Painel Administrativo (`painel.html`)**:
  - Navegue até a seção **Configurações**.
  - No card **Backup & Exportação de Dados**, clique em **Importar Cardápio (JSON)** e selecione o arquivo `dados/menu.json`.

- **No Firebase Console**:
  - Em **Realtime Database → Regras**, importe ou cole o conteúdo de `dados/database.rules.json`.
  - Em **Storage → Regras**, importe ou cole o conteúdo de `dados/storage.rules`.
