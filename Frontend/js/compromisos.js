const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

document.addEventListener('DOMContentLoaded', async () => {
    const usuarioGuardado = localStorage.getItem('usuario');
    if (!usuarioGuardado) { window.location.href = '/'; return; }

    let usuario = JSON.parse(usuarioGuardado);
    const currentUserId = usuario._id || usuario.id;

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
    const permisosComp = (usuario.permisos?.compromisos || []).map(p => String(p).toLowerCase().trim());
    const tienePermiso = (accion) => esAdmin || permisosComp.includes(accion);

    const $ = (id) => document.getElementById(id);
    const headersAuth = { 'usuario-id': currentUserId };

    const fmtFecha = (f) => new Date(f).toLocaleDateString('es-CO', { timeZone: 'UTC' });
    const fechaInput = (f) => (f ? String(f).slice(0, 10) : '');
    const atributosBusqueda = (a) =>
    `data-estado="${esc(a.estado)}" data-area="${esc(a.areaResponsable)}" data-creador="${esc(a.creadoPor?.nombre || 'Desconocido')}" ` +
    `data-firmantes="${esc((a.firmantes || []).join('|'))}" data-archivos="${a.archivos?.length ? 'con' : 'sin'}" ` +
    `data-fecha="${esc(fechaInput(a.fechaLimite))}" data-creado="${esc(a.createdAt || '')}" data-cons="${esc(a.consecutivo)}" data-titulo="${esc(a.titulo)}"`;
    const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    $('nombreEmpresa').textContent = usuario.nombreEmpresa || 'DocuGets';
    $('userNombre').textContent = usuario.nombre;
    $('userRol').textContent = esAdmin ? 'Administrador' : 'Colaborador';
    $('saludoHeader').textContent = `Welcome, ${usuario.nombre}`;
    if (esAdmin && $('seccionAdmin')) $('seccionAdmin').style.display = 'block';

    $('btnCerrarSesion').addEventListener('click', () => {
        localStorage.removeItem('usuario');
        window.location.href = '/';
    });

    const tbody = $('tablaCompromisosBody');
    const formContainer = $('formCompromisoContainer');
    const btnAbrir = $('btnAbrirModalCompromiso');
    const btnCancelar = $('btnCancelarCompromiso');
    const form = $('compromisoForm');
    const inputId = $('compromisoIdEdicion');

    let fechaOriginal = ''; // fecha límite del acta que se está editando

    if (btnAbrir) btnAbrir.style.display = tienePermiso('crear') ? 'inline-block' : 'none';

    // Modos del formulario 
    const modoCrear = () => {
        form.reset();
        inputId.value = '';
        fechaOriginal = '';
        $('tituloFormCompromiso').textContent = 'Registrar Nueva Acta';
        $('campoEstado').style.display = 'none';
        $('notaEstado').style.display = 'none';
        $('archivosActualesActa').innerHTML = '';
        $('fechaLimite').min = hoyBogota();
    };

    btnAbrir.addEventListener('click', () => {
        modoCrear();
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth' });
    });

    btnCancelar.addEventListener('click', () => {
        formContainer.style.display = 'none';
        modoCrear();
    });

    // Tabla
    const colorEstado = {
        pendiente: ['#fef3c7', '#92400e'],
        en_proceso: ['#e0f2fe', '#0369a1'],
        completado: ['#dcfce7', '#166534'],
        vencido: ['#fee2e2', '#b91c1c']
    };
    const nombreEstado = { pendiente: 'Pendiente', en_proceso: 'En proceso', completado: 'Completado', vencido: 'Vencido' };

    const cargarActas = async () => {
        try {
            const res = await fetch(`/api/compromisos/${usuario.empresaId}`, { headers: headersAuth });
            const data = await res.json();

            if (!res.ok) {
                tbody.innerHTML = `<tr><td colspan="9" style="padding:30px; text-align:center; color:#ef4444;">${esc(data.mensaje || 'Error al cargar datos.')}</td></tr>`;
                return;
            }
            if (!data.actas.length) {
                window.listaActasCache = [];
                tbody.innerHTML = `<tr><td colspan="9" style="padding:30px; text-align:center; color:#64748b;">No hay actas registradas.</td></tr>`;
                return;
            }

            window.listaActasCache = data.actas;

            tbody.innerHTML = data.actas.map(a => {
                const [bg, fg] = colorEstado[a.estado] || colorEstado.pendiente;
                const archivos = a.archivos?.length
                    ? a.archivos.map(f => `<a href="/uploads/${encodeURIComponent(f.ruta)}" target="_blank" style="color:#0ea5e9; display:block; font-size:0.8rem;">📎 ${esc(f.nombreOriginal)}</a>`).join('')
                    : '<span style="color:#94a3b8; font-size:0.8rem;">Sin archivos</span>';
                const editor = a.editadoPor?.nombre
                    ? `<div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">Editado por ${esc(a.editadoPor.nombre)}</div>` : '';
                const boton = tienePermiso('editar')
                    ? `<button onclick="abrirEdicionActa('${esc(a._id)}')" style="background:#f59e0b; color:white; border:none; padding:5px 8px; border-radius:4px; cursor:pointer; font-size:0.75rem;">Editar</button>`
                    : '<span style="color:#94a3b8; font-size:0.8rem;">Solo lectura</span>';

                return `
                <tr ${atributosBusqueda(a)} style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding:12px 15px; font-weight:600; color:#0284c7;">${esc(a.consecutivo)}</td>
                    <td style="padding:12px 15px; color:#1e293b;">${esc(a.titulo)}</td>
                    <td style="padding:12px 15px; color:#475569;">${esc(a.areaResponsable)}</td>
                    <td style="padding:12px 15px; color:#475569;">${esc(a.creadoPor?.nombre || 'Desconocido')}</td>
                    <td style="padding:12px 15px; color:#475569; font-size:0.85rem;">${esc((a.firmantes || []).join(', ') || '—')}</td>
                    <td style="padding:12px 15px; color:#475569;">${fmtFecha(a.fechaLimite)}</td>
                    <td style="padding:12px 15px;">
                        <span style="padding:4px 8px; background:${bg}; color:${fg}; border-radius:4px; font-size:0.8rem; font-weight:600;">${nombreEstado[a.estado]}</span>
                        ${editor}
                    </td>
                    <td style="padding:12px 15px;">${archivos}</td>
                    <td style="padding:12px 15px;">${boton}</td>
                </tr>`;
            }).join('');
        } catch (error) {
            console.error(error);
            tbody.innerHTML = `<tr><td colspan="9" style="padding:30px; text-align:center; color:#ef4444;">Error al cargar datos.</td></tr>`;
        }
    };


    Buscador.crear({
    tbody,
    nombre: 'actas',
    placeholder: 'Buscar por consecutivo, título, área, firmante, creador o nombre de archivo…',
    ordenOriginal: 'Fecha límite (la más próxima primero)',
    filtros: [
        { clave: 'estado', etiqueta: 'Estado', fijas: [['pendiente', 'Pendiente'], ['en_proceso', 'En proceso'], ['completado', 'Completado'], ['vencido', 'Vencido']] },
        { clave: 'area', etiqueta: 'Área' },
        { clave: 'creador', etiqueta: 'Creado por' },
        { clave: 'firmantes', etiqueta: 'Firmante', multi: true },
        { clave: 'archivos', etiqueta: 'Archivos', fijas: [['con', 'Con archivos'], ['sin', 'Sin archivos']] }
    ],
    ventana: { clave: 'fecha', etiqueta: 'Vencimiento', etiquetaPasada: 'Ya venció', ignorar: (tr) => tr.dataset.estado === 'completado' },
    fecha: { clave: 'fecha', etiqueta: 'Fecha límite' },
    orden: [
        { valor: 'lejana', etiqueta: 'Fecha límite (la más lejana primero)', clave: 'fecha', dir: -1 },
        { valor: 'cons', etiqueta: 'Consecutivo', clave: 'cons', dir: 1 },
        { valor: 'titulo', etiqueta: 'Título (A-Z)', clave: 'titulo', dir: 1 },
        { valor: 'nuevas', etiqueta: 'Creadas más recientemente', clave: 'creado', dir: -1 }
    ]
});


    await cargarActas();




    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = inputId.value;
        const fecha = $('fechaLimite').value;

        if (id) {
            const a = window.listaActasCache?.find(x => x._id === id);
            const estadoNuevo = $('estadoCompromiso').value;

          
            if (fecha !== fechaOriginal && fecha < hoyBogota()) {
                alert('La fecha límite no puede ser anterior a hoy.');
                return;
            }
            
            if (a && estadoNuevo !== a.estadoGuardado && estadoNuevo !== 'completado' && fecha < hoyBogota()) {
                alert('Un acta vencida solo puede marcarse como completada, o debes ampliar la fecha límite.');
                return;
            }
        }

        const fd = new FormData();
        fd.append('titulo', $('tituloActa').value);
        fd.append('areaResponsable', $('areaActa').value);
        fd.append('firmantes', $('firmantesActa').value);
        fd.append('fechaLimite', fecha);
        for (const f of $('archivosActa').files) fd.append('archivos', f);

        if (id) {
            fd.append('estado', $('estadoCompromiso').value);
            const idsAEliminar = Array.from(document.querySelectorAll('input[name="eliminarArchivoActa"]:checked')).map(cb => cb.value);
            if (idsAEliminar.length) fd.append('archivosAEliminar', JSON.stringify(idsAEliminar));
        }

        try {
            const res = await fetch(id ? `/api/compromisos/${id}` : '/api/compromisos', {
                method: id ? 'PUT' : 'POST',
                headers: headersAuth,
                body: fd
            });
            const data = await res.json();

            if (res.ok) {
                alert(data.mensaje);
                formContainer.style.display = 'none';
                modoCrear();
                cargarActas();
            } else {
                alert(`Error: ${data.mensaje}`);
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión.');
        }
    });

    // Editar
    window.abrirEdicionActa = (id) => {
        const a = window.listaActasCache?.find(x => x._id === id);
        if (!a) return;

        form.reset();
        inputId.value = a._id;
        fechaOriginal = fechaInput(a.fechaLimite);

        $('tituloFormCompromiso').textContent = `Editar acta (${a.consecutivo})`;
        $('tituloActa').value = a.titulo;
        $('areaActa').value = a.areaResponsable;
        $('firmantesActa').value = (a.firmantes || []).join(', ');
        $('fechaLimite').value = fechaOriginal;

        
        if (fechaOriginal >= hoyBogota()) $('fechaLimite').min = hoyBogota();
        else $('fechaLimite').removeAttribute('min');

        $('campoEstado').style.display = 'block';
        $('estadoCompromiso').value = a.estadoGuardado || a.estado;
        $('notaEstado').style.display = a.estado === 'vencido' ? 'block' : 'none';

        $('archivosActualesActa').innerHTML = a.archivos?.length
            ? `
                <label style="display:block; font-weight:500; color:#475569; margin:10px 0 5px;">Archivos actuales (marca los que quieras quitar; para agregar más usa el selector de arriba):</label>
                <div style="display:flex; flex-direction:column; gap:5px;">
                    ${a.archivos.map(f => `
                        <label style="font-size:0.85rem; color:#1e293b; display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" name="eliminarArchivoActa" value="${esc(f._id)}">
                            Quitar: <a href="/uploads/${encodeURIComponent(f.ruta)}" target="_blank" style="color:#0ea5e9;">${esc(f.nombreOriginal)}</a>
                        </label>`).join('')}
                </div>`
            : '<p style="font-size:0.85rem; color:#94a3b8; margin-top:8px;">Esta acta no tiene archivos adjuntos.</p>';

        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth' });
    };
});