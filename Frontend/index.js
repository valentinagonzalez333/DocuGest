document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formularioLogin');

    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();

        const correo = document.getElementById('correo').value.trim();
        const contrasenahash = document.getElementById('contrasena').value.trim();

        try {
            const respuesta = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ correo, contrasenahash })
            });

            const datos = await respuesta.json();

            if (respuesta.ok) {
                alert('¡Login exitoso! Bienvenido, ' + datos.usuario.nombre);
                localStorage.setItem('usuario', JSON.stringify({ ...datos.usuario, token: datos.token }));
                setTimeout(() => { window.location.href = '/html/panel.html'; }, 700);
            } else {
                alert(datos.mensaje || 'Correo o contraseña incorrectos.');
            }

        } catch (error) {
            console.error('Error de red:', error);
            alert('No se pudo conectar con el servidor.');
        }
    });
});