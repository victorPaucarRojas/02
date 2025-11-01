// Variables globales (por pestaña)
let username = sessionStorage.getItem('username') || '';
let ws = null;

// Función para inicializar la conexión WebSocket
function initWebSocket() {
    // Verificar si el usuario está autenticado
    if (!username) {
        // Si no hay usuario, mostrar el modal de registro
        const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
        registerModal.show();
        return;
    }

    // Crear conexión WebSocket con protocolo correcto
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/${encodeURIComponent(username)}`);
    
    // Evento cuando se abre la conexión
    ws.onopen = function(e) {
        console.log('Conexión establecida');
        loadHistory();
    };
    
    // Evento cuando se recibe un mensaje
    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        
        if (data.type === 'users_update') {
            // Actualizar contador de usuarios conectados
            document.getElementById('usersCount').textContent = data.count;
            // Cargar lista completa de usuarios registrados desde la BD
            loadAllUsers();
        } else if (data.type === 'message') {
            // Mostrar mensaje recibido
            displayMessage(data);
            // Desplazar al último mensaje
            const messagesContainer = document.getElementById('messages');
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    };
    
    // Evento cuando se cierra la conexión
    ws.onclose = function(event) {
        if (event.wasClean) {
            console.log(`Conexión cerrada limpiamente, código=${event.code} motivo=${event.reason}`);
        } else {
            console.log('Conexión interrumpida');
            // Intentar reconectar después de un tiempo
            setTimeout(initWebSocket, 5000);
        }
    };
    
    // Evento en caso de error
    ws.onerror = function(error) {
        console.log(`Error: ${error.message}`);
    };
}

// Función para cargar el historial de mensajes
function loadHistory() {
    fetch('/messages/')
        .then(response => response.json())
        .then(messages => {
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = '';
            
            messages.forEach(msg => {
                displayMessage(msg);
            });
            
            // Desplazar al último mensaje
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        })
        .catch(error => console.error('Error al cargar mensajes:', error));
}

// Cargar todos los usuarios registrados desde la API
function loadAllUsers() {
    fetch('/users/')
        .then(response => response.json())
        .then(data => {
            if (data && Array.isArray(data.users)) {
                loadUsers(data.users);
            }
        })
        .catch(err => console.error('Error al cargar usuarios:', err));
}

// Función para cargar la lista de usuarios
function loadUsers(users) {
    const usersList = document.getElementById('usersList');
    usersList.innerHTML = '';
    
    users.forEach(user => {
        const userElement = document.createElement('div');
        userElement.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        userElement.innerHTML = `
            <div>
                <div class="fw-bold">${user}</div>
                <small class="text-muted">En línea</small>
            </div>
            <span class="badge bg-success rounded-pill">●</span>
        `;
        
        usersList.appendChild(userElement);
    });
}

// Función para mostrar un mensaje en el chat
function displayMessage(message) {
    const messagesContainer = document.getElementById('messages');
    const messageElement = document.createElement('div');
    
    // Determinar si el mensaje es propio o de otro usuario
    const isOwnMessage = message.username === username;
    messageElement.className = `bubble ${isOwnMessage ? 'me' : 'other'}`;
    
    // Formatear la fecha
    const date = new Date(message.timestamp);
    const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Contenido del mensaje
    messageElement.innerHTML = `
        ${!isOwnMessage ? `<div class="fw-bold">${message.username}</div>` : ''}
        <div>${message.content}</div>
        <small class="text-muted d-block text-end">${formattedTime}</small>
    `;
    
    messagesContainer.appendChild(messageElement);
}

// Función para enviar un mensaje
function sendMessage(e) {
    e.preventDefault();
    
    const input = document.getElementById('messageInput');
    const message = input.value.trim();
    
    if (message && ws && ws.readyState === WebSocket.OPEN) {
        // Enviar mensaje al servidor
        ws.send(JSON.stringify({
            content: message
        }));
        
        // Limpiar el campo de entrada
        input.value = '';
        input.focus();
    }
}

// Función para registrar un nuevo usuario
function registerUser(e) {
    e.preventDefault();
    
    const usernameInput = document.getElementById('username');
    const username = usernameInput.value.trim();
    
    if (!username) {
        alert('Por favor ingresa un nombre');
        return;
    }
    
    // Registrar usuario en la BD (maneja nombre repetido)
    fetch('/users/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    }).then(async (resp) => {
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok && data && data.error === 'username_exists') {
            alert('Ese nombre ya existe. Elige otro.');
            return Promise.reject();
        }
        if (!resp.ok) {
            alert('No se pudo registrar el usuario');
            return Promise.reject();
        }

        sessionStorage.setItem('username', username);
        window.username = username;

        // Habilitar input de mensaje
        const input = document.getElementById('messageInput');
        if (input) input.disabled = false;

        // Cerrar el modal
        const registerModal = bootstrap.Modal.getInstance(document.getElementById('registerModal'));
        registerModal.hide();
        
        // Cargar usuarios y abrir WS
        loadAllUsers();
        initWebSocket();
    }).catch(() => {});
}

// Función para cerrar sesión
function logout() {
    if (confirm('¿Seguro que deseas cerrar sesión?')) {
        // Cerrar conexión WebSocket
        if (ws) {
            ws.close();
        }
        
        // Eliminar datos de sesión (solo esta pestaña)
        sessionStorage.removeItem('username');
        username = '';
        
        // Recargar la página
        window.location.reload();
    }
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar conexión WebSocket
    initWebSocket();
    // Cargar usuarios registrados
    loadAllUsers();
    
    // Evento para enviar mensaje
    const form = document.getElementById('messageForm');
    if (form) form.addEventListener('submit', sendMessage);
    
    // Evento para registrar usuario
    const rform = document.getElementById('registerForm');
    if (rform) rform.addEventListener('submit', registerUser);
    
    // Evento para cerrar sesión
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // Deshabilitar input si no hay username aún
    const input = document.getElementById('messageInput');
    if (input && !username) input.disabled = true;
});