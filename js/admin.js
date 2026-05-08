// admin.js - Panel de Control para Hollywood Nights (Versión con Admin desde Firebase)

// ===== CONFIGURACIÓN DE FIREBASE =====
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyA2uASDdwH2vKmRtwLDvjvTSMOFImhDUFM",
    authDomain: "encuesta-649b8.firebaseapp.com",
    projectId: "encuesta-649b8",
    storageBucket: "encuesta-649b8.firebasestorage.app",
    messagingSenderId: "226296434450",
    appId: "1:226296434450:web:470fb309d3b73a630a2dcb",
    measurementId: "G-8YTM0C38ST"
};

// Variables globales
let currentUser = null;
let currentTab = 'dashboard';
let currentPage = 1;
let searchQuery = '';
let allGuests = [];
let guestStats = null;
let firebaseApp = null;
let firebaseDb = null;
let firebaseAuth = null;
let firebaseStorage = null;

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
    console.log("✅ Admin Panel inicializando...");
    console.log("URL:", window.location.href);
    console.log("Hostname:", window.location.hostname);
    
    // Inicializar Firebase primero
    initializeFirebase();
    
    // Inicializar componentes
    initAuth();
    initTabs();
    initForms();
    initModals();
    initMobileMenu();
    
    // Verificar autenticación inicial después de un breve delay
    setTimeout(() => {
        checkAuthState();
    }, 1500);
    
    // Verificar Firebase cargado
    checkFirebaseLoaded();
});

// ===== INICIALIZAR FIREBASE =====
function initializeFirebase() {
    try {
        console.log("🔄 Inicializando Firebase...");
        
        // Verificar que Firebase SDK esté cargado
        if (typeof firebase === 'undefined') {
            console.error("❌ Firebase SDK no está cargado");
            showToast("Firebase SDK no está cargado. Recarga la página.", "error");
            return false;
        }
        
        // Verificar que Firebase ya no esté inicializado
        if (firebase.apps.length > 0) {
            console.log("✅ Firebase ya está inicializado");
            firebaseApp = firebase.app();
            firebaseDb = firebase.firestore();
            firebaseAuth = firebase.auth();
            firebaseStorage = firebase.storage ? firebase.storage() : null;
            return true;
        }
        
        // Inicializar Firebase
        const app = firebase.initializeApp(FIREBASE_CONFIG);
        firebaseDb = firebase.firestore();
        firebaseAuth = firebase.auth();
        firebaseStorage = firebase.storage ? firebase.storage() : null;
        firebaseApp = app;
        
        console.log("✅ Firebase inicializado exitosamente");
        
        // Configurar persistencia (opcional, mejora la experiencia offline)
        try {
            firebaseDb.enablePersistence()
                .then(() => console.log("Persistencia de Firestore habilitada"))
                .catch(err => console.warn("Persistencia no soportada:", err));
        } catch (e) {
            console.warn("No se pudo habilitar persistencia:", e);
        }
        
        return true;
        
    } catch (error) {
        console.error("❌ Error inicializando Firebase:", error);
        showToast("Error inicializando Firebase: " + error.message, "error");
        return false;
    }
}

function checkFirebaseLoaded() {
    console.log("🔍 Verificando Firebase...");
    console.log("Firebase disponible:", typeof firebase !== 'undefined');
    console.log("Firebase App:", firebaseApp);
    console.log("Firebase DB:", firebaseDb);
    console.log("Firebase Auth:", firebaseAuth);
    console.log("Firebase Storage:", firebaseStorage);
}

// ===== AUTENTICACIÓN =====
function initAuth() {
    console.log("🔐 Inicializando autenticación...");
    
    // Botón de login con Google
    const loginBtn = document.getElementById('btn-login-google');
    if (loginBtn) {
        loginBtn.addEventListener('click', handleGoogleLogin);
        console.log("✅ Event listener agregado al botón de login");
        loginBtn.innerHTML = '<i class="fab fa-google"></i> Iniciar sesión con Google';
    } else {
        console.error("❌ No se encontró el botón de login con ID 'btn-login-google'");
    }
    
    // Botón de logout
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
        console.log("✅ Event listener agregado al botón de logout");
    }
    
    console.log("✅ Autenticación inicializada correctamente");
}

async function handleGoogleLogin() {
    try {
        console.log("🔄 Intentando login con Google...");
        showLoading();
        
        // Actualizar estado del botón
        const loginBtn = document.getElementById('btn-login-google');
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';
            loginBtn.disabled = true;
        }
        
        // Verificar que Firebase esté inicializado
        if (!firebaseAuth) {
            if (!initializeFirebase()) {
                throw new Error('No se pudo inicializar Firebase');
            }
        }
        
        // Crear proveedor de Google
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('profile');
        provider.addScope('email');
        provider.setCustomParameters({ prompt: 'select_account' });
        
        // Iniciar sesión con popup
        console.log("Iniciando popup de autenticación...");
        const result = await firebaseAuth.signInWithPopup(provider);
        
        if (result.user) {
            // Verificar si es administrador
            const isAdmin = await checkAdminAccess(result.user.email);
            
            if (isAdmin) {
                currentUser = result.user;
                console.log("✅ Login exitoso como administrador:", currentUser.email);
                handleAuthSuccess();
            } else {
                await firebaseAuth.signOut();
                throw new Error('No tienes permisos de administrador. Contacta al organizador.');
            }
        }
        
    } catch (error) {
        console.error("❌ Error en login:", error);
        
        // Mostrar mensaje de error detallado
        let errorMessage = error.message || 'Error al iniciar sesión';
        
        if (error.code === 'auth/popup-blocked') {
            errorMessage = 'El navegador bloqueó la ventana emergente. Por favor, permite ventanas emergentes para este sitio.';
        } else if (error.code === 'auth/popup-closed-by-user') {
            errorMessage = 'La ventana de inicio de sesión se cerró. Intenta de nuevo.';
        } else if (error.code === 'auth/unauthorized-domain') {
            errorMessage = `Este dominio (${window.location.hostname}) no está autorizado. Contacta al administrador.`;
        } else if (error.code === 'auth/operation-not-supported-in-this-environment') {
            errorMessage = 'Tu navegador no soporta esta forma de inicio de sesión. Intenta con Chrome o Firefox.';
        }
        
        showToast(errorMessage, 'error');
        
    } finally {
        hideLoading();
        
        // Restaurar estado del botón
        const loginBtn = document.getElementById('btn-login-google');
        if (loginBtn) {
            loginBtn.innerHTML = '<i class="fab fa-google"></i> Iniciar sesión con Google';
            loginBtn.disabled = false;
        }
    }
}

// Función auxiliar para verificar acceso de administrador DESDE FIREBASE
async function checkAdminAccess(email) {
    try {
        if (!email) {
            console.log("❌ No se proporcionó email");
            return false;
        }
        
        const emailLower = email.toLowerCase();
        console.log("🔍 Verificando acceso para:", emailLower);
        
        // 1. PRIMERO: Verificar en Firebase Firestore
        if (firebaseDb) {
            try {
                console.log("Buscando en colección 'admins'...");
                const adminDoc = await firebaseDb.collection('admins').doc(emailLower).get();
                
                if (adminDoc.exists) {
                    console.log("✅ Administrador encontrado en Firestore");
                    return true;
                } else {
                    console.log("❌ No encontrado en colección 'admins'");
                }
            } catch (firestoreError) {
                console.warn("⚠️ Error accediendo a Firestore:", firestoreError);
                // Continuar con el método alternativo
            }
        } else {
            console.warn("⚠️ Firebase DB no disponible");
        }
        
        // 2. SEGUNDO: Verificar en colección 'administrators' (alternativa)
        if (firebaseDb) {
            try {
                console.log("Buscando en colección 'administrators'...");
                const adminQuery = await firebaseDb.collection('administrators')
                    .where('email', '==', emailLower)
                    .limit(1)
                    .get();
                
                if (!adminQuery.empty) {
                    console.log("✅ Administrador encontrado en colección 'administrators'");
                    return true;
                }
            } catch (error) {
                console.warn("⚠️ Error buscando en 'administrators':", error);
            }
        }
        
        // 3. TERCERO: Administradores predeterminados (fallback de emergencia)
        const defaultAdmins = [
            'andy.ramosmanzanilla@gmail.com',  // ← TU EMAIL
            'andyramoss@gmail.com',
            'admin@encuesta-649b8.firebaseapp.com'
        ];
        
        const isDefaultAdmin = defaultAdmins.includes(emailLower);
        console.log("¿Es administrador predeterminado?:", isDefaultAdmin);
        
        return isDefaultAdmin;
        
    } catch (error) {
        console.error("❌ Error verificando acceso de administrador:", error);
        return false;
    }
}

async function handleLogout() {
    try {
        showLoading();
        
        if (firebaseAuth) {
            await firebaseAuth.signOut();
            console.log("✅ Logout exitoso");
            handleAuthSignedOut();
        }
        
    } catch (error) {
        console.error("❌ Error en logout:", error);
        showToast('Error al cerrar sesión', 'error');
    } finally {
        hideLoading();
    }
}

function handleAuthSuccess() {
    console.log("✅ Autenticación exitosa para:", currentUser.email);
    
    // Mostrar dashboard
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('admin-dashboard').style.display = 'block';
    
    // Actualizar info del usuario
    updateUserInfo(currentUser);
    
    // Cargar datos iniciales
    loadDashboardData();
    
    showToast(`Bienvenido ${currentUser.email}`, 'success');
}

function handleAuthSignedOut() {
    currentUser = null;
    
    console.log("🔓 Usuario cerró sesión");
    
    // Mostrar login screen
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('admin-dashboard').style.display = 'none';
    
    // Limpiar datos
    clearDashboardData();
    
    showToast('Sesión cerrada exitosamente', 'info');
}

function checkAuthState() {
    console.log("🔍 Verificando estado de autenticación...");
    
    if (!firebaseAuth) {
        console.log("Firebase Auth no está disponible todavía");
        return;
    }
    
    // Escuchar cambios en el estado de autenticación
    firebaseAuth.onAuthStateChanged(async (user) => {
        if (user) {
            console.log("✅ Usuario encontrado en sesión:", user.email);
            
            // Verificar si es administrador
            const isAdmin = await checkAdminAccess(user.email);
            
            if (isAdmin) {
                currentUser = user;
                handleAuthSuccess();
            } else {
                console.log("❌ Usuario no es administrador");
                await firebaseAuth.signOut();
                showToast('No tienes permisos de administrador', 'error');
            }
        } else {
            // No hay usuario, mostrar login
            console.log("ℹ️ No hay usuario autenticado");
            document.getElementById('login-screen').style.display = 'flex';
            document.getElementById('admin-dashboard').style.display = 'none';
        }
    });
}

function updateUserInfo(user) {
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const userAvatar = document.getElementById('user-avatar');
    
    if (userName) userName.textContent = user.displayName || user.email.split('@')[0];
    if (userEmail) userEmail.textContent = user.email;
    
    if (userAvatar) {
        if (user.displayName) {
            userAvatar.textContent = user.displayName.charAt(0).toUpperCase();
        } else {
            userAvatar.textContent = user.email.charAt(0).toUpperCase();
        }
    }
}

// ===== TABS Y NAVEGACIÓN =====
function initTabs() {
    console.log("📑 Inicializando pestañas...");
    
    // Tabs del header
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const tabId = tab.getAttribute('data-tab');
            console.log("Cambiando a pestaña:", tabId);
            switchTab(tabId);
        });
    });
    
    // Botón para crear nueva invitación desde la lista
    const newInvitationBtn = document.getElementById('btn-new-invitation');
    if (newInvitationBtn) {
        newInvitationBtn.addEventListener('click', () => {
            switchTab('new-guest');
            resetNewGuestForm();
        });
    }
    
    // Botón para ver en lista
    const viewGuestBtn = document.getElementById('btn-view-guest');
    if (viewGuestBtn) {
        viewGuestBtn.addEventListener('click', () => {
            switchTab('guests');
            loadGuests();
        });
    }
    
    console.log("✅ Pestañas inicializadas correctamente");
}

function switchTab(tabId) {
    // Actualizar tabs activos
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
        }
    });
    
    // Ocultar todas las secciones
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar sección seleccionada
    const targetSection = document.getElementById(`${tabId}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        currentTab = tabId;
        
        // Cargar datos según la pestaña
        switch(tabId) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'guests':
                loadGuests();
                break;
            case 'new-guest':
                resetNewGuestForm();
                break;
            case 'settings':
                loadSettings();
                break;
        }
    }
    
    // Cerrar menú móvil si está abierto
    const mobileNav = document.getElementById('mobile-nav');
    if (mobileNav && mobileNav.classList.contains('active')) {
        mobileNav.classList.remove('active');
    }
}

// ===== DASHBOARD =====
async function loadDashboardData() {
    try {
        showLoading();
        
        console.log("📊 Cargando datos del dashboard...");
        
        // Cargar estadísticas
        const stats = await getEventStats();
        updateStatsUI(stats);
        console.log("✅ Estadísticas cargadas:", stats);
        
        // Cargar actividad reciente
        await loadRecentActivity();
        
    } catch (error) {
        console.error("❌ Error cargando dashboard:", error);
        showToast('Error al cargar estadísticas', 'error');
    } finally {
        hideLoading();
    }
}

async function getEventStats() {
    try {
        if (!firebaseDb) {
            throw new Error('Firebase Firestore no disponible');
        }
        
        const guestsSnapshot = await firebaseDb.collection('guests').get();
        
        let stats = {
            total: 0,
            confirmed: 0,
            pending: 0,
            declined: 0,
            confirmedTotal: 0,
            totalCupos: 0,
            totalConfirmados: 0
        };
        
        guestsSnapshot.forEach(doc => {
            const data = doc.data();
            stats.total++;
            stats.totalCupos += data.maxGuests || 0;
            
            if (data.status === 'confirmed') {
                stats.confirmed++;
                stats.confirmedTotal += data.confirmedGuests || 1;
                stats.totalConfirmados += data.confirmedGuests || 0;
            } else if (data.status === 'declined') {
                stats.declined++;
            } else {
                stats.pending++;
            }
        });
        
        stats.confirmationRate = stats.total > 0 ? 
            Math.round((stats.confirmed / stats.total) * 100) : 0;
            
        return stats;
        
    } catch (error) {
        console.error("Error obteniendo estadísticas:", error);
        throw error;
    }
}

function updateStatsUI(stats) {
    console.log("Actualizando UI de estadísticas:", stats);
    
    // Actualizar tarjetas de estadísticas
    const statElements = {
        'total': document.getElementById('stat-total-guests'),
        'confirmed': document.getElementById('stat-confirmed-guests'),
        'pending': document.getElementById('stat-pending-guests'),
        'declined': document.getElementById('stat-declined-guests'),
        'confirmedTotal': document.getElementById('stat-confirmed-total'),
        'confirmationRate': document.getElementById('stat-confirmation-rate')
    };
    
    if (statElements.total) statElements.total.textContent = stats.total || 0;
    if (statElements.confirmed) statElements.confirmed.textContent = stats.confirmed || 0;
    if (statElements.pending) statElements.pending.textContent = stats.pending || 0;
    if (statElements.declined) statElements.declined.textContent = stats.declined || 0;
    if (statElements.confirmedTotal) statElements.confirmedTotal.textContent = `${stats.confirmedTotal || 0} personas`;
    if (statElements.confirmationRate) statElements.confirmationRate.textContent = `${stats.confirmationRate || 0}%`;
}

async function loadRecentActivity() {
    try {
        const activityList = document.getElementById('activity-list');
        if (!activityList) return;
        
        activityList.innerHTML = '<div class="no-data"><i class="fas fa-clock"></i><p>Cargando actividad...</p></div>';
        
        if (!firebaseDb) {
            activityList.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-triangle"></i><p>Base de datos no disponible</p></div>';
            return;
        }
        
        const snapshot = await firebaseDb.collection('logs')
            .orderBy('timestamp', 'desc')
            .limit(10)
            .get();
        
        if (snapshot.empty) {
            activityList.innerHTML = '<div class="no-data"><i class="fas fa-history"></i><p>No hay actividad reciente</p></div>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div class="table-row">
                    <div>${formatActivityDate(data.timestamp)}</div>
                    <div>${data.target || 'Sistema'}</div>
                    <div><span class="guest-status status-${getStatusClass(data.action)}">${formatAction(data.action)}</span></div>
                    <div>${formatActivityDetails(data.details)}</div>
                </div>
            `;
        });
        
        activityList.innerHTML = html;
        
    } catch (error) {
        console.error("❌ Error cargando actividad:", error);
        document.getElementById('activity-list').innerHTML = 
            '<div class="no-data"><i class="fas fa-exclamation-triangle"></i><p>Error al cargar actividad</p></div>';
    }
}

function formatActivityDate(timestamp) {
    if (!timestamp) return '--';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('es-MX', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return '--';
    }
}

function formatAction(action) {
    const actions = {
        'guest_created': 'Invitación creada',
        'guest_updated': 'Invitación actualizada',
        'guest_deleted': 'Invitación eliminada',
        'rsvp_updated': 'RSVP actualizado',
        'bulk_import': 'Importación masiva',
        'login': 'Inicio de sesión',
        'admin_added': 'Admin agregado',
        'admin_removed': 'Admin removido'
    };
    
    return actions[action] || action;
}

function getStatusClass(action) {
    const statusMap = {
        'guest_created': 'confirmed',
        'guest_updated': 'pending',
        'guest_deleted': 'declined',
        'rsvp_updated': 'confirmed',
        'bulk_import': 'pending',
        'login': 'confirmed',
        'admin_added': 'confirmed',
        'admin_removed': 'declined'
    };
    
    return statusMap[action] || 'pending';
}

function formatActivityDetails(details) {
    if (!details) return '--';
    
    if (typeof details === 'string') {
        return details;
    }
    
    if (details.name) {
        return `Nombre: ${details.name}`;
    }
    
    if (details.email) {
        return `Email: ${details.email}`;
    }
    
    if (details.total) {
        return `${details.successful || 0} de ${details.total} exitosos`;
    }
    
    return JSON.stringify(details);
}

// ===== GESTIÓN DE INVITADOS =====
async function loadGuests() {
    try {
        showLoading();
        
        console.log("👥 Cargando lista de invitados...");
        
        if (!firebaseDb) {
            throw new Error('Firebase no configurado');
        }
        
        const result = await getAllGuests(currentPage, 20, searchQuery);
        allGuests = result.guests;
        
        console.log(`✅ ${allGuests.length} invitados cargados`);
        
        updateGuestsTable(allGuests);
        updatePagination(result.pagination);
        
    } catch (error) {
        console.error("❌ Error cargando invitados:", error);
        showToast('Error al cargar invitados', 'error');
        
        const guestsList = document.getElementById('guests-list');
        if (guestsList) {
            guestsList.innerHTML = `
                <div class="no-data">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error al cargar invitados</p>
                    <p style="font-size: 0.8rem;">${error.message}</p>
                </div>
            `;
        }
    } finally {
        hideLoading();
    }
}

async function getAllGuests(page = 1, limit = 20, search = '') {
    try {
        if (!firebaseDb) throw new Error('Firebase no disponible');
        
        let query = firebaseDb.collection('guests');
        
        // Si hay búsqueda, intentar diferentes métodos
        if (search) {
            // Primero intentar búsqueda por código exacto
            const exactDoc = await query.doc(search).get();
            if (exactDoc.exists) {
                return {
                    guests: [{
                        id: exactDoc.id,
                        ...exactDoc.data()
                    }],
                    pagination: {
                        page: 1,
                        limit: 1,
                        total: 1,
                        totalPages: 1,
                        hasNext: false,
                        hasPrev: false
                    }
                };
            }
            
            // Si no es código exacto, buscar por nombre o email
            // Firestore no soporta OR queries fácilmente, hacemos consultas separadas
            const nameQuery = await query
                .where('name', '>=', search)
                .where('name', '<=', search + '\uf8ff')
                .get();
            
            const emailQuery = await query
                .where('email', '>=', search)
                .where('email', '<=', search + '\uf8ff')
                .get();
            
            // Combinar resultados únicos
            const guestsMap = new Map();
            
            nameQuery.forEach(doc => {
                guestsMap.set(doc.id, {
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            emailQuery.forEach(doc => {
                guestsMap.set(doc.id, {
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            const guests = Array.from(guestsMap.values());
            
            // Paginación manual para resultados combinados
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedGuests = guests.slice(startIndex, endIndex);
            
            return {
                guests: paginatedGuests,
                pagination: {
                    page,
                    limit,
                    total: guests.length,
                    totalPages: Math.ceil(guests.length / limit),
                    hasNext: endIndex < guests.length,
                    hasPrev: page > 1
                }
            };
        }
        
        // Sin búsqueda: obtener con paginación normal
        const snapshot = await query
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        
        const guests = [];
        snapshot.forEach(doc => {
            guests.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // Para obtener el total necesitamos una consulta separada
        const totalSnapshot = await query.get();
        const total = totalSnapshot.size;
        const totalPages = Math.ceil(total / limit);
        
        return {
            guests,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        };
        
    } catch (error) {
        console.error("Error obteniendo invitados:", error);
        
        // Fallback: obtener todos y filtrar localmente
        if (error.code === 'failed-precondition') {
            console.log("Usando fallback para obtener invitados...");
            const snapshot = await firebaseDb.collection('guests').get();
            const allGuests = [];
            
            snapshot.forEach(doc => {
                allGuests.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
            // Filtrar por búsqueda si existe
            let filteredGuests = allGuests;
            if (search) {
                const searchLower = search.toLowerCase();
                filteredGuests = allGuests.filter(guest => 
                    guest.id.toLowerCase().includes(searchLower) ||
                    (guest.name && guest.name.toLowerCase().includes(searchLower)) ||
                    (guest.email && guest.email.toLowerCase().includes(searchLower))
                );
            }
            
            // Ordenar por fecha de creación
            filteredGuests.sort((a, b) => {
                const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt)) : new Date(0);
                const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt)) : new Date(0);
                return dateB - dateA;
            });
            
            // Aplicar paginación
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedGuests = filteredGuests.slice(startIndex, endIndex);
            
            return {
                guests: paginatedGuests,
                pagination: {
                    page,
                    limit,
                    total: filteredGuests.length,
                    totalPages: Math.ceil(filteredGuests.length / limit),
                    hasNext: endIndex < filteredGuests.length,
                    hasPrev: page > 1
                }
            };
        }
        
        throw error;
    }
}

function updateGuestsTable(guests) {
    const guestsList = document.getElementById('guests-list');
    if (!guestsList) return;
    
    if (!guests || guests.length === 0) {
        guestsList.innerHTML = `
            <div class="no-data">
                <i class="fas fa-users-slash"></i>
                <p>No hay invitados registrados</p>
                <p style="font-size: 0.8rem;">Crea tu primera invitación en "Nuevo Invitado"</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    guests.forEach(guest => {
        const statusClass = guest.status || 'pending';
        const statusText = getStatusText(guest.status);
        const maxGuests = guest.maxGuests || 2;
        const confirmed = guest.confirmedGuests || 0;
        
        html += `
            <div class="table-row" data-id="${guest.id}">
                <div>
                    <span class="guest-code">${guest.id}</span>
                </div>
                <div>${guest.name || '--'}</div>
                <div>${guest.email || '--'}</div>
                <div>
                    <span class="guest-status status-${statusClass}">${statusText}</span>
                </div>
                <div>${confirmed}/${maxGuests}</div>
                <div class="guest-actions">
                    <button class="btn-action-icon btn-copy" data-id="${guest.id}" title="Copiar enlace">
                        <i class="fas fa-link"></i>
                    </button>
                    <button class="btn-action-icon btn-edit" data-id="${guest.id}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action-icon btn-delete" data-id="${guest.id}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    guestsList.innerHTML = html;
    
    // Agregar event listeners a los botones
    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', () => copyInvitationLink(btn.getAttribute('data-id')));
    });
    
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editGuest(btn.getAttribute('data-id')));
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteGuestConfirmation(btn.getAttribute('data-id')));
    });
}

function getStatusText(status) {
    const statusMap = {
        'pending': 'Pendiente',
        'confirmed': 'Confirmado',
        'declined': 'No asistirá'
    };
    
    return statusMap[status] || 'Pendiente';
}

function updatePagination(pagination) {
    const pageNumbers = document.getElementById('page-numbers');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    
    if (!pageNumbers || !btnPrev || !btnNext) return;
    
    // Actualizar botones
    btnPrev.disabled = !pagination.hasPrev;
    btnNext.disabled = !pagination.hasNext;
    
    // Event listeners
    btnPrev.onclick = () => {
        if (pagination.hasPrev) {
            currentPage--;
            loadGuests();
        }
    };
    
    btnNext.onclick = () => {
        if (pagination.hasNext) {
            currentPage++;
            loadGuests();
        }
    };
    
    // Generar números de página
    let pagesHtml = '';
    const totalPages = pagination.totalPages || 1;
    
    for (let i = 1; i <= totalPages; i++) {
        if (i === currentPage) {
            pagesHtml += `<button class="page-btn active">${i}</button>`;
        } else if (i === 1 || i === totalPages || 
                  (i >= currentPage - 1 && i <= currentPage + 1)) {
            pagesHtml += `<button class="page-btn" data-page="${i}">${i}</button>`;
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            pagesHtml += `<span class="page-dots">...</span>`;
        }
    }
    
    pageNumbers.innerHTML = pagesHtml;
    
    // Event listeners para números de página
    pageNumbers.querySelectorAll('.page-btn:not(.active)').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPage = parseInt(btn.getAttribute('data-page'));
            loadGuests();
        });
    });
}

// ===== FORMULARIOS =====
function initForms() {
    console.log("📝 Inicializando formularios...");
    
    // Formulario de nuevo invitado
    const newGuestForm = document.getElementById('new-guest-form');
    if (newGuestForm) {
        newGuestForm.addEventListener('submit', handleNewGuestSubmit);
        console.log("✅ Formulario nuevo invitado inicializado");
    }
    
    // Búsqueda de invitados
    const searchInput = document.getElementById('search-guests');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            searchQuery = searchInput.value.trim();
            currentPage = 1;
            console.log("Buscando:", searchQuery);
            loadGuests();
        }, 500));
        console.log("✅ Búsqueda inicializada");
    }
    
    // Exportar CSV
    const exportBtn = document.getElementById('btn-export');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportCSV);
        console.log("✅ Botón exportar inicializado");
    }
    
    // Importar masivo
    const importBtn = document.getElementById('btn-import');
    if (importBtn) {
        importBtn.addEventListener('click', handleBulkImport);
        console.log("✅ Botón importar inicializado");
    }
    
    // Botón para cancelar importación
    const cancelImportBtn = document.getElementById('btn-cancel-import');
    const confirmImportBtn = document.getElementById('btn-confirm-import');
    
    if (cancelImportBtn) {
        cancelImportBtn.addEventListener('click', () => {
            document.getElementById('bulk-import-section').style.display = 'none';
        });
    }
    
    if (confirmImportBtn) {
        confirmImportBtn.addEventListener('click', handleBulkImportConfirm);
    }
    
    console.log("✅ Formularios inicializados correctamente");
}

async function handleNewGuestSubmit(e) {
    e.preventDefault();
    
    try {
        showLoading();
        
        const name = document.getElementById('guest-name').value.trim();
        const email = document.getElementById('guest-email').value.trim();
        const maxGuests = parseInt(document.getElementById('guest-max-guests').value, 10);
        const customCode = document.getElementById('guest-custom-code').value.trim().toUpperCase();
        
        if (!maxGuests) {
            throw new Error('Selecciona el número de cupos');
        }
        
        console.log("Creando invitación:", { name, email, maxGuests, customCode });
        
        const result = await createGuestInvitation(name, email, maxGuests, customCode);
        
        showToast('Invitación creada exitosamente', 'success');
        
        // Mostrar enlace generado
        showCreatedInvitation(result.invitationCode, result.link);
        
        // Resetear formulario
        resetNewGuestForm();
        
        // Actualizar dashboard
        loadDashboardData();
        
    } catch (error) {
        console.error("❌ Error creando invitación:", error);
        showToast(error.message || 'Error al crear invitación', 'error');
    } finally {
        hideLoading();
    }
}

function generateInvitationCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

async function createGuestInvitation(name = '', email = '', maxGuests = 2, customCode = '') {
    try {
        if (!firebaseDb) throw new Error('Firebase no disponible');
        
        // Validar número de invitados (flexible)
        if (!Number.isFinite(maxGuests) || maxGuests < 1 || maxGuests > 50) {
            throw new Error('Número de invitados no válido (1 a 50)');
        }
        
        // Generar o usar código personalizado
        let invitationCode = customCode || generateInvitationCode();
        
        if (customCode) {
            // Validar formato del código personalizado
            if (!/^[A-Z0-9]{6}$/.test(customCode)) {
                throw new Error('El código debe tener exactamente 6 caracteres (A-Z, 0-9)');
            }
            
            // Verificar que no exista
            const existingDoc = await firebaseDb.collection('guests').doc(customCode).get();
            if (existingDoc.exists) {
                throw new Error('El código ya está en uso');
            }
        } else {
            // Asegurar que el código generado sea único
            let isUnique = false;
            let attempts = 0;
            
            while (!isUnique && attempts < 5) {
                const existingDoc = await firebaseDb.collection('guests').doc(invitationCode).get();
                if (!existingDoc.exists) {
                    isUnique = true;
                } else {
                    invitationCode = generateInvitationCode();
                    attempts++;
                }
            }
            
            if (!isUnique) {
                throw new Error('No se pudo generar un código único');
            }
        }
        
        // Crear documento
        const guestData = {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            maxGuests: maxGuests,
            confirmedGuests: 0,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await firebaseDb.collection('guests').doc(invitationCode).set(guestData);
        
        // Registrar actividad
        await logAction('guest_created', invitationCode, {
            name: name,
            email: email,
            maxGuests: maxGuests
        });
        
        return {
            success: true,
            invitationCode: invitationCode,
            data: guestData,
            link: `${getBaseUrl()}?code=${invitationCode}`
        };
        
    } catch (error) {
        console.error("Error creando invitación:", error);
        throw error;
    }
}

async function logAction(action, target, details = {}) {
    try {
        if (!firebaseDb) return;
        
        const user = firebaseAuth ? firebaseAuth.currentUser : null;
        
        const logEntry = {
            action,
            target,
            details,
            user: user ? {
                email: user.email,
                uid: user.uid
            } : { email: 'system', uid: 'system' },
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent,
            hostname: window.location.hostname
        };
        
        await firebaseDb.collection('logs').add(logEntry);
        
    } catch (error) {
        console.error("Error registrando actividad:", error);
    }
}

function resetNewGuestForm() {
    const form = document.getElementById('new-guest-form');
    if (form) form.reset();
    
    const createdSection = document.getElementById('created-invitation');
    if (createdSection) createdSection.style.display = 'none';
    
    const bulkSection = document.getElementById('bulk-import-section');
    if (bulkSection) bulkSection.style.display = 'none';
}

function showCreatedInvitation(code, link) {
    const createdSection = document.getElementById('created-invitation');
    const linkInput = document.getElementById('invitation-link');
    const copyBtn = document.getElementById('btn-copy-link');
    
    if (!createdSection || !linkInput || !copyBtn) return;
    
    // Mostrar sección
    createdSection.style.display = 'block';
    
    // Actualizar enlace
    const fullLink = `${getBaseUrl()}?code=${code}`;
    linkInput.value = fullLink;
    
    // Configurar botón de copiar
    copyBtn.onclick = () => {
        copyToClipboard(fullLink);
        showToast('Enlace copiado al portapapeles', 'success');
    };
    
    // Scroll a la sección
    createdSection.scrollIntoView({ behavior: 'smooth' });
}

async function handleExportCSV() {
    try {
        showLoading();
        
        if (!firebaseDb) {
            throw new Error('Firebase no disponible');
        }
        
        const snapshot = await firebaseDb.collection('guests').get();
        let csv = 'Código,Nombre,Email,Cupos,Estado,Confirmados,Fecha Creación\n';
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const row = [
                doc.id,
                `"${(data.name || '').replace(/"/g, '""')}"`,
                data.email || '',
                data.maxGuests || 0,
                data.status || 'pending',
                data.confirmedGuests || 0,
                data.createdAt ? new Date(data.createdAt.toDate()).toISOString() : ''
            ].join(',');
            csv += row + '\n';
        });
        
        // Crear y descargar archivo
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `invitados-hollywood-nights-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast('CSV exportado exitosamente', 'success');
        
    } catch (error) {
        console.error("❌ Error exportando CSV:", error);
        showToast('Error al exportar CSV', 'error');
    } finally {
        hideLoading();
    }
}

function handleBulkImport() {
    const bulkSection = document.getElementById('bulk-import-section');
    if (bulkSection) {
        bulkSection.style.display = 'block';
        bulkSection.scrollIntoView({ behavior: 'smooth' });
    }
}

async function handleBulkImportConfirm() {
    const textarea = document.getElementById('bulk-import-text');
    if (!textarea) return;
    
    const content = textarea.value.trim();
    if (!content) {
        showToast('Pega los datos de los invitados primero', 'info');
        return;
    }
    
    try {
        showLoading();
        
        // Parsear datos
        const lines = content.split('\n').filter(line => line.trim());
        const guestList = [];
        
        for (const line of lines) {
            const parts = line.split(',').map(part => part.trim());
            
            if (parts.length >= 3) {
                guestList.push({
                    name: parts[0],
                    email: parts[1],
                    maxGuests: parseInt(parts[2])
                });
            }
        }
        
        if (guestList.length === 0) {
            throw new Error('Formato incorrecto. Revisa el ejemplo.');
        }
        
        console.log(`Importando ${guestList.length} invitados...`);
        
        const results = await bulkImportGuests(guestList);
        
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        
        showToast(`Importación completada: ${successful} exitosos, ${failed} fallidos`, 'success');
        
        // Limpiar textarea
        textarea.value = '';
        
        // Ocultar sección
        document.getElementById('bulk-import-section').style.display = 'none';
        
        // Recargar lista de invitados
        if (successful > 0) {
            loadGuests();
            loadDashboardData();
        }
        
    } catch (error) {
        console.error("❌ Error en importación masiva:", error);
        showToast(error.message || 'Error en importación masiva', 'error');
    } finally {
        hideLoading();
    }
}

async function bulkImportGuests(guestList) {
    try {
        if (!firebaseDb) throw new Error('Firebase no disponible');
        
        const results = [];
        const batch = firebaseDb.batch();
        
        for (const guest of guestList) {
            try {
                const { name, email, maxGuests } = guest;
                
                // Validar datos
                if (!maxGuests || ![2, 4, 6, 10].includes(maxGuests)) {
                    results.push({
                        success: false,
                        guest,
                        error: 'Número de invitados no válido'
                    });
                    continue;
                }
                
                // Generar código único
                let invitationCode = generateInvitationCode();
                let isUnique = false;
                let attempts = 0;
                
                while (!isUnique && attempts < 10) {
                    const existingDoc = await firebaseDb.collection('guests').doc(invitationCode).get();
                    if (!existingDoc.exists) {
                        isUnique = true;
                    } else {
                        invitationCode = generateInvitationCode();
                        attempts++;
                    }
                }
                
                if (!isUnique) {
                    results.push({
                        success: false,
                        guest,
                        error: 'No se pudo generar código único'
                    });
                    continue;
                }
                
                // Preparar datos
                const guestData = {
                    name: (name || '').trim(),
                    email: (email || '').trim().toLowerCase(),
                    maxGuests: maxGuests,
                    confirmedGuests: 0,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                // Agregar al batch
                const guestRef = firebaseDb.collection('guests').doc(invitationCode);
                batch.set(guestRef, guestData);
                
                results.push({
                    success: true,
                    invitationCode,
                    guest: guestData
                });
                
            } catch (error) {
                results.push({
                    success: false,
                    guest,
                    error: error.message
                });
            }
        }
        
        // Ejecutar batch si hay éxitos
        const successfulImports = results.filter(r => r.success);
        if (successfulImports.length > 0) {
            await batch.commit();
            
            // Registrar actividad
            await logAction('bulk_import', 'system', {
                total: guestList.length,
                successful: successfulImports.length,
                failed: results.length - successfulImports.length
            });
        }
        
        return results;
        
    } catch (error) {
        console.error("Error en importación masiva:", error);
        throw error;
    }
}

// ===== ACCIONES SOBRE INVITADOS =====
async function copyInvitationLink(invitationCode) {
    try {
        if (!invitationCode) return;
        
        console.log("Copiando enlace para:", invitationCode);
        
        const link = `${getBaseUrl()}?code=${invitationCode}`;
        await copyToClipboard(link);
        showToast('Enlace copiado al portapapeles', 'success');
        
    } catch (error) {
        console.error("❌ Error copiando enlace:", error);
        showToast('Error al copiar enlace', 'error');
    }
}

async function editGuest(invitationCode) {
    try {
        if (!invitationCode || !firebaseDb) return;
        
        const guestDoc = await firebaseDb.collection('guests').doc(invitationCode).get();
        
        if (!guestDoc.exists) {
            showToast('Invitación no encontrada', 'error');
            return;
        }
        
        const data = guestDoc.data();
        
        // Mostrar modal de edición
        showModal('Editar Invitado', `
            <div class="form-row">
                <label class="form-label">Nombre</label>
                <input type="text" id="edit-guest-name" class="form-input" value="${data.name || ''}">
            </div>
            <div class="form-row">
                <label class="form-label">Email</label>
                <input type="email" id="edit-guest-email" class="form-input" value="${data.email || ''}">
            </div>
            <div class="form-row">
                <label class="form-label">Estado</label>
                <select id="edit-guest-status" class="form-select">
                    <option value="pending" ${data.status === 'pending' ? 'selected' : ''}>Pendiente</option>
                    <option value="confirmed" ${data.status === 'confirmed' ? 'selected' : ''}>Confirmado</option>
                    <option value="declined" ${data.status === 'declined' ? 'selected' : ''}>No asistirá</option>
                </select>
            </div>
            <div class="form-row" id="edit-confirmed-container" style="${data.status === 'confirmed' ? '' : 'display: none;'}">
                <label class="form-label">Personas confirmadas (máximo: ${data.maxGuests || 2})</label>
                <input type="number" id="edit-guest-confirmed" class="form-input" 
                       min="1" max="${data.maxGuests || 2}" 
                       value="${data.confirmedGuests || 1}">
            </div>
        `, async () => {
            // Guardar cambios
            try {
                showLoading();
                
                const name = document.getElementById('edit-guest-name').value.trim();
                const email = document.getElementById('edit-guest-email').value.trim();
                const status = document.getElementById('edit-guest-status').value;
                const confirmed = status === 'confirmed' ? 
                    parseInt(document.getElementById('edit-guest-confirmed').value) || 1 : 0;
                
                const updateData = {
                    name: name,
                    email: email,
                    status: status,
                    confirmedGuests: confirmed,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                if (status === 'confirmed') {
                    updateData.responseDate = firebase.firestore.FieldValue.serverTimestamp();
                }
                
                await firebaseDb.collection('guests').doc(invitationCode).update(updateData);
                
                showToast('Invitación actualizada', 'success');
                loadGuests();
                loadDashboardData();
                
            } catch (error) {
                console.error("❌ Error actualizando invitado:", error);
                showToast('Error al actualizar', 'error');
            } finally {
                hideLoading();
            }
        });
        
        // Mostrar/ocultar campo de confirmados según estado
        const statusSelect = document.getElementById('edit-guest-status');
        const confirmedContainer = document.getElementById('edit-confirmed-container');
        
        if (statusSelect && confirmedContainer) {
            statusSelect.addEventListener('change', () => {
                if (statusSelect.value === 'confirmed') {
                    confirmedContainer.style.display = 'block';
                } else {
                    confirmedContainer.style.display = 'none';
                }
            });
        }
        
    } catch (error) {
        console.error("❌ Error editando invitado:", error);
        showToast('Error al cargar datos', 'error');
    }
}

async function deleteGuestConfirmation(invitationCode) {
    showModal('Confirmar Eliminación', `
        <p style="color: #fff; margin-bottom: 1.5rem;">
            ¿Estás seguro de eliminar esta invitación?
        </p>
        <p style="color: #c0c0c0; font-size: 0.9rem;">
            Esta acción no se puede deshacer. El invitado perderá acceso al formulario.
        </p>
    `, async () => {
        try {
            showLoading();
            
            await deleteGuest(invitationCode);
            showToast('Invitación eliminada', 'success');
            loadGuests();
            loadDashboardData();
            
        } catch (error) {
            console.error("❌ Error eliminando invitado:", error);
            showToast(error.message || 'Error al eliminar', 'error');
        } finally {
            hideLoading();
        }
    });
}

async function deleteGuest(invitationCode) {
    try {
        if (!firebaseDb) throw new Error('Firebase no disponible');
        
        const guestRef = firebaseDb.collection('guests').doc(invitationCode);
        const guestDoc = await guestRef.get();
        
        if (!guestDoc.exists) {
            throw new Error('Invitación no encontrada');
        }
        
        const guestData = guestDoc.data();
        
        // Primero mover a eliminados (backup)
        await firebaseDb.collection('deleted_guests').doc(invitationCode).set({
            ...guestData,
            deletedAt: firebase.firestore.FieldValue.serverTimestamp(),
            deletedBy: firebaseAuth.currentUser?.email || 'system'
        });
        
        // Luego eliminar
        await guestRef.delete();
        
        // Registrar actividad
        await logAction('guest_deleted', invitationCode, {
            name: guestData.name,
            email: guestData.email
        });
        
        return {
            success: true,
            message: 'Invitación eliminada correctamente'
        };
        
    } catch (error) {
        console.error("Error eliminando invitado:", error);
        throw error;
    }
}

// ===== MODALES =====
function initModals() {
    console.log("🎭 Inicializando modales...");
    
    const modalOverlay = document.getElementById('modal-overlay');
    const modalClose = document.getElementById('modal-close');
    
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                hideModal();
            }
        });
    }
    
    if (modalClose) {
        modalClose.addEventListener('click', hideModal);
    }
    
    // Cerrar modal con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
            hideModal();
        }
    });
    
    console.log("✅ Modales inicializados correctamente");
}

let modalCallback = null;

function showModal(title, content, callback = null) {
    const modalOverlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalContent = document.getElementById('modal-content');
    
    if (!modalOverlay || !modalTitle || !modalContent) return;
    
    modalTitle.textContent = title;
    modalContent.innerHTML = content;
    
    // Agregar botones de acción
    const actions = document.createElement('div');
    actions.className = 'form-actions';
    actions.innerHTML = `
        <button type="button" class="btn-cancel" id="modal-cancel">Cancelar</button>
        <button type="button" class="btn-save" id="modal-confirm">Confirmar</button>
    `;
    
    modalContent.appendChild(actions);
    
    // Guardar callback
    modalCallback = callback;
    
    // Mostrar modal
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Event listeners para botones
    setTimeout(() => {
        const cancelBtn = document.getElementById('modal-cancel');
        const confirmBtn = document.getElementById('modal-confirm');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', hideModal);
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (modalCallback) {
                    modalCallback();
                }
                hideModal();
            });
        }
    }, 10);
}

function hideModal() {
    const modalOverlay = document.getElementById('modal-overlay');
    
    if (modalOverlay) {
        modalOverlay.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    modalCallback = null;
}

// ===== MENÚ MÓVIL =====
function initMobileMenu() {
    const menuBtn = document.querySelector('.mobile-menu-button');
    const mobileNav = document.getElementById('mobile-nav');
    
    if (menuBtn && mobileNav) {
        menuBtn.addEventListener('click', () => {
            mobileNav.classList.toggle('active');
            menuBtn.innerHTML = mobileNav.classList.contains('active') ?
                '<i class="fas fa-times"></i>' :
                '<i class="fas fa-bars"></i>';
        });
    }
    
    // Cerrar menú al hacer clic en un tab
    const mobileTabs = mobileNav ? mobileNav.querySelectorAll('.nav-tab') : [];
    mobileTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            mobileNav.classList.remove('active');
            if (menuBtn) {
                menuBtn.innerHTML = '<i class="fas fa-bars"></i>';
            }
        });
    });
}

// ===== GESTIÓN DE ADMINISTRADORES DESDE FIREBASE =====
async function loadAdminList() {
    try {
        const adminList = document.getElementById('admin-list');
        if (!adminList) return;
        
        adminList.innerHTML = '<p style="color: #c0c0c0; text-align: center;">Cargando administradores...</p>';
        
        if (!firebaseDb) {
            adminList.innerHTML = `
                <div style="color: #c0c0c0; text-align: center;">
                    <p>⚠️ Firebase no disponible</p>
                    <p>Usando lista predeterminada de administradores</p>
                </div>
            `;
            return;
        }
        
        try {
            // Intentar obtener administradores de Firestore
            const snapshot = await firebaseDb.collection('admins').get();
            
            if (snapshot.empty) {
                adminList.innerHTML = `
                    <div style="color: #c0c0c0;">
                        <h4>Administradores Actuales</h4>
                        <p>No hay administradores registrados en Firestore.</p>
                        <p>Usando lista predeterminada:</p>
                        <ul style="margin-left: 20px; margin-top: 10px;">
                            <li>andy.ramosmanzanilla@gmail.com</li>
                            <li>andyramoss@gmail.com</li>
                        </ul>
                        <p style="margin-top: 15px; font-size: 0.9rem; color: #888;">
                            Para agregar administradores desde Firebase:
                            <br>1. Ve a Firebase Console
                            <br>2. Crea una colección llamada "admins"
                            <br>3. Agrega documentos con emails como ID
                        </p>
                    </div>
                `;
                return;
            }
            
            let html = '<h4>Administradores (desde Firebase)</h4>';
            html += '<div style="margin-top: 15px;">';
            html += '<table style="width: 100%; border-collapse: collapse;">';
            html += '<thead><tr><th style="text-align: left; padding: 8px; border-bottom: 1px solid rgba(212, 175, 55, 0.3);">Email</th><th style="text-align: left; padding: 8px; border-bottom: 1px solid rgba(212, 175, 55, 0.3);">Acciones</th></tr></thead>';
            html += '<tbody>';
            
            snapshot.forEach(doc => {
                const data = doc.data();
                const email = doc.id;
                html += `
                    <tr>
                        <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <strong>${email}</strong>
                            ${data.role ? `<br><span style="font-size: 0.8rem; color: #888;">${data.role}</span>` : ''}
                        </td>
                        <td style="padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                            <button class="btn-action-icon btn-remove-admin" data-email="${email}" style="background: rgba(244, 67, 54, 0.1); border-color: rgba(244, 67, 54, 0.3); color: #f44336;" title="Eliminar admin">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += '</tbody></table></div>';
            
            adminList.innerHTML = html;
            
            // Agregar event listeners a los botones de eliminar
            document.querySelectorAll('.btn-remove-admin').forEach(btn => {
                btn.addEventListener('click', () => {
                    const email = btn.getAttribute('data-email');
                    removeAdminConfirmation(email);
                });
            });
            
        } catch (error) {
            console.error("Error cargando admins:", error);
            adminList.innerHTML = `
                <div style="color: #c0c0c0;">
                    <h4>Administradores Actuales</h4>
                    <p>Error cargando administradores desde Firebase.</p>
                    <p>Usando lista predeterminada:</p>
                    <ul style="margin-left: 20px; margin-top: 10px;">
                        <li>andy.ramosmanzanilla@gmail.com</li>
                        <li>andyramoss@gmail.com</li>
                    </ul>
                    <p style="margin-top: 15px; color: #f44336;">
                        Error: ${error.message}
                    </p>
                </div>
            `;
        }
        
    } catch (error) {
        console.error("❌ Error cargando lista de admins:", error);
        const adminList = document.getElementById('admin-list');
        if (adminList) {
            adminList.innerHTML = `
                <div style="color: #f44336;">
                    <p>Error cargando administradores: ${error.message}</p>
                </div>
            `;
        }
    }
}

async function addAdminFromPanel() {
    try {
        const emailInput = document.getElementById('new-admin-email');
        if (!emailInput) return;
        
        const email = emailInput.value.trim().toLowerCase();
        
        if (!email || !email.includes('@')) {
            showToast('Ingresa un email válido', 'warning');
            return;
        }
        
        showLoading();
        
        // Verificar que Firebase esté disponible
        if (!firebaseDb) {
            throw new Error('Firebase no está disponible');
        }
        
        // Verificar si ya existe
        const existingDoc = await firebaseDb.collection('admins').doc(email).get();
        if (existingDoc.exists) {
            showToast('Este email ya es administrador', 'warning');
            hideLoading();
            return;
        }
        
        // Agregar administrador a Firestore
        await firebaseDb.collection('admins').doc(email).set({
            email: email,
            role: 'admin',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            addedBy: currentUser ? currentUser.email : 'system',
            addedAt: new Date().toISOString()
        });
        
        // Registrar actividad
        await logAction('admin_added', email, {
            addedBy: currentUser?.email,
            timestamp: new Date().toISOString()
        });
        
        showToast(`✅ Administrador ${email} agregado correctamente`, 'success');
        emailInput.value = '';
        
        // Recargar lista de administradores
        loadAdminList();
        
    } catch (error) {
        console.error("❌ Error agregando administrador:", error);
        showToast('Error al agregar administrador: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}

async function removeAdmin(email) {
    try {
        if (!firebaseDb) throw new Error('Firebase no disponible');
        
        // No permitir eliminarse a sí mismo
        if (currentUser && currentUser.email.toLowerCase() === email.toLowerCase()) {
            throw new Error('No puedes eliminarte a ti mismo como administrador');
        }
        
        // Eliminar de Firestore
        await firebaseDb.collection('admins').doc(email).delete();
        
        // Registrar actividad
        await logAction('admin_removed', email, {
            removedBy: currentUser?.email,
            timestamp: new Date().toISOString()
        });
        
        return { success: true, message: 'Administrador eliminado' };
        
    } catch (error) {
        console.error("Error eliminando administrador:", error);
        throw error;
    }
}

function removeAdminConfirmation(email) {
    showModal('Eliminar Administrador', `
        <p style="color: #fff; margin-bottom: 1.5rem;">
            ¿Estás seguro de eliminar a <strong>${email}</strong> como administrador?
        </p>
        <p style="color: #c0c0c0; font-size: 0.9rem;">
            Esta persona perderá acceso al panel de administración.
            ${currentUser && currentUser.email.toLowerCase() === email.toLowerCase() ? 
                '<br><strong style="color: #f44336;">⚠️ No puedes eliminarte a ti mismo</strong>' : ''}
        </p>
    `, async () => {
        try {
            showLoading();
            
            await removeAdmin(email);
            showToast('Administrador eliminado', 'success');
            loadAdminList();
            
        } catch (error) {
            console.error("❌ Error eliminando administrador:", error);
            showToast(error.message || 'Error al eliminar administrador', 'error');
        } finally {
            hideLoading();
        }
    });
}

// ===== CONFIGURACIONES =====
function loadSettings() {
    console.log("⚙️ Cargando configuración...");
    
    // Cargar lista de administradores
    loadAdminList();

    // Media settings (galería + música)
    loadEventMediaSettings();
    setupMediaButtons();

    // Configuración editable de la invitación
    loadEventConfigSettings();
    setupConfigButtons();
    
    // Configurar botón para agregar admin
    const addAdminBtn = document.getElementById('btn-add-admin');
    if (addAdminBtn) {
        // Remover event listeners anteriores
        addAdminBtn.replaceWith(addAdminBtn.cloneNode(true));
        const newAddAdminBtn = document.getElementById('btn-add-admin');
        
        // Agregar nuevo event listener
        newAddAdminBtn.addEventListener('click', addAdminFromPanel);
    }
}

// ===== CONFIGURACIÓN EDITABLE (TEXTOS / FECHAS / ITINERARIO) =====
const EVENT_CONFIG_COLLECTION = 'event_config';
const EVENT_CONFIG_DOC = 'main';

function setupConfigButtons() {
    const btn = document.getElementById('btn-save-config');
    if (!btn) return;
    btn.replaceWith(btn.cloneNode(true));
    document.getElementById('btn-save-config')?.addEventListener('click', saveEventConfigSettings);
}

async function ensureEventConfigDocExists() {
    if (!firebaseDb) throw new Error('Firebase no disponible');
    const ref = firebaseDb.collection(EVENT_CONFIG_COLLECTION).doc(EVENT_CONFIG_DOC);
    const doc = await ref.get();
    if (!doc.exists) {
        await ref.set({
            heroBadge: '¡Estamos de fiesta!',
            celebrantName: 'Gloria María',
            age: 85,
            heroSubtitle: 'Celebramos 85 años de vida, amor y bendiciones',
            heroDateText: '16 DE MAYO 2026',
            eventDateTimeISO: '2026-05-16T20:30:00',
            venueName: 'Salón Valles',
            venueAddressLines: [
                'Calle 29 diagonal #341 x 38 y 40',
                'Col. San Luis Chuburná, Mérida, Yucatán'
            ],
            dressCode: 'Formal',
            mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Salon%20Valles%20Merida%20Yucatan',
            giftsText: 'Tu presencia es el mejor regalo.',
            footerHashtags: '#CumpleGloriaMaria #85Años',
            itinerary: [
                { time: '8:30 pm - 9:30 pm', title: 'Sesión de Fotos', bullets: ['Recuerdos', 'Familia y amigos'] },
                { time: '9:30 pm - 10:00 pm', title: 'Presentación', bullets: ['Brindis', 'Momento especial'] },
                { time: '10:00 pm - 2:00 am', title: 'Música', bullets: ['Amenizado por Grupo Okey y familia'] },
                { time: '2:00 am - 3:00 am', title: 'Show sorpresa', bullets: ['Momento especial'] }
            ],
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    return ref;
}

async function loadEventConfigSettings() {
    try {
        if (!firebaseDb) return;
        await ensureEventConfigDocExists();

        const doc = await firebaseDb.collection(EVENT_CONFIG_COLLECTION).doc(EVENT_CONFIG_DOC).get();
        const cfg = doc.exists ? (doc.data() || {}) : {};

        setValue('cfg-hero-badge', cfg.heroBadge);
        setValue('cfg-celebrant-name', cfg.celebrantName);
        setValue('cfg-age', cfg.age);
        setValue('cfg-hero-subtitle', cfg.heroSubtitle);
        setValue('cfg-hero-date-text', cfg.heroDateText);
        setValue('cfg-venue-name', cfg.venueName);
        setValue('cfg-dress-code', cfg.dressCode);
        setValue('cfg-maps-url', cfg.mapsUrl);
        setValue('cfg-gifts-text', cfg.giftsText);
        setValue('cfg-footer-hashtags', cfg.footerHashtags);

        if (cfg.eventDateTimeISO) {
            const iso = String(cfg.eventDateTimeISO);
            const dtLocal = iso.length >= 16 ? iso.slice(0, 16) : iso;
            setValue('cfg-event-datetime', dtLocal);
        }

        const address = Array.isArray(cfg.venueAddressLines) ? cfg.venueAddressLines.join('\n') : '';
        setValue('cfg-venue-address', address);

        const itinerary = Array.isArray(cfg.itinerary) ? cfg.itinerary : [];
        const itineraryText = itinerary.map(it => {
            const time = it.time || '';
            const title = it.title || '';
            const bullets = Array.isArray(it.bullets) ? it.bullets.join(';') : '';
            return `${time}|${title}|${bullets}`.trim();
        }).join('\n');
        setValue('cfg-itinerary', itineraryText);

    } catch (error) {
        console.error('❌ Error cargando event_config:', error);
        showToast('Error cargando configuración editable', 'error');
    }
}

async function saveEventConfigSettings() {
    try {
        if (!firebaseDb) throw new Error('Firebase Firestore no disponible');

        showLoading();
        await ensureEventConfigDocExists();

        const heroBadge = getValue('cfg-hero-badge');
        const celebrantName = getValue('cfg-celebrant-name');
        const age = parseInt(getValue('cfg-age') || '0', 10) || 0;
        const heroSubtitle = getValue('cfg-hero-subtitle');
        const heroDateText = getValue('cfg-hero-date-text');
        const eventDateTimeLocal = getValue('cfg-event-datetime');
        const eventDateTimeISO = eventDateTimeLocal ? `${eventDateTimeLocal}:00` : '';
        const venueName = getValue('cfg-venue-name');
        const venueAddressLines = (getValue('cfg-venue-address') || '')
            .split('\n')
            .map(l => l.trim())
            .filter(Boolean);
        const dressCode = getValue('cfg-dress-code');
        const mapsUrl = getValue('cfg-maps-url');
        const giftsText = getValue('cfg-gifts-text');
        const footerHashtags = getValue('cfg-footer-hashtags');
        const itinerary = parseItineraryEditor(getValue('cfg-itinerary') || '');

        await firebaseDb.collection(EVENT_CONFIG_COLLECTION).doc(EVENT_CONFIG_DOC).set({
            heroBadge,
            celebrantName,
            age,
            heroSubtitle,
            heroDateText,
            eventDateTimeISO,
            venueName,
            venueAddressLines,
            dressCode,
            mapsUrl,
            giftsText,
            footerHashtags,
            itinerary,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // compat con event_media (openLocation + loader actual)
        await firebaseDb.collection(EVENT_MEDIA_COLLECTION).doc(EVENT_MEDIA_DOC).set({
            mapsUrl,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast('✅ Configuración guardada', 'success');
    } catch (error) {
        console.error('❌ Error guardando event_config:', error);
        showToast(error.message || 'Error guardando configuración', 'error');
    } finally {
        hideLoading();
    }
}

function parseItineraryEditor(text) {
    const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
    const items = [];
    for (const line of lines) {
        const parts = line.split('|').map(p => p.trim());
        const time = parts[0] || '';
        const title = parts[1] || '';
        const bullets = (parts[2] || '').split(';').map(b => b.trim()).filter(Boolean);
        if (!time && !title && bullets.length === 0) continue;
        items.push({ time, title, bullets });
    }
    return items;
}

function setValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value ?? '';
}

function getValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || '').trim() : '';
}

// ===== MEDIA (FOTOS Y MÚSICA) =====
const EVENT_MEDIA_COLLECTION = 'event_media';
const EVENT_MEDIA_DOC = 'main';

async function loadEventMediaSettings() {
    try {
        const list = document.getElementById('media-gallery-list');
        if (list) list.innerHTML = '<p>Cargando...</p>';

        if (!firebaseDb) {
            if (list) list.innerHTML = '<p>Firebase no disponible.</p>';
            return;
        }

        const doc = await firebaseDb.collection(EVENT_MEDIA_COLLECTION).doc(EVENT_MEDIA_DOC).get();
        const data = doc.exists ? (doc.data() || {}) : {};
        const galleryUrls = Array.isArray(data.galleryUrls) ? data.galleryUrls : [];

        renderGalleryList(galleryUrls);
    } catch (error) {
        console.error("❌ Error cargando media settings:", error);
        const list = document.getElementById('media-gallery-list');
        if (list) list.innerHTML = `<p style="color:#f44336;">Error: ${error.message}</p>`;
    }
}

function renderGalleryList(galleryUrls) {
    const list = document.getElementById('media-gallery-list');
    if (!list) return;

    if (!galleryUrls || galleryUrls.length === 0) {
        list.innerHTML = '<p>No hay fotos todavía.</p>';
        return;
    }

    const itemsHtml = galleryUrls.map((url) => {
        const safeUrl = String(url || '');
        return `
            <div style="display:flex; align-items:center; gap:10px; padding:10px; border:1px solid rgba(212,175,55,0.12); border-radius:10px; margin-bottom:10px; background: rgba(255,255,255,0.03);">
                <img src="${safeUrl}" alt="Foto" style="width:64px; height:44px; object-fit:cover; border-radius:8px; border:1px solid rgba(255,255,255,0.08);" />
                <div style="flex:1; overflow:hidden;">
                    <div style="font-size:0.85rem; color:#c0c0c0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${safeUrl}</div>
                </div>
                <button class="btn-action-icon btn-delete-photo" data-url="${safeUrl}" title="Quitar foto" style="border-color: rgba(244,67,54,0.35); color:#f44336;">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');

    list.innerHTML = itemsHtml;

    list.querySelectorAll('.btn-delete-photo').forEach(btn => {
        btn.addEventListener('click', async () => {
            const url = btn.getAttribute('data-url');
            await removePhotoUrl(url);
        });
    });
}

function setupMediaButtons() {
    // Subir fotos
    const uploadPhotosBtn = document.getElementById('btn-upload-photos');
    if (uploadPhotosBtn) {
        uploadPhotosBtn.replaceWith(uploadPhotosBtn.cloneNode(true));
        document.getElementById('btn-upload-photos')?.addEventListener('click', uploadGalleryPhotos);
    }

    // Subir música
    const uploadMusicBtn = document.getElementById('btn-upload-music');
    if (uploadMusicBtn) {
        uploadMusicBtn.replaceWith(uploadMusicBtn.cloneNode(true));
        document.getElementById('btn-upload-music')?.addEventListener('click', uploadBackgroundMusic);
    }

    // Quitar música
    const disableMusicBtn = document.getElementById('btn-disable-music');
    if (disableMusicBtn) {
        disableMusicBtn.replaceWith(disableMusicBtn.cloneNode(true));
        document.getElementById('btn-disable-music')?.addEventListener('click', disableBackgroundMusic);
    }
}

async function ensureEventMediaDocExists() {
    if (!firebaseDb) throw new Error('Firebase no disponible');

    const ref = firebaseDb.collection(EVENT_MEDIA_COLLECTION).doc(EVENT_MEDIA_DOC);
    const doc = await ref.get();
    if (!doc.exists) {
        await ref.set({
            galleryUrls: [],
            musicUrl: '',
            musicEnabled: false,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    return ref;
}

async function uploadGalleryPhotos() {
    try {
        if (!firebaseStorage) throw new Error('Firebase Storage no disponible');
        if (!firebaseDb) throw new Error('Firebase Firestore no disponible');

        const input = document.getElementById('media-gallery-files');
        const files = input?.files ? Array.from(input.files) : [];
        if (!files || files.length === 0) {
            showToast('Selecciona al menos una foto', 'info');
            return;
        }

        showLoading();
        await ensureEventMediaDocExists();

        const urls = [];
        for (const file of files) {
            const fileName = `${Date.now()}_${(file.name || 'foto').replace(/\s+/g, '_')}`;
            const path = `media/gallery/${fileName}`;
            const ref = firebaseStorage.ref().child(path);

            const snapshot = await ref.put(file, {
                contentType: file.type || 'image/jpeg',
                cacheControl: 'public,max-age=31536000'
            });
            const url = await snapshot.ref.getDownloadURL();
            urls.push(url);
        }

        // Guardar URLs en Firestore
        const mediaRef = firebaseDb.collection(EVENT_MEDIA_COLLECTION).doc(EVENT_MEDIA_DOC);
        const updates = {
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        // arrayUnion por cada url (compat)
        for (const url of urls) {
            await mediaRef.set({
                galleryUrls: firebase.firestore.FieldValue.arrayUnion(url),
                ...updates
            }, { merge: true });
        }

        // Limpieza UI
        if (input) input.value = '';
        showToast(`✅ ${urls.length} foto(s) subida(s)`, 'success');

        await loadEventMediaSettings();
    } catch (error) {
        console.error("❌ Error subiendo fotos:", error);
        showToast(error.message || 'Error subiendo fotos', 'error');
    } finally {
        hideLoading();
    }
}

async function uploadBackgroundMusic() {
    try {
        if (!firebaseStorage) throw new Error('Firebase Storage no disponible');
        if (!firebaseDb) throw new Error('Firebase Firestore no disponible');

        const input = document.getElementById('media-music-file');
        const file = input?.files?.[0];
        if (!file) {
            showToast('Selecciona un archivo de música', 'info');
            return;
        }

        showLoading();
        await ensureEventMediaDocExists();

        const fileName = `${Date.now()}_${(file.name || 'musica').replace(/\s+/g, '_')}`;
        const path = `media/music/${fileName}`;
        const ref = firebaseStorage.ref().child(path);

        const snapshot = await ref.put(file, {
            contentType: file.type || 'audio/mpeg',
            cacheControl: 'public,max-age=31536000'
        });
        const url = await snapshot.ref.getDownloadURL();

        await firebaseDb.collection(EVENT_MEDIA_COLLECTION).doc(EVENT_MEDIA_DOC).set({
            musicUrl: url,
            musicEnabled: true,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        if (input) input.value = '';
        showToast('✅ Música actualizada', 'success');
    } catch (error) {
        console.error("❌ Error subiendo música:", error);
        showToast(error.message || 'Error subiendo música', 'error');
    } finally {
        hideLoading();
    }
}

async function disableBackgroundMusic() {
    try {
        if (!firebaseDb) throw new Error('Firebase Firestore no disponible');

        showLoading();
        await ensureEventMediaDocExists();

        await firebaseDb.collection(EVENT_MEDIA_COLLECTION).doc(EVENT_MEDIA_DOC).set({
            musicEnabled: false,
            musicUrl: '',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast('Música desactivada', 'success');
    } catch (error) {
        console.error("❌ Error desactivando música:", error);
        showToast(error.message || 'Error desactivando música', 'error');
    } finally {
        hideLoading();
    }
}

async function removePhotoUrl(url) {
    try {
        if (!firebaseDb) throw new Error('Firebase Firestore no disponible');
        if (!url) return;

        showLoading();
        await ensureEventMediaDocExists();

        await firebaseDb.collection(EVENT_MEDIA_COLLECTION).doc(EVENT_MEDIA_DOC).set({
            galleryUrls: firebase.firestore.FieldValue.arrayRemove(url),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showToast('Foto quitada', 'success');
        await loadEventMediaSettings();
    } catch (error) {
        console.error("❌ Error quitando foto:", error);
        showToast(error.message || 'Error quitando foto', 'error');
    } finally {
        hideLoading();
    }
}

// ===== UTILIDADES =====
function getBaseUrl() {
    // Soporta GitHub Pages (https://usuario.github.io/repo/) y también dominio raíz.
    // Regresa la carpeta actual donde vive el sitio.
    const url = new URL(window.location.href);
    const path = url.pathname || '/';
    const basePath = path.endsWith('/') ? path : path.substring(0, path.lastIndexOf('/') + 1);
    return `${url.origin}${basePath}`;
}

function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.add('active');
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? 'check-circle' :
                 type === 'error' ? 'exclamation-circle' :
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    toast.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remover después de 5 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

function clearDashboardData() {
    // Limpiar estadísticas
    const statElements = [
        'stat-total-guests',
        'stat-confirmed-guests',
        'stat-pending-guests',
        'stat-declined-guests',
        'stat-confirmed-total',
        'stat-confirmation-rate'
    ];
    
    statElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
    });
    
    // Limpiar lista de invitados
    const guestsList = document.getElementById('guests-list');
    if (guestsList) {
        guestsList.innerHTML = '';
    }
    
    // Limpiar actividad
    const activityList = document.getElementById('activity-list');
    if (activityList) {
        activityList.innerHTML = '';
    }
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        // Fallback para navegadores antiguos
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            return true;
        } catch (err) {
            console.error('Fallback copy failed:', err);
            return false;
        } finally {
            document.body.removeChild(textarea);
        }
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ===== INICIALIZACIÓN FINAL =====
console.log("✅ Admin Panel completamente cargado y listo");
console.log("===========================================");