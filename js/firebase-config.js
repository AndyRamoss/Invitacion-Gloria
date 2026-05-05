// firebase-config.js - Configuración para la página principal

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyA2uASDdwH2vKmRtwLDvjvTSMOFImhDUFM",
    authDomain: "encuesta-649b8.firebaseapp.com",
    projectId: "encuesta-649b8",
    storageBucket: "encuesta-649b8.firebasestorage.app",
    messagingSenderId: "226296434450",
    appId: "1:226296434450:web:470fb309d3b73a630a2dcb",
    measurementId: "G-8YTM0C38ST"
};

// Inicializar Firebase cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    console.log("🎬 Inicializando Firebase para invitaciones...");
    
    try {
        // Verificar que Firebase esté cargado
        if (typeof firebase === 'undefined') {
            console.error("Firebase SDK no está cargado");
            return;
        }
        
        // Inicializar Firebase solo si no está ya inicializado
        if (firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
            console.log("✅ Firebase inicializado para invitaciones");
        } else {
            console.log("✅ Firebase ya estaba inicializado");
        }
        
    } catch (error) {
        console.error("❌ Error inicializando Firebase:", error);
    }
});

console.log("✅ Configuración de Firebase cargada");