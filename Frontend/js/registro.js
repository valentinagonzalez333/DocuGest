document.addEventListener('DOMContentLoaded', () => {
    const formulario = document.getElementById('formularioRegistro');

    formulario.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = document.getElementById('nombre').value.trim();
        const nombreEmpresa = document.getElementById('nombre-empresa').value.trim();
        const correo = document.getElementById('correo').value.trim();
        const contrasena = document.getElementById('contrasena').value;
        const contrasenaConfirmar = document.getElementById('contrasenaConfirmar').value;

        
        if (contrasena !== contrasenaConfirmar) {
            alert('Las contraseñas no coinciden. Por favor verifícalas.');
            return;
        }

        if (contrasena.length < 8) {
            alert('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        try {
            const respuesta = await fetch('/api/registro', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    nombre,
                    'nombre-empresa': nombreEmpresa,
                    correo,
                    contrasena,
                    contrasenaConfirmar
                })
            });

            const datos = await respuesta.json();

            if (respuesta.ok) {
                alert('¡Empresa y cuenta creadas con éxito! Redirigiendo al inicio de sesión...');
                window.location.href = '/'; 
            } else {
                alert(datos.mensaje || 'Ocurrió un problema al registrar la empresa.');
            }

        } catch (error) {
            console.error('Error al conectar con el servidor:', error);
            alert('No se pudo conectar con el servidor.');
        }
    });
});