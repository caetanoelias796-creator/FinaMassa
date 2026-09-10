# Fina Massa Pizzaria — Documentação Técnica do Módulo de Campanhas WhatsApp (Fase 5.1)

Esta documentação detalha a arquitetura, configuração, integração oficial com a **WhatsApp Business Platform / Cloud API (Meta)**, fluxos operacionais, regras de segurança, políticas de privacidade (LGPD) e testes automatizados do sistema de **Campanhas Automáticas** da **Fina Massa Pizzaria**.

---

## 1. Visão Geral e Arquitetura

O módulo de Campanhas WhatsApp evoluiu da abordagem de disparos manuais 1 a 1 via `wa.me` para uma arquitetura híbrida de alto desempenho:
1. **Disparo Automático Oficial (Meta Cloud API)**: O administrador clica uma única vez no botão **`🚀 ENVIAR CAMPANHA`**, e o sistema processa automaticamente toda a fila de clientes autorizados, com controle de taxa (*rate limiting* / *pacing*), controle de idempotência (blindagem contra duplicidade) e captura em tempo real do `messageId` oficial.
2. **Modo de Contingência / Fallback Seguro (wa.me)**: Caso a pizzaria ainda não tenha configurado as credenciais da Meta, o sistema **não simula dados falsos**, alerta de forma transparente e permite a continuidade operacional através de links manuais `wa.me`.

### Diagrama de Fluxo

```
[ Administrador ]
       │
       ▼
[ Nova Campanha ] ───► [ Construtor: Título + Mensagem ({nome}, {link}) ]
       │
       ▼
[ Segmentação LGPD ] ──► Somente marketingWhatsApp === true & E.164 válido
       │
       ▼
[ Pré-Visualização ] ──► Balão WhatsApp em tempo real + Contadores
       │
       ▼
[ Salvar Campanha ] ───► Firebase RTDB: campaigns/{campaignId}
       │
       ▼
[ Fila de Disparo ] ───► [ 🚀 ENVIAR CAMPANHA ]
       │
       ▼
[ Confirmação Segurança ] ──► [ Cancelar ] ou [ 🚀 Confirmar Envio ]
       │
       ▼
[ WhatsAppService ] ───► Validação E.164 + Idempotência (campaignId_phone)
       │
       ├──► Pacing seguro (600ms entre mensagens para evitar bloqueios)
       │
       ├──► Meta Cloud API (graph.facebook.com/v21.0/{phoneId}/messages)
       │
       ├──► Captura de messageId e status real (SENT / ERROR / INVALID)
       │
       ▼
[ Sincronização Firebase ] ──► Atualização em tempo real de cada destinatário
       │
       ▼
[ Relatório Final ] ──► Métricas reais: Total, Enviadas, Erros, Lidas
```

---

## 2. Camada Centralizada: `WhatsAppService` (`painel/whatsapp-service.js`)

A camada `WhatsAppService` isola completamente a lógica de rede, sanitização e fila da interface do usuário.

### Métodos Principais

| Método | Descrição |
| :--- | :--- |
| `normalizePhoneE164(rawPhone)` | Converte qualquer telefone brasileiro para o formato E.164 internacional exigido pela Meta (`55 + DDD + 8/9 dígitos`). Rejeita números com menos de 10 dígitos ou DDDs inválidos (< 11 ou > 99). |
| `formatPhoneDisplay(cleanDigits)` | Formata números para exibição amigável no padrão brasileiro, ex: `(54) 99698-5724`. |
| `prepareMessage(template, customer)` | Substitui dinamicamente `{nome}` pelo primeiro nome real e `{link}` pela URL configurada do cardápio digital. |
| `checkIntegrationStatus()` | Inspeciona se o Phone Number ID e o Access Token permanente estão presentes e válidos. |
| `sendTextMessage(to, text, options)` | Efetua a requisição HTTP POST para a Meta Graph API oficial ou para o endpoint proxy backend. |
| `sendTemplateMessage(to, template, ...)` | Envia mensagens de modelo pré-aprovado pela Meta com suporte a variáveis. |
| `dispatchCampaignBatch(campaign, options, callbacks)` | Orquestrador da fila assíncrona sequencial com suporte a pausa (`pauseBatch`), retomada (`resumeBatch`), cancelamento (`cancelBatch`) e retentativa de erros (`options.onlyErrors`). |
| `testConnection()` | Realiza uma chamada de teste direta ao nó da Graph API para validar credenciais. |

---

## 3. Configurações da Loja & WhatsApp Business API

No Painel Administrativo, acesse **Configurações da Loja** para visualizar o card:

### Parâmetros Configuráveis

1. **Ativar Disparo Automático via API**: Alternador liga/desliga geral.
2. **Phone Number ID**: Identificador único do número de telefone registrado na Meta for Developers (Ex: `100609349423711`).
3. **WhatsApp Business Account ID (WABA ID)**: Identificador da conta empresarial da pizzaria na Meta (Ex: `105954558914442`).
4. **Token de Acesso Permanente (System User Token)**: Token de longa duração gerado no Meta Business Suite com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`.
5. **Versão da Graph API**: Padrão `v21.0`.
6. **URL Oficial do Cardápio (`menuUrl`)**: Padrão `https://pizzariafinamassa.com.br/` (substitui a tag `{link}`).
7. **Intervalo entre Envios (ms)**: Controle de *pacing* entre mensagens (padrão: `600ms`). Evita *rate limiting* e previne detecção como spam.
8. **URL do Backend Proxy (Opcional)**: Para ambientes de produção onde se deseje ocultar o token por meio de uma Cloud Function / Firebase Function.

---

## 4. Passo a Passo: Configuração na Meta for Developers

Para obter as credenciais oficiais da WhatsApp Business Cloud API:

1. Acesse [Meta for Developers](https://developers.facebook.com/) e crie uma conta ou faça login.
2. Clique em **Meus Aplicativos** &gt; **Criar Aplicativo**.
3. Selecione o tipo de aplicativo **Empresa (Business)**.
4. Adicione o produto **WhatsApp** ao aplicativo.
5. Na barra lateral, acesse **WhatsApp** &gt; **Configuração da API**:
   - Copie o **Identificador do número de telefone (Phone Number ID)**.
   - Copie o **Identificador da conta do WhatsApp Business (WABA ID)**.
6. Em **Meta Business Suite**:
   - Acesse **Configurações do Negócio** &gt; **Usuários do Sistema**.
   - Crie um Usuário do Sistema (ex: `FinaMassaBot`).
   - Atribua o ativo do aplicativo e adicione as permissões `whatsapp_business_messaging`.
   - Gere o **Token de Acesso Permanente** e cole no campo de Token no Painel da Fina Massa.
7. Clique em **Testar Conexão com a Meta** no painel da Fina Massa para confirmar a comunicação.

---

## 5. Webhooks para Status de Entrega e Leitura

Para receber notificações de mensagens entregues e lidas:

1. Na Meta for Developers, vá em **WhatsApp** &gt; **Configuração** &gt; **Webhook**.
2. Insira a URL do seu endpoint webhook (ex: `https://us-central1-fina-massa-952b1.cloudfunctions.net/whatsappWebhook`).
3. Insira o seu **Token de Verificação (Verify Token)** configurado.
4. Assine os campos:
   - `messages`: para receber status de envio (`sent`), entrega (`delivered`), leitura (`read`) e falhas (`failed`).
5. O webhook deve processar o payload e atualizar o Firebase em:
   ```
   campaigns/{campaignId}/recipients/{recipientIndex}/status = 'DELIVERED' | 'READ' | 'ERROR'
   ```

---

## 6. LGPD, Consentimento e Conformidade

A Fina Massa Pizzaria adota estrita conformidade com a Lei Geral de Proteção de Dados (LGPD):
- O consentimento é capturado explicitamente no storefront via checkbox desmarcado por padrão:
  `[ ] Quero receber novidades e promoções da Fina Massa pelo WhatsApp.`
- O cliente possui o atributo booleano `marketingWhatsApp: true/false` e timestamp de opt-in.
- O construtor de campanhas e o `WhatsAppService` **excluem automaticamente** qualquer cliente que não tenha consentimento explícito (`marketingWhatsApp === false` ou indefinido).
- Clientes que revogarem o consentimento são marcados como `UNAUTHORIZED` e não recebem envios automáticos.

---

## 7. Prevenção contra Duplo Envio (Idempotência)

Para impedir disparos duplicados:
1. **Bloqueio de Interface**: Ao clicar em `🚀 ENVIAR CAMPANHA`, o botão é desabilitado instantaneamente para evitar duplo clique.
2. **Chave de Idempotência**: Cada disparo gera uma chave única composta `campaignId + '_' + cleanPhone`.
3. **Validação de Estado**: Destinatários que já possuam status `SENT`, `DELIVERED` ou `READ` são automaticamente ignorados e não reprocessados, garantindo idempotência mesmo após atualização de página ou retomada de lote.

---

## 8. Estados dos Destinatários

| Status | Emoji / Badge | Significado |
| :--- | :--- | :--- |
| `PENDING` | ⏳ Pendente | Na fila aguardando processamento. |
| `PROCESSING` | 🔄 Enviando... | Requisição enviada para a Meta Cloud API. |
| `SENT` | ✅ Enviado | Mensagem aceita pelo servidor da Meta com `messageId` registrado. |
| `DELIVERED` | 📩 Entregue | Entregue ao smartphone do cliente (confirmado via Webhook). |
| `READ` | 📖 Lido | Aberto/lido pelo cliente (confirmado via Webhook). |
| `ERROR` | ❌ Erro | Falha na entrega (detalhe salvo no atributo `error`). |
| `INVALID` | ⚠️ Inválido | Formato telefônico fora do padrão E.164 brasileiro. |
| `UNAUTHORIZED` | 🚫 Sem Consentimento | Cliente recusou comunicações de marketing. |
| `DUPLICATE` | 🔁 Duplicado | Destinatário repetido dentro da mesma campanha. |

---

## 9. Estrutura de Dados no Firebase Realtime Database

```json
{
  "campaigns": {
    "camp_1725920000000": {
      "id": "camp_1725920000000",
      "title": "Quarta da Pizza",
      "description": "Promoção semanal de pizzas artesanais",
      "template": "Olá, {nome}! 🍕 Hoje tem promoção na Fina Massa: {link}",
      "segment": "authorized_all",
      "status": "CONCLUIDA",
      "createdAt": 1725920000000,
      "updatedAt": 1725920300000,
      "startedAt": 1725920050000,
      "finishedAt": 1725920280000,
      "statistics": {
        "total": 25,
        "sent": 23,
        "delivered": 0,
        "read": 0,
        "errors": 2
      },
      "recipients": [
        {
          "id": "54999201102",
          "name": "Elias",
          "phone": "54999201102",
          "marketingWhatsApp": true,
          "status": "SENT",
          "messageId": "wamid.HBgLNTQ5OTkyMDExMDIVAgASGBQ...",
          "sentAt": 1725920052000,
          "error": null
        }
      ]
    }
  },
  "settings": {
    "whatsappCampaigns": {
      "enabled": true,
      "commercialPhone": "5554996985724",
      "phoneNumberId": "100609349423711",
      "wabaId": "105954558914442",
      "apiVersion": "v21.0",
      "dispatchDelayMs": 600,
      "menuUrl": "https://pizzariafinamassa.com.br/"
    }
  }
}
```

---

## 10. Regras de Segurança no Firebase (`database.rules.json`)

As regras garantem que o nó `campaigns` e `settings` possuam índices adequados para ordenação cronológica e por status, mantendo compatibilidade total com o sistema da pizzaria:

```json
{
  "rules": {
    "campaigns": {
      ".read": true,
      ".write": true,
      ".indexOn": ["createdAt", "status", "targetAudience"]
    },
    "settings": {
      ".read": true,
      ".write": true
    }
  }
}
```

---

## 11. Plano de Contingência (Fallback 1 a 1 via wa.me)

Se a conexão com a Meta for interrompida ou enquanto as credenciais oficiais estiverem pendentes:
1. A interface avisa o operador no cabeçalho do disparador.
2. O botão `Ativar Modo Manual 1 a 1` alterna a tabela para exibir o botão direto `wa.me`.
3. Ao clicar, o link abre a conversa oficial com a mensagem pré-preenchida para o cliente e registra o status como `OPENED_WA` no Firebase.

---

## 12. Conclusão da Fase 5.1

- **Arquitetura modular completa**: `painel/whatsapp-service.js`.
- **Interface e Modais atualizados**: `painel/painel.html`, `painel/index.html` e `painel/painel.css`.
- **Fluxo com botão principal `🚀 ENVIAR CAMPANHA`**: Confirmação, processamento automático, barra de progresso, pausa, cancelamento e relatório final.
- **Regressão Zero**: Cardápio, checkout, pedidos, pizzas fracionadas, garçom e CRM intactos.
