// invitation.js - Manejo de invitaciones en la página principal

// Variables globales
let currentInvitationCode = null;
let currentGuestData = null;
let eventMedia = {
    galleryUrls: [],
    musicUrl: '',
    musicEnabled: false,
    mapsUrl: '',
    dressSuitImageUrl: '',
    dressGownImageUrl: ''
};

let eventConfig = null;

window.__WELCOME_DISMISSED__ = false;
window.__AUDIO_READY__ = false;
window.__PLAY_INVITE_MUSIC__ = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log("🎬 Invitation Page inicializando...");

    setupWelcomeGate();
    
    // Obtener parámetros de URL
    const urlParams = new URLSearchParams(window.location.search);
    const maxGuestsParam = urlParams.get('p');
    const invitationCode = urlParams.get('code');
    
    // Inicializar Firebase
    initializeFirebaseForInvitations();

    // Cargar media (galería y música) desde Firestore
    loadEventMedia();

    // Cargar configuración editable (textos, fechas, itinerario)
    loadEventConfig();
    
    // Verificar invitación si hay código
    if (invitationCode) {
        console.log("Código de invitación detectado:", invitationCode);
        currentInvitationCode = invitationCode;
        checkInvitation(invitationCode);
    } else if (maxGuestsParam) {
        // Solo número de invitados (modo simple)
        console.log("Modo simple con", maxGuestsParam, "invitados");
        setupSimpleInvitation(parseInt(maxGuestsParam));
    } else {
        // Modo sin invitación (solo información)
        console.log("Modo informativo - Sin invitación específica");
        showGenericInfo();
    }
    
    // Configurar formulario de RSVP
    setupRSVPForm();
});

async function waitForAudioReady(maxMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
        if (window.__AUDIO_READY__) return true;
        await new Promise((r) => setTimeout(r, 120));
    }
    return false;
}

function setupWelcomeGate() {
    const overlay = document.getElementById('welcome-overlay');
    const btn = document.getElementById('welcome-enter');
    if (!overlay || !btn) return;

    document.body.classList.add('welcome-open');

    let closing = false;
    btn.addEventListener('click', async () => {
        if (closing) return;
        closing = true;

        overlay.classList.add('welcome-overlay--closing');
        document.body.classList.remove('welcome-open');
        window.__WELCOME_DISMISSED__ = true;

        setTimeout(() => {
            overlay.style.display = 'none';
        }, 450);

        await waitForAudioReady();

        if (typeof window.__PLAY_INVITE_MUSIC__ === 'function') {
            try {
                await window.__PLAY_INVITE_MUSIC__();
            } catch (e) {
                console.warn('Audio después de ENTRAR:', e);
            }
        }
    });
}

function initializeFirebaseForInvitations() {
    try {
        // Verificar que Firebase esté cargado
        if (typeof firebase === 'undefined') {
            console.error("Firebase SDK no está cargado");
            return false;
        }
        
        // Inicializar Firebase solo si no está ya inicializado
        if (firebase.apps.length === 0) {
            const firebaseConfig = {
                apiKey: "AIzaSyA2uASDdwH2vKmRtwLDvjvTSMOFImhDUFM",
                authDomain: "encuesta-649b8.firebaseapp.com",
                projectId: "encuesta-649b8",
                storageBucket: "encuesta-649b8.firebasestorage.app",
                messagingSenderId: "226296434450",
                appId: "1:226296434450:web:470fb309d3b73a630a2dcb",
                measurementId: "G-8YTM0C38ST"
            };
            firebase.initializeApp(firebaseConfig);
            console.log("✅ Firebase inicializado para invitaciones");
            return true;
        }
        
        console.log("✅ Firebase ya estaba inicializado");
        return true;
        
    } catch (error) {
        console.error("❌ Error inicializando Firebase:", error);
        return false;
    }
}

async function loadEventMedia() {
    try {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            console.warn("Firebase no disponible para cargar media");
            return;
        }

        const db = firebase.firestore();
        const doc = await db.collection('event_media').doc('main').get();
        const data = doc.exists ? (doc.data() || {}) : {};

        eventMedia.galleryUrls = Array.isArray(data.galleryUrls) ? data.galleryUrls : [];
        eventMedia.musicUrl = typeof data.musicUrl === 'string' ? data.musicUrl : '';
        eventMedia.musicEnabled = !!data.musicEnabled && !!eventMedia.musicUrl;
        eventMedia.mapsUrl = typeof data.mapsUrl === 'string' ? data.mapsUrl : '';
        eventMedia.dressSuitImageUrl = typeof data.dressSuitImageUrl === 'string' ? data.dressSuitImageUrl.trim() : '';
        eventMedia.dressGownImageUrl = typeof data.dressGownImageUrl === 'string' ? data.dressGownImageUrl.trim() : '';

        if (eventMedia.mapsUrl) {
            window.__MAPS_URL__ = eventMedia.mapsUrl;
        }

        setupFeaturedPhoto(eventMedia.galleryUrls);
        setupDressCodeImages();
        setupBackgroundMusic(eventMedia);
    } catch (error) {
        console.warn("⚠️ Error cargando media del evento:", error);
    }
}

function inviteAssetUrl(relativePath) {
    try {
        return new URL(relativePath, window.location.href).href;
    } catch (e) {
        return relativePath;
    }
}

function setupDressCodeImages() {
    const suitImg = document.getElementById('dress-code-suit-img');
    const gownImg = document.getElementById('dress-code-gown-img');
    if (!suitImg || !gownImg) return;

    const suit = String(eventMedia.dressSuitImageUrl || '').trim();
    const gown = String(eventMedia.dressGownImageUrl || '').trim();
    suitImg.src = suit || inviteAssetUrl('assets/dress-code-suit.svg');
    gownImg.src = gown || inviteAssetUrl('assets/dress-code-gown.svg');
    suitImg.alt = '';
    gownImg.alt = '';
}

/** Una sola foto a pantalla completa (usa la primera URL del panel; el resto se ignora). */
function setupFeaturedPhoto(urls) {
    const img = document.getElementById('featured-photo-img');
    const empty = document.getElementById('featured-photo-empty');
    if (!img || !empty) return;

    if (!urls || urls.length === 0) {
        img.removeAttribute('src');
        img.style.display = 'none';
        empty.style.display = 'flex';
        return;
    }

    const url = String(urls[0] || '');
    img.src = url;
    img.alt = 'Foto de la festejada';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.style.display = 'block';
    empty.style.display = 'none';
}

function setupBackgroundMusic(media) {
    const audio = document.getElementById('bg-music');
    const fab = document.getElementById('audio-fab');
    const label = document.getElementById('audio-label');

    if (!audio || !fab || !label) return;

    fab.style.display = 'none';
    window.__AUDIO_READY__ = false;
    window.__PLAY_INVITE_MUSIC__ = null;

    const setState = (isPlaying) => {
        fab.setAttribute('aria-label', isPlaying ? 'Pausar música' : 'Reproducir música');
        label.textContent = isPlaying ? 'Pausar' : 'Reproducir';
    };

    if (!media || !media.musicEnabled || !media.musicUrl) {
        return;
    }

    audio.src = media.musicUrl;
    audio.volume = 0.66;
    window.__AUDIO_READY__ = true;

    window.__PLAY_INVITE_MUSIC__ = async () => {
        try {
            if (!audio.paused) return;
            await audio.play();
            fab.style.display = 'inline-flex';
            setState(true);
        } catch (e) {
            console.warn('No se pudo reproducir audio:', e);
            fab.style.display = 'inline-flex';
            setState(false);
        }
    };

    fab.addEventListener('click', async () => {
        try {
            if (audio.paused) {
                await audio.play();
                setState(true);
            } else {
                audio.pause();
                setState(false);
            }
        } catch (e) {
            console.warn('No se pudo alternar audio:', e);
            setState(false);
        }
    });
}

async function loadEventConfig() {
    try {
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            console.warn("Firebase no disponible para cargar config");
            return;
        }

        const db = firebase.firestore();
        const doc = await db.collection('event_config').doc('main').get();
        if (!doc.exists) return;

        eventConfig = doc.data() || {};
        applyEventConfigToPage(eventConfig);
    } catch (error) {
        console.warn("⚠️ Error cargando event_config:", error);
    }
}

function applyEventConfigToPage(cfg) {
    if (!cfg) return;

    const heroBadge = cfg.heroBadge || '';
    const celebrantName = cfg.celebrantName || '';
    const age = cfg.age ? String(cfg.age) : '';
    const heroSubtitle = cfg.heroSubtitle || '';
    const heroDateText = cfg.heroDateText || '';
    const venueName = cfg.venueName || '';
    const venueAddressLines = Array.isArray(cfg.venueAddressLines) ? cfg.venueAddressLines : [];
    const dressCode = cfg.dressCode || '';
    const giftsText = cfg.giftsText || '';
    const giftsSubtext = cfg.giftsSubtext || '';
    const footerHashtags = cfg.footerHashtags || '';

    const giftsDefault =
        'Los mejores detalles hacen este día aún más especial';
    const giftsSubDefault =
        'Tu puntual asistencia hace que todo sea perfecto';

    setText('cfg-hero-badge-view', heroBadge);
    // título hero: "Cumpleaños" + nombre (y si hay edad, la agrega en pequeño)
    const titleEl = document.getElementById('cfg-hero-title-view');
    if (titleEl) {
        const name = escapeHtml(celebrantName || 'Nuestra festejada');
        const titleAge = age ? `<span class="hero-age-line">${escapeHtml(age)} años</span>` : '';
        titleEl.innerHTML =
            `<span class="hero-title-kicker">Cumpleaños</span>` +
            `<span class="hero-celebrant-name">${name}</span>${titleAge}`;
    }
    setText('cfg-hero-subtitle-view', heroSubtitle);
    setText('cfg-hero-date-view', heroDateText);

    setText('cfg-venue-name-view', venueName);
    const addrWrap = document.getElementById('cfg-venue-address-view');
    if (addrWrap) {
        addrWrap.innerHTML = venueAddressLines.map(l => `<p>${escapeHtml(String(l))}</p>`).join('');
    }
    setText('cfg-dress-code-view', dressCode);
    setText('cfg-gifts-text-view', giftsText || giftsDefault);
    setText('cfg-gifts-sub-view', giftsSubtext || giftsSubDefault);
    setText('cfg-footer-hashtags-view', footerHashtags);

    const welcomeNameEl = document.getElementById('welcome-celebration-name');
    if (welcomeNameEl) {
        welcomeNameEl.textContent = celebrantName || 'Mi Celebración';
    }

    // Maps URL (para openLocation)
    if (cfg.mapsUrl) {
        window.__MAPS_URL__ = cfg.mapsUrl;
    }

    // Countdown
    if (cfg.eventDateTimeISO) {
        const ts = new Date(cfg.eventDateTimeISO).getTime();
        if (!Number.isNaN(ts)) window.__COUNTDOWN_TS__ = ts;
    }

    // Itinerario dinámico
    if (Array.isArray(cfg.itinerary)) {
        renderItinerary(cfg.itinerary);
    }
}

function renderItinerary(items) {
    const container = document.getElementById('cfg-itinerary-view');
    if (!container) return;

    const html = items.map((it) => {
        const time = escapeHtml(String(it.time || ''));
        const title = escapeHtml(String(it.title || ''));
        const bullets = Array.isArray(it.bullets) ? it.bullets : [];
        const lis = bullets.map(b => `<li>${escapeHtml(String(b))}</li>`).join('');
        return `
            <div class="itinerary-item">
                <div class="itinerary-time">${time}</div>
                <div class="itinerary-content">
                    <h4>${title}</h4>
                    <ul>${lis}</ul>
                </div>
            </div>
        `;
    }).join('');

    // Si hay data válida, reemplaza el fallback
    if (html && html.trim().length > 0) {
        container.innerHTML = html;
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value ?? '';
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

async function checkInvitation(invitationCode) {
    try {
        console.log("Verificando invitación:", invitationCode);
        
        // Verificar que Firebase esté disponible
        if (typeof firebase === 'undefined' || !firebase.firestore) {
            console.warn("Firebase no está disponible");
            showGenericInfo();
            return;
        }
        
        const db = firebase.firestore();
        
        // Buscar invitación
        const guestDoc = await db.collection('guests').doc(invitationCode).get();
        
        if (!guestDoc.exists) {
            console.warn("Invitación no encontrada:", invitationCode);
            showInvalidInvitation();
            return;
        }
        
        const guestData = guestDoc.data();
        console.log("✅ Invitación válida encontrada:", guestData);
        
        // Guardar datos globalmente
        currentGuestData = guestData;
        
        // Mostrar información del invitado
        showGuestInfo(guestData, invitationCode);
        
    } catch (error) {
        console.error("❌ Error verificando invitación:", error);
        showGenericInfo();
    }
}

function setupSimpleInvitation(maxGuests) {
    // Actualizar UI con número de invitados
    const maxGuestsElement = document.getElementById('max-guests');
    const guestStatusElement = document.getElementById('guest-status');
    
    if (maxGuestsElement) {
        maxGuestsElement.textContent = maxGuests + " personas";
    }
    
    if (guestStatusElement) {
        guestStatusElement.textContent = "Pendiente de confirmación";
        guestStatusElement.style.color = "#ffd700";
    }
    
    // Configurar campo de cantidad de invitados
    const guestsCountInput = document.getElementById('guests-count');
    const maxAllowedSpan = document.getElementById('max-allowed');
    
    if (guestsCountInput && maxAllowedSpan) {
        guestsCountInput.max = maxGuests;
        guestsCountInput.value = maxGuests;
        maxAllowedSpan.textContent = maxGuests;
    }
    
    // Mostrar mensaje personalizado
    const invitationMessage = document.getElementById('invitation-message');
    if (invitationMessage) {
        invitationMessage.textContent = `Tu invitación es para ${maxGuests} personas`;
    }
}

function showGuestInfo(guestData, invitationCode) {
    // Actualizar información del invitado
    const maxGuestsElement = document.getElementById('max-guests');
    const guestStatusElement = document.getElementById('guest-status');
    const invitationTitle = document.getElementById('invitation-title');
    
    if (maxGuestsElement) {
        maxGuestsElement.textContent = guestData.maxGuests + " personas";
    }
    
    if (guestStatusElement) {
        const statusText = guestData.status === 'confirmed' ? 'Confirmado' :
                          guestData.status === 'declined' ? 'No asistirá' : 'Pendiente';
        guestStatusElement.textContent = statusText;
        guestStatusElement.style.color = guestData.status === 'confirmed' ? '#4CAF50' :
                                        guestData.status === 'declined' ? '#f44336' : '#ffd700';
    }
    
    if (invitationTitle && guestData.name) {
        invitationTitle.textContent = `Invitación para ${guestData.name}`;
    }
    
    // Configurar campo de cantidad de invitados
    const guestsCountInput = document.getElementById('guests-count');
    const maxAllowedSpan = document.getElementById('max-allowed');
    
    if (guestsCountInput && maxAllowedSpan) {
        const maxGuests = guestData.maxGuests || 2;
        const confirmedGuests = guestData.confirmedGuests || 1;
        
        guestsCountInput.max = maxGuests;
        guestsCountInput.value = Math.min(confirmedGuests, maxGuests);
        maxAllowedSpan.textContent = maxGuests;
    }
    
    // Mostrar mensaje personalizado
    const invitationMessage = document.getElementById('invitation-message');
    if (invitationMessage) {
        if (guestData.name) {
            invitationMessage.textContent = `¡Hola ${guestData.name}! Tu invitación es para ${guestData.maxGuests} personas`;
        } else {
            invitationMessage.textContent = `Tu invitación es para ${guestData.maxGuests} personas`;
        }
    }
}

function showGenericInfo() {
    const maxGuestsElement = document.getElementById('max-guests');
    if (maxGuestsElement) {
        maxGuestsElement.textContent = "2 personas (predeterminado)";
    }
    
    const maxAllowedSpan = document.getElementById('max-allowed');
    if (maxAllowedSpan) {
        maxAllowedSpan.textContent = "2";
    }
    
    const invitationMessage = document.getElementById('invitation-message');
    if (invitationMessage) {
        invitationMessage.textContent = "¡Estás invitado a celebrar con nosotros!";
    }
}

function showInvalidInvitation() {
    const rsvpForm = document.getElementById('rsvp-form-container');
    if (rsvpForm) {
        rsvpForm.innerHTML = `
            <div class="error-message">
                <div class="message-icon">
                    <i class="fas fa-exclamation-circle"></i>
                </div>
                <h3 class="font-cinzel">Invitación No Válida</h3>
                <p>El código de invitación no es válido o ha expirado.</p>
                <p class="message-note">Contacta al organizador para obtener un enlace válido.</p>
            </div>
        `;
    }
}

function setupRSVPForm() {
    const rsvpForm = document.getElementById('rsvp-form');
    if (!rsvpForm) return;
    
    // Mostrar/ocultar campos según selección
    const attendanceSelect = document.getElementById('attendance');
    const guestsCountGroup = document.getElementById('guests-count-group');
    const noteGroup = document.getElementById('note-group');
    const nameGroup = document.getElementById('name-group');
    
    if (attendanceSelect) {
        attendanceSelect.addEventListener('change', function() {
            if (this.value === 'yes') {
                guestsCountGroup.style.display = 'block';
                noteGroup.style.display = 'block';
                if (nameGroup) nameGroup.style.display = 'block';
            } else if (this.value === 'no') {
                guestsCountGroup.style.display = 'none';
                noteGroup.style.display = 'block';
                if (nameGroup) nameGroup.style.display = 'block';
            } else {
                guestsCountGroup.style.display = 'none';
                noteGroup.style.display = 'none';
                if (nameGroup) nameGroup.style.display = 'none';
            }
        });
    }
    
    // Manejar envío del formulario
    rsvpForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        try {
            // Mostrar loading
            const submitBtn = this.querySelector('.btn-submit');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
            submitBtn.disabled = true;
            
            // Obtener datos del formulario
            const name = document.getElementById('guest-name')?.value.trim() || '';
            const attendance = document.getElementById('attendance').value;
            const guestsCount = document.getElementById('guests-count')?.value || 1;
            const note = document.getElementById('note')?.value.trim() || '';
            
            // Validar
            if (!attendance) {
                throw new Error('Selecciona si asistirás o no');
            }
            
            if (attendance === 'yes') {
                if (!guestsCount || guestsCount < 1) {
                    throw new Error('Selecciona el número de personas que asistirán');
                }
                
                // Si hay invitación específica, verificar límite
                if (currentGuestData) {
                    const maxGuests = currentGuestData.maxGuests || 2;
                    if (parseInt(guestsCount) > maxGuests) {
                        throw new Error(`Máximo ${maxGuests} personas permitidas`);
                    }
                }
            }
            
            // Preparar datos para enviar
            const rsvpData = {
                name: name,
                attendance: attendance,
                guestsCount: attendance === 'yes' ? parseInt(guestsCount) : 0,
                note: note,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                ip: await getClientIP()
            };
            
            // Actualizar en Firebase si hay código de invitación
            if (currentInvitationCode) {
                await updateInvitationInFirebase(rsvpData);
            } else {
                // Si no hay código, solo mostrar confirmación local
                console.log("RSVP sin código de invitación:", rsvpData);
            }
            
            // Mostrar mensaje de confirmación
            showConfirmationMessage(rsvpData);
            
        } catch (error) {
            console.error("❌ Error enviando RSVP:", error);
            showErrorMessage(error.message);
        } finally {
            // Restaurar botón
            const submitBtn = rsvpForm.querySelector('.btn-submit');
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Confirmar Asistencia';
            submitBtn.disabled = false;
        }
    });
}

async function updateInvitationInFirebase(rsvpData) {
    try {
        if (!firebase.firestore) {
            console.warn("Firestore no disponible para guardar RSVP");
            return;
        }
        
        const db = firebase.firestore();
        
        if (!currentInvitationCode) {
            console.warn("No hay código de invitación para actualizar");
            return;
        }
        
        const updateData = {
            status: rsvpData.attendance === 'yes' ? 'confirmed' : 'declined',
            confirmedGuests: rsvpData.attendance === 'yes' ? rsvpData.guestsCount : 0,
            responseDate: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastResponse: rsvpData
        };
        
        // Si el usuario proporcionó nombre, actualizarlo
        if (rsvpData.name) {
            updateData.name = rsvpData.name;
        }
        
        // Si el usuario proporcionó nota, guardarla
        if (rsvpData.note) {
            updateData.note = rsvpData.note;
        }
        
        console.log("Actualizando invitación en Firebase:", {
            code: currentInvitationCode,
            data: updateData
        });
        
        // Actualizar en Firestore
        await db.collection('guests').doc(currentInvitationCode).update(updateData);
        
        // Registrar actividad
        try {
            await db.collection('logs').add({
                action: 'rsvp_updated',
                target: currentInvitationCode,
                details: {
                    name: rsvpData.name || currentGuestData?.name || 'Invitado',
                    status: updateData.status,
                    guestsCount: updateData.confirmedGuests,
                    previousStatus: currentGuestData?.status || 'pending'
                },
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                hostname: window.location.hostname,
                userAgent: navigator.userAgent
            });
            
            console.log("✅ RSVP registrado en logs de Firebase");
            
        } catch (logError) {
            console.warn("No se pudo registrar en logs:", logError);
        }
        
        console.log("✅ RSVP actualizado en Firebase correctamente");
        
        // Actualizar datos locales
        if (currentGuestData) {
            currentGuestData.status = updateData.status;
            currentGuestData.confirmedGuests = updateData.confirmedGuests;
            if (rsvpData.name) currentGuestData.name = rsvpData.name;
        }
        
    } catch (error) {
        console.error("❌ Error actualizando invitación en Firebase:", error);
        throw new Error('No se pudo guardar la confirmación. Intenta de nuevo.');
    }
}

async function getClientIP() {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip;
    } catch (error) {
        return 'unknown';
    }
}

function showConfirmationMessage(rsvpData) {
    const rsvpForm = document.getElementById('rsvp-form-container');
    if (!rsvpForm) return;
    
    let message = '';
    
    if (rsvpData.attendance === 'yes') {
        message = `
            <div class="confirmation-message">
                <div class="message-icon">
                    <i class="fas fa-check-circle"></i>
                </div>
                <h3 class="font-cinzel">¡Confirmación Exitosa!</h3>
                <p>${rsvpData.name ? `Gracias ${rsvpData.name}, ` : ''}has confirmado asistencia para ${rsvpData.guestsCount} persona${rsvpData.guestsCount > 1 ? 's' : ''}.</p>
                <p>Te esperamos el 16 de mayo de 2026.</p>
                ${rsvpData.note ? `<p class="message-note">Tu mensaje: "${rsvpData.note}"</p>` : ''}
                <p style="margin-top: 20px; font-size: 0.9rem; color: rgba(255,255,255,0.7);">
                    <i class="fas fa-info-circle"></i> Tu confirmación ha sido guardada.
                </p>
            </div>
        `;
    } else {
        message = `
            <div class="confirmation-message">
                <div class="message-icon">
                    <i class="fas fa-info-circle"></i>
                </div>
                <h3 class="font-cinzel">Confirmación Registrada</h3>
                <p>${rsvpData.name ? `Gracias ${rsvpData.name} ` : 'Gracias '}por informarnos que no podrás asistir.</p>
                <p>Lamentamos no poder contar con tu presencia.</p>
                ${rsvpData.note ? `<p class="message-note">Tu mensaje: "${rsvpData.note}"</p>` : ''}
                <p style="margin-top: 20px; font-size: 0.9rem; color: rgba(255,255,255,0.7);">
                    <i class="fas fa-info-circle"></i> Tu respuesta ha sido guardada.
                </p>
            </div>
        `;
    }
    
    rsvpForm.innerHTML = message;
    
    // Actualizar estado en la UI si hay invitación
    if (currentGuestData) {
        const guestStatusElement = document.getElementById('guest-status');
        if (guestStatusElement) {
            guestStatusElement.textContent = rsvpData.attendance === 'yes' ? 'Confirmado' : 'No asistirá';
            guestStatusElement.style.color = rsvpData.attendance === 'yes' ? '#4CAF50' : '#f44336';
        }
    }
}

function showErrorMessage(errorMessage) {
    const errorDiv = document.getElementById('error-message');
    if (!errorDiv) return;
    
    errorDiv.style.display = 'block';
    document.getElementById('error-details').textContent = errorMessage;
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

console.log("✅ Invitation JS cargado correctamente");