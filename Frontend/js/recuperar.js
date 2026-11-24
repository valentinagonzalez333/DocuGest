const form = document.getElementById('formularioRecuperar');
const inputCorreo = document.getElementById('correo');
const boton = form.querySelector('button[type="submit"]');


const correoUrl = new URLSearchParams(window.location.search).get('correo');
if (correoUrl) inputCorreo.value = correoUrl;


const mensaje = document.createElement('p');
mensaje.setAttribute('role', 'status');
mensaje.style.cssText = 'margin:12px 0;font-size:14px;text-align:center;display:none;';
form.insertBefore(mensaje, boton);

const mostrar = (texto, ok) => {
    mensaje.textContent = texto;
    mensaje.style.color = ok ? '#1e7e34' : '#c0392b';
    mensaje.style.display = 'block';
};

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const correo = inputCorreo.value.trim();
    if (!correo) return mostrar('Escribe tu correo.', false);

    boton.disabled = true;
    const textoOriginal = boton.textContent;
    boton.textContent = 'Enviando...';

    try {
        const res = await fetch('/api/recuperacion/solicitar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ correo })
        });
        const data = await res.json().catch(() => ({}));
        mostrar(data.mensaje || 'Solicitud enviada.', res.ok);
        if (res.ok) form.reset();
    } catch (error) {
        mostrar('No se pudo conectar con el servidor. Inténtalo de nuevo.', false);
    } finally {
        boton.disabled = false;
        boton.textContent = textoOriginal;
    }
});