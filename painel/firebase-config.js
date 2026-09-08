/* ==========================================================================
   CONFIGURAÇÃO CENTRALIZADA DO FIREBASE — FINA MASSA
   ==========================================================================
   Projeto Oficial: fina-massa-952b1
   Esta é a única fonte oficial de configuração do Firebase para todo o sistema
   (Cardápio Digital, Painel Administrativo e Módulo Garçom).
   ========================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyCM3yoSUmbdIK2tH26yaaCqmIW6q1xzUZc",
  authDomain: "fina-massa-952b1.firebaseapp.com",
  databaseURL: "https://fina-massa-952b1-default-rtdb.firebaseio.com",
  projectId: "fina-massa-952b1",
  storageBucket: "fina-massa-952b1.firebasestorage.app",
  messagingSenderId: "736849200222",
  appId: "1:736849200222:web:9394be03f39adcc768a0cf"
};

/**
 * Validação para garantir que o sistema não tente inicializar com credenciais pendentes/placeholder
 */
function isFirebaseConfigured() {
    return typeof firebaseConfig !== 'undefined' &&
           firebaseConfig.apiKey &&
           !firebaseConfig.apiKey.includes('INSERIR_') &&
           !firebaseConfig.apiKey.includes('SUA_') &&
           firebaseConfig.projectId === 'fina-massa-952b1';
}

// Inicialização segura e centralizada do Firebase para Fina Massa
if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length === 0) {
    if (isFirebaseConfigured()) {
        try {
            firebase.initializeApp(firebaseConfig);
            console.log('[Firebase Fina Massa] Conectado com sucesso ao projeto:', firebaseConfig.projectId);
        } catch (e) {
            console.error('[Firebase Fina Massa] Erro ao inicializar:', e);
        }
    } else {
        console.info('[Firebase Fina Massa] Credenciais oficiais pendentes em firebase-config.js.');
    }
}
