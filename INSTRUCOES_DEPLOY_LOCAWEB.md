# 🚀 Guia de Publicação na Locaweb — Fina Massa Pizzaria

Este pacote contém todos os arquivos e configurações necessárias para rodar o sistema **Fina Massa Pizzaria** na hospedagem da **Locaweb** com máxima performance, segurança e compatibilidade com PWA.

---

## 📁 Estrutura de Pastas do Pacote

Ao extrair na pasta `public_html`, a estrutura fica assim:

```text
public_html/
├── .htaccess                 # Configuração Apache: HTTPS, MIME Types, GZIP e Cache PWA
├── index.html                # Cardápio Digital e Delivery (Página Principal)
├── index.css                 # Estilos do cardápio
├── app.js                    # Lógica do cardápio e checkout
├── firebase-config.js        # Configuração do Firebase
├── TrackingService.js        # Serviço de rastreamento de entregadores
├── manifest.json             # Manifesto PWA
├── sw.js                     # Service Worker PWA (Offline / Cache)
├── assets/                   # Fotos de produtos, logotipo e banners
├── pwa/                      # Módulos de inicialização do PWA e ícones
├── painel/                   # Painel Administrativo completo (/painel)
├── garcom/                   # Módulo do Garçom para mesas e comandas (/garcom)
├── dados/                    # Backups JSON e regras de segurança do Firebase
└── LEIA-ME_LOCAWEB.txt       # Guia rápido de instruções
```

---

## 🛠️ Passo a Passo para Subir na Locaweb

### Opção 1: Pelo Gerenciador de Arquivos da Locaweb (Mais Rápido)

1. Acesse o **Painel de Hospedagem da Locaweb** ([paineldehospedagem.locaweb.com.br](https://paineldehospedagem.locaweb.com.br)).
2. Vá em **Hospedagem de Sites** ➔ clique em **Gerenciador de Arquivos** (ou cPanel).
3. Entre na pasta **`public_html`** (a pasta raiz onde o site deve ficar).
4. Se houver um arquivo `index.html` padrão antigo da Locaweb ("Página em Construção"), você pode removê-lo.
5. Clique no botão **Enviar Arquivo (Upload)** no menu superior e envie o arquivo **`Fina_Massa_Deploy_Locaweb.zip`**.
6. Após a conclusão do upload, clique com o botão direito no arquivo `.zip` e selecione **Extrair / Descompactar (Extract)** diretamente em `public_html`.
7. Pronto! Você já pode deletar o arquivo `.zip` para economizar espaço em disco.

---

### Opção 2: Via FTP (FileZilla / WinSCP)

1. Conecte ao seu servidor Locaweb usando seus dados de FTP (Host, Usuário e Senha).
2. Abra a pasta remota **`public_html`**.
3. No seu computador, extraia o arquivo **`Fina_Massa_Deploy_Locaweb.zip`**.
4. Selecione todos os arquivos e pastas extraídos e arraste para dentro de **`public_html`**.
5. Aguarde a transferência de todos os arquivos.

---

## 🔒 Certificado SSL / HTTPS na Locaweb

Para que o PWA (instalação no celular) e o Firebase funcionem com segurança:
1. No painel da Locaweb, certifique-se de que o **SSL Grátis (Let's Encrypt)** está ativado para o seu domínio.
2. O arquivo `.htaccess` incluído já redirecionará automaticamente todas as visitas de `http://` para `https://`.

---

## 🌐 URLs de Acesso Após a Publicação

- **Cardápio Digital & Delivery (Clientes):**  
  `https://seudominio.com.br/`

- **Painel Administrativo (Gestão / Cozinha / Caixa):**  
  `https://seudominio.com.br/painel`

- **Módulo Garçom (Atendimento de Mesas):**  
  `https://seudominio.com.br/garcom`

---

## 💾 Banco de Dados & Firebase

- O sistema já vem conectado ao Firebase da Fina Massa Pizzaria.
- Caso deseje restaurar ou atualizar o cardápio padrão, acesse o **Painel Administrativo → Configurações → Backup & Exportação** e faça a importação do arquivo `dados/menu.json`.
