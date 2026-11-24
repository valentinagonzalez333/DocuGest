const form = document.getElementById('formularioRestablecer');
const passNueva = document.getElementById('passNueva');
const passConfirmar = document.getElementById('passConfirmar');
const boton = form.querySelector('button[type="submit"]');


const token = new URLSearchParams(window.location.search).get('token') || '';


if (token) history.replaceState(null, '', window.location.pathname);

const mensaje = document.createElement('p');
mensaje.setAttribute('role', 'status');
mensaje.style.cssText = 'margin:12px 0;font-size:14px;text-align:center;display:none;';
form.insertBefore(mensaje, boton);

const mostrar = (texto, ok) => {
    mensaje.textContent = texto;
    mensaje.style.color = ok ? '#1e7e34' : '#c0392b';
    mensaje.style.display = 'block';
};

if (!/^[a-f0-9]{64}$/.test(token)) {
    mostrar('El enlace no es válido o ya venció. Solicita uno nuevo.', false);
    boton.disabled = true;
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (passNueva.value.length < 8) {
        return mostrar('La contraseña debe tener al menos 8 caracteres.', false);
    }
    if (passNueva.value !== passConfirmar.value) {
        return mostrar('Las contraseñas no coinciden.', false);
    }

    boton.disabled = true;
    const textoOriginal = boton.textContent;
    boton.textContent = 'Guardando...';

    try {
        const res = await fetch('/api/recuperacion/restablecer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                passwordNueva: passNueva.value,
                passwordConfirmar: passConfirmar.value
            })
        });
        const data = await res.json().catch(() => ({}));
        mostrar(data.mensaje || 'Listo.', res.ok);

        if (res.ok) {
            form.reset();
            setTimeout(() => { window.location.href = '/'; }, 2500);
            return;
        }
    } catch (error) {
        mostrar('No se pudo conectar con el servidor. Inténtalo de nuevo.', false);
    }

    boton.disabled = false;
    boton.textContent = textoOriginal;
});