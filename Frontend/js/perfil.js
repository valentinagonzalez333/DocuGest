document.addEventListener('DOMContentLoaded', async () => {
    const usuarioGuardado = localStorage.getItem('usuario');
    if (!usuarioGuardado) { window.location.href = '/'; return; }

    let usuario = JSON.parse(usuarioGuardado);
    const currentUserId = usuario._id || usuario.id;
    const $ = (id) => document.getElementById(id);




    try {
        const r = await fetch(`/api/usuarios/perfil/${currentUserId}`, { headers: { 'usuario-id': currentUserId } });
        if (r.ok) {
            const { usuario: fresco } = await r.json();
            usuario = { ...usuario, ...fresco };
            localStorage.setItem('usuario', JSON.stringify(usuario));
        }
    } catch (e) {
        console.error('No se pudo refrescar el perfil:', e);
    }

    const esAdmin = usuario.rol === 'admin_empresa';
    const rolTexto = esAdmin ? 'Administrador' : 'Colaborador';




    $('nombreEmpresa').textContent = usuario.nombreEmpresa || 'DocuGets';
    $('userNombre').textContent = usuario.nombre;
    $('userRol').textContent = rolTexto;
    $('saludoHeader').textContent = `Welcome, ${usuario.nombre}`;
    if (esAdmin) $('seccionAdmin').style.display = 'block';

    $('btnCerrarSesion').addEventListener('click', () => {
        localStorage.removeItem('usuario');
        window.location.href = '/';
    });





    $('perfilNombre').textContent = usuario.nombre || '—';
    $('perfilCorreo').textContent = usuario.correo || '—';
    $('perfilRol').textContent = rolTexto;
    $('perfilEmpresa').textContent = usuario.nombreEmpresa || '—';
    $('perfilCreada').textContent = usuario.createdAt
        ? new Date(usuario.createdAt).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })
        : '—';

    if (!esAdmin) {
        const p = usuario.permisos || {};
        const fmt = (lista) => (lista && lista.length ? lista.join(', ') : 'ninguno');
        $('perfilPermisos').innerHTML =
           `Documentos: ${fmt(p.documentos)}<br>Compromisos: ${fmt(p.compromisos)}`
                .replace(/_/g, ' ');
        $('filaPermisos').style.display = 'flex';
    }

    if (usuario.cambiarPassword) $('avisoCambio').style.display = 'block';






    const mensaje = $('mensajePerfil');
    const mostrar = (texto, ok) => {
        mensaje.textContent = texto;
        mensaje.style.display = 'block';
        mensaje.style.background = ok ? '#dcfce7' : '#fee2e2';
        mensaje.style.color = ok ? '#166534' : '#b91c1c';
    };

    $('formPassword').addEventListener('submit', async (e) => {
        e.preventDefault();
        mensaje.style.display = 'none';



        const passwordActual = $('passActual').value.trim();
        const passwordNueva = $('passNueva').value.trim();
        const passwordConfirmar = $('passConfirmar').value.trim();

        if (!passwordActual) return mostrar('Ingresa tu contraseña actual.', false);
        if (passwordNueva.length < 8) return mostrar('La nueva contraseña debe tener al menos 8 caracteres.', false);
        if (passwordNueva !== passwordConfirmar) return mostrar('La confirmación no coincide con la nueva contraseña.', false);
        if (passwordNueva === passwordActual) return mostrar('La nueva contraseña debe ser distinta de la actual.', false);

        const boton = $('btnCambiarPass');
        boton.disabled = true;

        try {
            const res = await fetch('/api/usuarios/cambiar-password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'usuario-id': currentUserId },
                body: JSON.stringify({ usuarioId: currentUserId, passwordActual, passwordNueva, passwordConfirmar })
            });
            const data = await res.json();

            if (res.ok) {
                mostrar(data.mensaje || 'Contraseña actualizada con éxito.', true);
                $('formPassword').reset();
                usuario.cambiarPassword = false;
                localStorage.setItem('usuario', JSON.stringify(usuario));
                $('avisoCambio').style.display = 'none';
            } else {
                mostrar(data.mensaje || 'No se pudo cambiar la contraseña.', false);
            }
        } catch (error) {
            console.error(error);
            mostrar('Error de conexión con el servidor.', false);
        } finally {
            boton.disabled = false;
        }
    });
});