const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

document.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem('usuario');

    if (!usuarioGuardado) {
        window.location.href = '/';
        return;
    }

    const usuario = JSON.parse(usuarioGuardado);
    const currentUserId = usuario._id || usuario.id;

    const spanNombreEmpresa = document.getElementById('nombreEmpresa');
    const userNombre = document.getElementById('userNombre');
    const userRol = document.getElementById('userRol');
    const saludoHeader = document.getElementById('saludoHeader');
    const btnCerrarSesion = document.getElementById('btnCerrarSesion');
    const tituloSeccion = document.getElementById('tituloSeccion');
    const seccionAdmin = document.getElementById('seccionAdmin');

    userNombre.textContent = usuario.nombre;
    saludoHeader.textContent = `Welcome, ${usuario.nombre}`;
    userRol.textContent = usuario.rol === 'admin_empresa' ? 'Administrador' : 'Colaborador';

    if (usuario.nombreEmpresa) {
        spanNombreEmpresa.textContent = usuario.nombreEmpresa;
    } else {
        spanNombreEmpresa.textContent = 'DocuGets';
    }

    if (usuario.rol === 'admin_empresa' && seccionAdmin) {
        seccionAdmin.style.display = 'block';
    }

    if (btnCerrarSesion) {
        btnCerrarSesion.addEventListener('click', () => {
            localStorage.removeItem('usuario');
            alert('Sesión cerrada correctamente.');
            window.location.href = '/';
        });
    }

    const menuLinks = document.querySelectorAll('.menu a');

    menuLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            if (href === '#' || href === '') {
                e.preventDefault();

                menuLinks.forEach(l => {
                    l.classList.remove('menu-activo');
                    l.classList.add('menu-item');
                });

                link.classList.remove('menu-item');
                link.classList.add('menu-activo');

                const seccion = link.getAttribute('data-seccion');
                if (tituloSeccion) {
                    if (seccion === 'dashboard') tituloSeccion.textContent = 'Dashboard';
                    if (seccion === 'compromisos') tituloSeccion.textContent = 'Compromisos & Actas';
                    if (seccion === 'empleados') tituloSeccion.textContent = 'Expedientes Laborales';
                    if (seccion === 'usuarios') tituloSeccion.textContent = 'Usuarios y Permisos';
                }
            }
        });
    });

    

    
    const $ = (id) => document.getElementById(id);

    const mostrarCard = (idCard, idNumero, valor) => {
        if (valor === null || valor === undefined) return;
        $(idNumero).textContent = valor;
        $(idCard).hidden = false;
    };

    const fmtFecha = (iso) => {
        const [a, m, d] = iso.split('-');
        return `${d}/${m}/${a}`;
    };

    const textoDias = (d) => {
        if (d < 0) return d === -1 ? 'Venció ayer' : `Venció hace ${-d} días`;
        if (d === 0) return 'Vence hoy';
        if (d === 1) return 'Vence mañana';
        return `Vence en ${d} días`;
    };

    const claseDias = (d) => (d < 0 ? 'vencida' : d <= 3 ? 'pronto' : 'normal');

    const pintarProximas = (c) => {
        const lista = $('listaProximas');

        if (!c.proximas.length) {
            lista.innerHTML = '<li class="vacio">No tienes actas por vencer en los próximos días.</li>';
        } else {
            lista.innerHTML = c.proximas.map(a => `
                <li>
                    <span class="prox-cons">${esc(a.consecutivo)}</span>
                    <span class="prox-info">
                        <span class="prox-titulo">${esc(a.titulo)}</span>
                        <span class="prox-area">${esc(a.areaResponsable)} · ${fmtFecha(a.fechaLimite)}</span>
                    </span>
                    <span class="dias ${claseDias(a.dias)}">${textoDias(a.dias)}</span>
                </li>`).join('');

            const restantes = c.proximasTotal - c.proximas.length;
            if (restantes > 0) {
                lista.innerHTML += `<li class="vacio">Y ${restantes} más. Revisa el listado completo en Compromisos & Actas.</li>`;
            }
        }
        $('panelProximas').hidden = false;
    };

    const cargarResumen = async () => {
        try {
            const res = await fetch(`/api/dashboard/${usuario.empresaId}`, {
                headers: { 'usuario-id': currentUserId }
            });
            const data = await res.json();

            if (!res.ok) {
                alert(data.mensaje || 'No se pudo cargar el resumen del panel.');
                return;
            }

            if (data.compromisos) {
                mostrarCard('cardPendientes', 'numPendientes', data.compromisos.pendientes);
                mostrarCard('cardVencidas', 'numVencidas', data.compromisos.vencidas);
                $('cardVencidas').classList.toggle('peligro', data.compromisos.vencidas > 0);
                pintarProximas(data.compromisos);
            }

            if (data.empleados) {
                mostrarCard('cardEmpleados', 'numEmpleados', data.empleados.activos);
                mostrarCard('cardExpedientes', 'numExpedientes', data.empleados.expedientes);
                mostrarCard('cardContratos', 'numContratos', data.empleados.contratosPorVencer);
            }

            if (data.memorandos) {
                const propios = data.memorandos.alcance === 'propios';
                $('tituloMemos').textContent = propios ? 'Memorandos por firmar' : 'Memorandos sin firmar';
                $('subMemos').textContent = propios ? 'Dirigidos a ti' : 'Pendientes de firma de los empleados';
                $('cardMemos').href = propios ? '/empleados' : '/documentos';
                mostrarCard('cardMemos', 'numMemos', data.memorandos.pendientesFirma);
                $('cardMemos').classList.toggle('peligro', data.memorandos.pendientesFirma > 0);
            }
        } catch (error) {
            console.error('Error al cargar el resumen:', error);
            alert('No se pudo conectar con el servidor.');
        }
    };

    cargarResumen();
});