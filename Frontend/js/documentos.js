const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));


const nombresFirmantes = (doc) => {
    const vistos = new Set();
    const lista = [];
    [...(doc.firmantesInvolucrados || []), ...(doc.firmas || []).map(f => f.nombre)].forEach(n => {
        const limpio = String(n ?? '').trim();
        const clave = limpio.toLowerCase();
        if (limpio && !vistos.has(clave)) {
            vistos.add(clave);
            lista.push(limpio);
        }
    });
    return lista;
};

const extension = (n) => { const m = /\.([A-Za-z0-9]+)$/.exec(n || ''); return m ? m[1].toLowerCase() : ''; };
const recortar = (t, max) => { const s = String(t || '').replace(/\s+/g, ' ').trim(); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
const fechaBogota = (f) => f ? new Date(f).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }) : '';

const atributosBusqueda = (doc) => {
    const archivos = doc.archivos || [];
    const formatos = [...new Set(archivos.map(a => extension(a.nombreOriginal)).filter(Boolean))];
    const firma = doc.tipoDocumento === 'memorando' ? ((doc.firmas || []).length ? 'firmado' : 'sin_firma') : '';
    const extra = [
        doc.descripcion, `v${doc.version || 1}`, doc.editadoPor?.nombre, doc.pendiente?.editadoPor?.nombre,
        doc.pendiente ? 'cambio pendiente revision' : '',
        firma === 'sin_firma' ? 'sin firmar pendiente de firma' : firma === 'firmado' ? 'firmado' : ''
    ].filter(Boolean).join(' ');
    return `data-q="${esc(extra)}" data-tipo="${esc(doc.tipoDocumento)}" data-area="${esc(doc.areaResponsable)}" ` +
        `data-creador="${esc(doc.creadoPor?.nombre || 'Desconocido')}" data-archivos="${archivos.length ? 'con' : 'sin'}" ` +
        `data-formato="${esc(formatos.join('|'))}" data-cambio="${doc.pendiente ? 'pendiente' : 'ninguno'}" ` +
        `data-firma="${firma}" data-fecha="${esc(fechaBogota(doc.createdAt))}" data-cons="${esc(doc.consecutivo)}" data-titulo="${esc(doc.titulo)}"`;
};

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
    if (!esAdmin) document.getElementById('optMemorando')?.remove();
    const permisosDocs = (usuario.permisos?.documentos || []).map(p => String(p).toLowerCase().trim());
    const tienePermiso = (accion) => esAdmin || permisosDocs.includes(accion.toLowerCase());

    const $ = (id) => document.getElementById(id);
    const headersAuth = { 'usuario-id': currentUserId };
    const headersJson = { 'Content-Type': 'application/json', 'usuario-id': currentUserId };
    const fmtFecha = (f) => f ? new Date(f).toLocaleString() : '';

    if ($('userNombre')) $('userNombre').textContent = usuario.nombre;
    if ($('saludoHeader')) $('saludoHeader').textContent = `Welcome, ${usuario.nombre}`;
    if ($('userRol')) $('userRol').textContent = esAdmin ? 'Administrador' : 'Colaborador';
    if ($('nombreEmpresa')) $('nombreEmpresa').textContent = usuario.nombreEmpresa || 'DocuGets';
    if (esAdmin && $('seccionAdmin')) $('seccionAdmin').style.display = 'block';

    const tbody = $('tablaDocumentosBody');
    const btnAbrirModal = $('btnAbrirModal');
    const formContainer = $('formNuevoDocumento');
    const crearDocForm = $('crearDocForm');
    const inputDocId = $('documentoIdEdicion');

    if (btnAbrirModal) btnAbrirModal.style.display = tienePermiso('crear') ? 'inline-block' : 'none';

    $('btnCerrarSesion')?.addEventListener('click', () => {
        localStorage.removeItem('usuario');
        window.location.href = '/';
    });

    btnAbrirModal?.addEventListener('click', () => {
        inputDocId.value = '';
        $('tituloFormulario').textContent = 'Registrar Nuevo Documento';
        crearDocForm.reset();
        tipoSelect.disabled = false;
        selectEmpleado.disabled = false;
        alternarEmpleado();
        $('archivosActualesEdicion').innerHTML = '';
        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth' });
    });

    $('btnCancelarDoc')?.addEventListener('click', () => {
        formContainer.style.display = 'none';
        crearDocForm.reset();
        inputDocId.value = '';
    });

    const tipoSelect = $('tipoDocumento');
    const bloqueEmpleado = $('bloqueEmpleadoMemo');
    const selectEmpleado = $('empleadoMemo');

    const alternarEmpleado = () => {
        const esMemo = tipoSelect.value === 'memorando';
        bloqueEmpleado.style.display = esMemo ? 'block' : 'none';
        selectEmpleado.required = esMemo;
    };
    tipoSelect.addEventListener('change', alternarEmpleado);

    

    if (esAdmin) {
        try {
            const r = await fetch(`/api/empleados/empresa/${usuario.empresaId}`, { headers: headersAuth });
            const d = await r.json();
            if (r.ok) {
                const destinatarios = d.empleados.filter(e => String(e.usuarioId) !== String(currentUserId));
                selectEmpleado.innerHTML = '<option value="">— Selecciona empleado —</option>' +
                    destinatarios.map(e => `<option value="${esc(e._id)}">${esc(e.nombres)} ${esc(e.apellidos)}</option>`).join('');
            }
        } catch (e) { console.error(e); }
    }

    const obtenerDocumentos = async () => {
        if (!tbody) return;
        try {
            const respuesta = await fetch(`/api/documentos/${usuario.empresaId}`, { headers: headersAuth });
            const datos = await respuesta.json();

            if (!respuesta.ok) {
                tbody.innerHTML = `<tr><td colspan="9" style="padding: 30px; text-align: center; color: #ef4444;">${esc(datos.mensaje || 'Error al cargar documentos.')}</td></tr>`;
                return;
            }

            if (!datos.documentos || datos.documentos.length === 0) {
                tbody.innerHTML = `<tr><td colspan="9" style="padding: 30px; text-align: center; color: #64748b;">No hay documentos registrados todavía.</td></tr>`;
                return;
            }

            window.listaDocumentosCache = datos.documentos;

            tbody.innerHTML = datos.documentos.map(doc => {
                const listaArchivos = doc.archivos?.length
                    ? doc.archivos.map(a => `<a href="/uploads/${encodeURIComponent(a.ruta)}" target="_blank" style="color: #0ea5e9; text-decoration: underline; display: block; font-size: 0.8rem;">📎 ${esc(a.nombreOriginal)}</a>`).join('')
                    : '<span style="color: #94a3b8; font-size: 0.8rem;">Sin archivos</span>';

                let botones = '';
                if (doc.pendiente) {
                    botones += esAdmin
                        ? `<button onclick="abrirRevision('${esc(doc._id)}')" style="background: #8b5cf6; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; margin-right: 5px;">Revisar cambio</button>`
                        : `<span style="font-size: 0.75rem; color: #b45309; margin-right: 5px;">Cambio en revisión</span>`;
                } else if (tienePermiso('editar')) {
                    botones += `<button onclick="abrirFormularioEdicion('${esc(doc._id)}')" style="background: #f59e0b; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; margin-right: 5px;">Editar</button>`;
                }
                botones += `<button onclick="verHistorial('${esc(doc.consecutivo)}', '${esc(doc.empresaId)}')" style="background: #3b82f6; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">Historial</button>`;

                const firmantes = nombresFirmantes(doc);
                const listaFirmantes = firmantes.length
                    ? esc(firmantes.join(', '))
                    : '<span style="color: #94a3b8; font-size: 0.8rem;">Sin firmantes</span>';

                const badgePendiente = doc.pendiente
                    ? `<div style="margin-top: 4px; padding: 3px 6px; background: #fef3c7; color: #92400e; border-radius: 4px; font-size: 0.7rem; font-weight: 600;">Cambio de ${esc(doc.pendiente.editadoPor?.nombre || 'alguien')} pendiente</div>`
                    : '';

                return `
                   <tr ${atributosBusqueda(doc)} style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 12px 15px; font-weight: 600; color: #0284c7;">${esc(doc.consecutivo)}</td>
                        <td style="padding: 12px 15px; text-transform: uppercase; font-size: 0.85rem;">${esc(doc.tipoDocumento)}</td>
                        <td style="padding: 12px 15px; color: #1e293b; font-weight: 500;">${esc(doc.titulo)}${doc.descripcion ? `<span class="sub">${esc(recortar(doc.descripcion, 110))}</span>` : ''}</td>
                        <td style="padding: 12px 15px; color: #475569; font-size: 0.85rem;">${esc(doc.areaResponsable)}</td>
                        <td style="padding: 12px 15px; color: #334155; font-size: 0.85rem;">${esc(doc.creadoPor?.nombre || 'Desconocido')}</td>
                        <td style="padding: 12px 15px; color: #475569; font-size: 0.85rem;">${listaFirmantes}</td>
                        <td style="padding: 12px 15px;">
                            <span style="padding: 4px 8px; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">${esc(doc.estado)}</span>
                            ${badgePendiente}
                        </td>
                        <td style="padding: 12px 15px;">${listaArchivos}</td>
                        <td style="padding: 12px 15px;">${botones}</td>
                    </tr>`;
            }).join('');
        } catch (error) {
            console.error('Error al cargar documentos:', error);
            tbody.innerHTML = `<tr><td colspan="9" style="padding: 30px; text-align: center; color: #ef4444;">Error al conectar con el servidor.</td></tr>`;
        }
    };

    Buscador.crear({
    tbody,
    nombre: 'documentos',
    placeholder: 'Buscar por consecutivo, título, descripción, área, firmante, creador o nombre de archivo…',
    ordenOriginal: 'Actualizados recientemente',
    filtros: [
        { clave: 'tipo', etiqueta: 'Tipo', formato: v => v.charAt(0).toUpperCase() + v.slice(1) },
        { clave: 'area', etiqueta: 'Área' },
        { clave: 'creador', etiqueta: 'Creado por' },
        { clave: 'archivos', etiqueta: 'Archivos', fijas: [['con', 'Con archivos'], ['sin', 'Sin archivos']] },
        { clave: 'formato', etiqueta: 'Formato de archivo', multi: true, formato: v => v.toUpperCase() },
        { clave: 'cambio', etiqueta: 'Revisión', fijas: [['pendiente', 'Con cambio pendiente'], ['ninguno', 'Sin cambios pendientes']] },
        ...(esAdmin ? [{ clave: 'firma', etiqueta: 'Firma de memorandos', fijas: [['sin_firma', 'Sin firmar'], ['firmado', 'Firmados']] }] : [])
    ],
    fecha: { clave: 'fecha', etiqueta: 'Fecha de creación' },
    orden: [
        { valor: 'cons', etiqueta: 'Consecutivo', clave: 'cons', dir: 1 },
        { valor: 'titulo', etiqueta: 'Título (A-Z)', clave: 'titulo', dir: 1 },
        { valor: 'nuevos', etiqueta: 'Creados más recientemente', clave: 'fecha', dir: -1 },
        { valor: 'viejos', etiqueta: 'Creados hace más tiempo', clave: 'fecha', dir: 1 }
    ]
});

    await obtenerDocumentos();

    const memoPara = new URLSearchParams(location.search).get('memorandoPara');
    if (esAdmin && memoPara) {
        btnAbrirModal.click();
        tipoSelect.value = 'memorando';
        alternarEmpleado();
        selectEmpleado.value = memoPara; // si es el propio admin, la opción no existe y queda vacío
    }

    crearDocForm?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const docId = inputDocId.value;
        const formData = new FormData();
        formData.append('empresaId', usuario.empresaId);
        formData.append('usuarioId', currentUserId);
        formData.append('tipoDocumento', $('tipoDocumento').value);
        formData.append('areaResponsable', $('areaResponsable').value);
        formData.append('titulo', $('tituloDoc').value);
        formData.append('descripcion', $('descDoc').value);
        formData.append('firmantesInvolucrados', $('firmantesDoc').value);
        if (tipoSelect.value === 'memorando') formData.append('empleadoId', selectEmpleado.value);

        const idsAEliminar = Array.from(document.querySelectorAll('input[name="eliminarArchivo"]:checked')).map(cb => cb.value);
        if (idsAEliminar.length > 0) formData.append('archivosAEliminar', JSON.stringify(idsAEliminar));

        const archivosInput = $('archivosDoc');
        for (const f of archivosInput.files) formData.append('archivos', f);

        try {
            const respuesta = await fetch(docId ? `/api/documentos/${docId}` : '/api/documentos', {
                method: docId ? 'PUT' : 'POST',
                headers: headersAuth,
                body: formData
            });
            const resultado = await respuesta.json();

            if (respuesta.ok) {
                alert(resultado.mensaje || 'Operación realizada con éxito');
                crearDocForm.reset();
                inputDocId.value = '';
                formContainer.style.display = 'none';
                obtenerDocumentos();
            } else {
                alert(`Error: ${resultado.mensaje}`);
            }
        } catch (error) {
            console.error('Error al procesar formulario:', error);
            alert('Error interno de conexión.');
        }
    });

    window.abrirFormularioEdicion = (id) => {
        const doc = window.listaDocumentosCache?.find(d => d._id === id);
        if (!doc) return;

        inputDocId.value = doc._id;
        $('tituloFormulario').textContent = esAdmin
            ? `Editar Documento (${doc.consecutivo})`
            : `Proponer cambio (${doc.consecutivo}) — requiere aprobación del administrador`;
        $('tipoDocumento').value = doc.tipoDocumento;
        selectEmpleado.value = doc.empleadoId || '';
        
        tipoSelect.disabled = doc.tipoDocumento === 'memorando';
        selectEmpleado.disabled = true;
        alternarEmpleado();
        $('areaResponsable').value = doc.areaResponsable;
        $('tituloDoc').value = doc.titulo;
        $('descDoc').value = doc.descripcion || '';
        
        $('firmantesDoc').value = doc.firmantesInvolucrados ? doc.firmantesInvolucrados.join(', ') : '';
        $('archivosDoc').value = '';

        $('archivosActualesEdicion').innerHTML = doc.archivos?.length
            ? `
                <label style="display: block; font-weight: 500; color: #475569; margin-bottom: 5px;">Archivos actuales:</label>
                <div style="display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px;">
                    ${doc.archivos.map(a => `
                        <label style="font-size: 0.85rem; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                            <input type="checkbox" name="eliminarArchivo" value="${esc(a._id)}">
                            Eliminar: <a href="/uploads/${encodeURIComponent(a.ruta)}" target="_blank" style="color: #0ea5e9;">${esc(a.nombreOriginal)}</a>
                        </label>`).join('')}
                </div>`
            : '<p style="font-size: 0.85rem; color: #94a3b8;">No hay archivos adjuntos en este documento.</p>';

        formContainer.style.display = 'block';
        formContainer.scrollIntoView({ behavior: 'smooth' });
    };

    let versionPendienteId = null;

    window.abrirRevision = (id) => {
        const doc = window.listaDocumentosCache?.find(d => d._id === id);
        if (!doc || !doc.pendiente) return;
        const p = doc.pendiente;
        versionPendienteId = p._id;

        $('tituloRevision').textContent = `Revisar cambio — ${doc.consecutivo}`;
        $('autorRevision').textContent = `Propuesto por ${p.editadoPor?.nombre || 'Desconocido'} el ${fmtFecha(p.createdAt)}`;
        $('comentarioRevision').value = '';

        const unir = (arr) => (arr && arr.length ? arr.join(', ') : '—');
        const filas = [
            ['Título', doc.titulo, p.titulo],
            ['Tipo', doc.tipoDocumento, p.tipoDocumento],
            ['Área', doc.areaResponsable, p.areaResponsable],
            ['Descripción', doc.descripcion || '—', p.descripcion || '—'],
            ['Firmantes', unir(doc.firmantesInvolucrados), unir(p.firmantesInvolucrados)]
        ];

        const rutasActual = new Set((doc.archivos || []).map(a => a.ruta));
        const rutasProp = new Set((p.archivos || []).map(a => a.ruta));
        const agregados = (p.archivos || []).filter(a => !rutasActual.has(a.ruta));
        const quitados = (doc.archivos || []).filter(a => !rutasProp.has(a.ruta));

        const celda = 'padding: 8px 10px; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem; vertical-align: top;';
        let html = `<table style="width: 100%; border-collapse: collapse;">
            <thead><tr style="background: #f1f5f9; text-align: left;">
                <th style="${celda}">Campo</th><th style="${celda}">Actual</th><th style="${celda}">Propuesto</th>
            </tr></thead><tbody>`;

        html += filas.map(([campo, antes, despues]) => {
            const cambio = antes !== despues;
            return `<tr style="${cambio ? 'background: #fef9c3;' : ''}">
                <td style="${celda} font-weight: 600;">${campo}</td>
                <td style="${celda}">${esc(antes)}</td>
                <td style="${celda}">${esc(despues)}${cambio ? ' ' : ''}</td>
            </tr>`;
        }).join('');

        html += `<tr style="${agregados.length || quitados.length ? 'background: #fef9c3;' : ''}">
            <td style="${celda} font-weight: 600;">Archivos</td>
            <td style="${celda}">${(doc.archivos || []).map(a => esc(a.nombreOriginal)).join('<br>') || '—'}</td>
            <td style="${celda}">
                ${agregados.map(a => `<span style="color: #166534;">+ ${esc(a.nombreOriginal)}</span>`).join('<br>')}
                ${quitados.map(a => `<span style="color: #b91c1c;">− ${esc(a.nombreOriginal)}</span>`).join('<br>')}
                ${!agregados.length && !quitados.length ? 'Sin cambios en archivos' : ''}
            </td>
        </tr></tbody></table>`;

        $('contenidoRevision').innerHTML = html;
        $('modalRevision').style.display = 'flex';
    };

    window.cerrarModalRevision = () => { $('modalRevision').style.display = 'none'; };

    const decidir = async (decision) => {
        if (!versionPendienteId) return;
        try {
            const r = await fetch(`/api/documentos/${versionPendienteId}/revisar`, {
                method: 'PUT',
                headers: headersJson,
                body: JSON.stringify({ decision, comentario: $('comentarioRevision').value })
            });
            const data = await r.json();
            alert(data.mensaje);
            if (r.ok) {
                cerrarModalRevision();
                obtenerDocumentos();
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión.');
        }
    };
    $('btnAprobar')?.addEventListener('click', () => decidir('aprobar'));
    $('btnRechazar')?.addEventListener('click', () => decidir('rechazar'));

    window.verHistorial = async (consecutivo, empresaId) => {
        try {
            const respuesta = await fetch(`/api/documentos/historial/${empresaId}/${consecutivo}`, { headers: headersAuth });
            const datos = await respuesta.json();

            const contenedor = $('contenidoHistorial');
            const pie = $('pieHistorial');
            $('tituloHistorial').textContent = `Historial - ${consecutivo}`;
            pie.innerHTML = '';

            if (!respuesta.ok || !datos.historial?.length) {
                contenedor.innerHTML = `<p style="text-align: center; color: #64748b;">No hay registros para este documento.</p>`;
                $('modalHistorial').style.display = 'flex';
                return;
            }

            const historial = datos.historial;
            const original = historial.find(v => v.version === 1);
            const vigente = historial.find(v => v.estado === 'vigente');

            const archivosOriginal = original?.archivos?.length
                ? original.archivos.map(a => `<a href="/uploads/${encodeURIComponent(a.ruta)}" target="_blank" style="color:#0ea5e9; display:block; font-size:0.85rem;">📎 ${esc(a.nombreOriginal)}</a>`).join('')
                : '';

            contenedor.innerHTML = `
                <div style="border: 1px solid #0ea5e9; padding: 12px; border-radius: 6px; background: #f0f9ff;">
                    <div style="font-weight: bold; color: #0284c7;">Documento original · ${fmtFecha(original?.createdAt)}</div>
                    <p style="margin: 5px 0;"><strong>Título:</strong> ${esc(original?.titulo)}</p>
                    <p style="margin: 5px 0;"><strong>Descripción:</strong> ${esc(original?.descripcion || '—')}</p>
                    <p style="margin: 5px 0;"><strong>Creado por:</strong> ${esc(original?.creadoPor?.nombre || 'Desconocido')}</p>
                    <div>${archivosOriginal}</div>
                </div>`;

            const eventos = historial
                .filter(v => v.version > 1 && v.revisadoPor)
                .sort((a, b) => new Date(b.fechaDecision || b.updatedAt) - new Date(a.fechaDecision || a.updatedAt));

            pie.innerHTML = eventos.length
                ? eventos.map(v => {
                    const rechazado = v.estado === 'rechazado';
                    const texto = v.restauradoDeVersion
                        ? `Restablecido al original el ${fmtFecha(v.fechaDecision)} por <strong>${esc(v.revisadoPor.nombre)}</strong>`
                        : rechazado
                            ? `Cambio de <strong>${esc(v.editadoPor?.nombre || '—')}</strong> rechazado por <strong>${esc(v.revisadoPor.nombre)}</strong> el ${fmtFecha(v.fechaDecision)}`
                            : `Última actualización el ${fmtFecha(v.fechaDecision)} por <strong>${esc(v.editadoPor?.nombre || '—')}</strong>, aprobado por <strong>${esc(v.revisadoPor.nombre)}</strong>`;
                    const coment = v.comentarioDecision ? ` — <em>${esc(v.comentarioDecision)}</em>` : '';
                    return `<div style="margin-top:8px; padding:8px 12px; border-radius:6px; font-size:0.82rem; background:${rechazado ? '#fee2e2' : '#f1f5f9'}; color:#334155;">${texto}${coment}</div>`;
                }).join('')
                : `<div style="margin-top:8px; padding:8px 12px; border-radius:6px; font-size:0.82rem; background:#f1f5f9; color:#334155;">Sin modificaciones desde su creación.</div>`;

            const yaEsOriginal = vigente && (vigente.version === 1 || vigente.restauradoDeVersion === 1);
            if (esAdmin && original && vigente && !yaEsOriginal) {
                pie.innerHTML += `
                    <div style="margin-top: 12px; text-align: right;">
                        <button type="button" onclick="restablecerOriginal('${esc(consecutivo)}', '${esc(empresaId)}')"
                            style="background: #ef4444; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: 600;">
                            ↩ Restablecer a la versión original
                        </button>
                    </div>`;
            }

            $('modalHistorial').style.display = 'flex';
        } catch (error) {
            console.error('Error al cargar historial:', error);
            alert('No se pudo cargar el historial de versiones.');
        }
    };

    window.restablecerOriginal = async (consecutivo, empresaId) => {
        if (!(await confirmar('El documento volverá a su versión original. ¿Continuar?', { titulo: 'Restablecer documento', si: 'Restablecer' }))) return;
        try {
            const r = await fetch(`/api/documentos/restablecer/${empresaId}/${consecutivo}`, {
                method: 'PUT',
                headers: headersJson
            });
            const data = await r.json();
            alert(data.mensaje);
            if (r.ok) {
                cerrarModalHistorial();
                obtenerDocumentos();
            }
        } catch (e) {
            console.error(e);
            alert('Error de conexión.');
        }
    };

    window.cerrarModalHistorial = () => { $('modalHistorial').style.display = 'none'; };
});