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
    } catch (e) { console.error('No se pudo refrescar el perfil:', e); }

    const esAdmin = usuario.rol === 'admin_empresa';
    const $ = (id) => document.getElementById(id);
    const headersAuth = { 'usuario-id': currentUserId };
    const headersJson = { 'Content-Type': 'application/json', 'usuario-id': currentUserId };
    const fmtFecha = (f) => f ? new Date(f).toLocaleDateString('es-CO', { timeZone: 'UTC' }) : '—';
    const fmtFechaHora = (f) => f ? new Date(f).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : '';
    const fechaInput = (f) => f ? String(f).slice(0, 10) : '';
    const ETIQUETA_CONTRATO = Object.fromEntries(Contrato.TIPOS);
    const ETIQUETA_ESTADO = { candidato: 'Candidato', activo: 'Activo', vacaciones: 'Vacaciones', suspendido: 'Suspendido', retirado: 'Retirado' };

    const atributosEmpleado = (e) => {
        const extra = [e.documentoIdentidad, e.correo, e.telefono, e.ciudad, e.direccion, e.contactoEmergencia].filter(Boolean).join(' ');
        return `data-q="${esc(extra)}" data-cargo="${esc(e.cargo || '')}" data-depto="${esc(e.departamento || '')}" ` +
            `data-contrato="${esc(e.tipoContrato || '')}" data-estado="${esc(e.estado || '')}" data-ciudad="${esc(e.ciudad || '')}" ` +
            `data-ingreso="${fechaInput(e.fechaIngreso)}" data-fin="${fechaInput(e.fechaFinContrato)}" data-nombre="${esc(e.nombres)} ${esc(e.apellidos)}"`;
    };

    $('nombreEmpresa').textContent = usuario.nombreEmpresa || 'DocuGets';
    $('userNombre').textContent = usuario.nombre;
    $('userRol').textContent = esAdmin ? 'Administrador' : 'Colaborador';
    $('saludoHeader').textContent = `Welcome, ${usuario.nombre}`;
    if (esAdmin && $('seccionAdmin')) $('seccionAdmin').style.display = 'block';

    $('btnCerrarSesion').addEventListener('click', () => {
        localStorage.removeItem('usuario');
        window.location.href = '/';
    });



    const CAMPOS = [
        { k: 'nombres', l: 'Nombres', t: 'text' },
        { k: 'apellidos', l: 'Apellidos', t: 'text' },
        { k: 'documentoIdentidad', l: 'Documento de identidad', t: 'text' },
        { k: 'correo', l: 'Correo', t: 'email' },
        { k: 'cargo', l: 'Cargo (según el rol)', t: 'text', soloLectura: true },
        { k: 'departamento', l: 'Área / Departamento', t: 'text' },
        { k: 'fechaIngreso', l: 'Fecha de ingreso', t: 'date' },
        { k: 'tipoContrato', l: 'Tipo de contrato', t: 'select', opciones: Contrato.TIPOS },
        { k: 'fechaFinContrato', l: 'Contrato hasta', t: 'date' },
        { k: 'salario', l: 'Salario', t: 'number' },
        {
            k: 'estado', l: 'Estado', t: 'select', opciones: [
                ['candidato', 'Candidato'], ['activo', 'Activo'], ['vacaciones', 'Vacaciones'],
                ['suspendido', 'Suspendido'], ['retirado', 'Retirado']]
        },
        { k: 'telefono', l: 'Teléfono', t: 'text', personal: true },
        { k: 'direccion', l: 'Dirección de residencia', t: 'text', personal: true },
        { k: 'ciudad', l: 'Ciudad', t: 'text', personal: true },
        { k: 'contactoEmergencia', l: 'Contacto de emergencia', t: 'text', personal: true }
    ];

    const inputHtml = (c, valor, editable) => {
        const base = `width:100%; padding:10px; border-radius:6px; border:1px solid #cbd5e1; ${editable ? '' : 'background:#f1f5f9; color:#64748b;'}`;
        const dis = editable ? '' : 'disabled';
        if (c.t === 'select') {
            return `<select id="campo_${c.k}" style="${base}" ${dis}>${c.opciones.map(([v, n]) =>
                `<option value="${v}" ${v === (valor || '') ? 'selected' : ''}>${n}</option>`).join('')}</select>`;
        }
        const v = c.t === 'date' ? fechaInput(valor) : (valor ?? '');
        return `<input id="campo_${c.k}" type="${c.t}" value="${esc(v)}" style="${base}" ${dis}>`;
    };

    const cerrarExpediente = () => { $('contenedorExpediente').innerHTML = ''; };

    const mostrarExpediente = (emp, memorandos, modo) => {
        const editables = CAMPOS.filter(c => !c.soloLectura && (modo === 'admin' || c.personal));
        const url = modo === 'admin' ? `/api/empleados/${emp._id}` : '/api/empleados/mi-expediente';
        const titulo = modo === 'admin'
            ? `Expediente de ${esc(emp.nombres)} ${esc(emp.apellidos)}`
            : 'Mi expediente laboral';

        const memos = memorandos.length
            ? memorandos.map(m => `
                <div style="border:1px solid #e2e8f0; border-radius:6px; padding:12px; background:#f8fafc;">
                    <div style="display:flex; justify-content:space-between; font-weight:600; color:#0284c7;">
                        <span>${esc(m.consecutivo)} · ${esc(m.titulo)}</span>
                        <span style="font-size:0.8rem; color:#64748b;">${fmtFecha(m.createdAt)}</span>
                    </div>
                    <p style="margin:5px 0; font-size:0.85rem; color:#475569;">${esc(m.descripcion || '')}</p>
                    <div style="font-size:0.75rem; color:#94a3b8;">Emitido por ${esc(m.creadoPor?.nombre || 'Desconocido')}</div>
                    ${m.firmado
                    ? `<div style="margin-top:8px; font-size:0.8rem; color:#166534; font-weight:600;">✔ Firmado${m.firmaTexto ? ' por <em style="font-family:Newsreader,serif; font-size:1rem;">' + esc(m.firmaTexto) + '</em>' : ''}${m.firmadoEl ? ' el ' + esc(fmtFechaHora(m.firmadoEl)) : ''}</div>`
                    : (modo === 'propio'
                        ? `<div style="margin-top:8px;"><button type="button" onclick="firmarMemorando('${esc(m._id)}')" style="background:#22c55e; color:white; border:none; padding:7px 14px; border-radius:6px; cursor:pointer; font-size:0.85rem; font-weight:600;">Firmar memorando</button></div>`
                        : '<div style="margin-top:8px; font-size:0.8rem; color:#b45309; font-weight:600;">Pendiente de firma</div>')}
                    ${(m.archivos || []).map(a => `<a href="/uploads/${encodeURIComponent(a.ruta)}" target="_blank" style="color:#0ea5e9; display:block; font-size:0.8rem;">📎 ${esc(a.nombreOriginal)}</a>`).join('')}
                </div>`).join('')
            : '<p style="color:#94a3b8; font-size:0.85rem;">No hay memorandos.</p>';

       
        const botonMemo = (modo === 'admin' && String(emp.usuarioId) !== String(currentUserId))
            ? `<a href="/documentos?memorandoPara=${emp._id}" style="background:#8b5cf6; color:white; text-decoration:none; padding:8px 14px; border-radius:6px; font-size:0.85rem; font-weight:600;">+ Nuevo memorando</a>`
            : '';

        $('contenedorExpediente').innerHTML = `
            <div style="background:white; padding:25px; border-radius:10px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); border:2px solid #0ea5e9;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="color:#1e293b;">${titulo}</h3>
                    ${botonMemo}
                </div>
                ${modo === 'propio' ? '<p style="font-size:0.8rem; color:#64748b; margin-bottom:15px;">Puedes editar tu teléfono, dirección, ciudad y contacto de emergencia. El resto solo lo modifica un administrador.</p>' : ''}
                <form id="formExpediente">
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                        ${CAMPOS.map(c => `
                            <div>
                                <label ${c.k === 'fechaFinContrato' ? 'id="lbl_fechaFinContrato"' : ''} style="display:block; margin-bottom:5px; font-weight:500; color:#475569; font-size:0.85rem;">${c.l}</label>
                                ${inputHtml(c, emp[c.k], !c.soloLectura && (modo === 'admin' || !!c.personal))}
                            </div>`).join('')}
                    </div>
                    <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:15px;">
                        ${modo === 'admin'
                ? '<button type="button" id="btnCerrarExpediente" style="background:#94a3b8; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer;">Cerrar</button>'
                : ''}
                        <button type="submit" style="background:#0ea5e9; color:white; border:none; padding:10px 20px; border-radius:6px; cursor:pointer; font-weight:600;">Guardar cambios</button>
                    </div>
                </form>

                <h3 style="color:#1e293b; margin:25px 0 10px;">Memorandos</h3>
                <div style="display:flex; flex-direction:column; gap:10px;">${memos}</div>
            </div>`;

        const finOriginal = fechaInput(emp.fechaFinContrato);

        if (modo === 'admin') {
            Contrato.enlazar({
                tipo: $('campo_tipoContrato'),
                estado: $('campo_estado'),
                ingreso: $('campo_fechaIngreso'),
                fin: $('campo_fechaFinContrato'),
                etiqueta: $('lbl_fechaFinContrato'),
                finOriginal
            });
        }

        $('formExpediente').addEventListener('submit', async (e) => {
            e.preventDefault();

            if (modo === 'admin') {
                const errContrato = Contrato.validar({
                    tipo: $('campo_tipoContrato').value,
                    estado: $('campo_estado').value,
                    ingreso: $('campo_fechaIngreso').value,
                    fin: $('campo_fechaFinContrato').value,
                    finOriginal
                });
                if (errContrato) { alert(errContrato); return; }
            }

            const body = {};
            editables.forEach(c => { body[c.k] = $(`campo_${c.k}`).value; });

            try {
                const res = await fetch(url, { method: 'PUT', headers: headersJson, body: JSON.stringify(body) });
                const data = await res.json();
                alert(data.mensaje);
                if (res.ok && modo === 'admin') cargarLista();
            } catch (err) {
                console.error(err);
                alert('Error de conexión.');
            }
        });

        const btnCerrar = $('btnCerrarExpediente');
        if (btnCerrar) btnCerrar.addEventListener('click', cerrarExpediente);

        $('contenedorExpediente').scrollIntoView({ behavior: 'smooth' });
    };

    const cargarLista = async () => {
        const tbody = $('tablaEmpleadosBody');
        try {
            const res = await fetch(`/api/empleados/empresa/${usuario.empresaId}`, { headers: headersAuth });
            const data = await res.json();
            if (!res.ok) {
                tbody.innerHTML = `<tr><td colspan="6" style="padding:30px; text-align:center; color:#ef4444;">${esc(data.mensaje)}</td></tr>`;
                return;
            }
            tbody.innerHTML = data.empleados.map(e => `
                <tr ${atributosEmpleado(e)} style="border-bottom:1px solid #e2e8f0;">
                   <td style="padding:12px 15px; font-weight:600; color:#1e293b;">${esc(e.nombres)} ${esc(e.apellidos)}<span class="sub">${e.documentoIdentidad ? 'Doc. ' + esc(e.documentoIdentidad) : 'Sin documento'} / ${esc(e.correo)}</span></td>
                    <td style="padding:12px 15px; color:#475569;">${esc(e.cargo || '—')}</td>
                    <td style="padding:12px 15px; color:#475569;">${esc(e.departamento || '—')}</td>
                    <td style="padding:12px 15px; color:#475569;">${esc(ETIQUETA_CONTRATO[e.tipoContrato] || '—')}</td>
                    <td style="padding:12px 15px;"><span style="padding:4px 8px; background:#e0f2fe; color:#0369a1; border-radius:4px; font-size:0.8rem; font-weight:600;">${esc(e.estado)}</span></td>
                    <td style="padding:12px 15px;"><button onclick="verExpediente('${esc(e._id)}')" style="background:#3b82f6; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:0.8rem;">Ver expediente</button></td>
                </tr>`).join('');
        } catch (err) {
            console.error(err);
            tbody.innerHTML = `<tr><td colspan="6" style="padding:30px; text-align:center; color:#ef4444;">Error al cargar empleados.</td></tr>`;
        }
    };

    window.verExpediente = async (id) => {
        try {
            const res = await fetch(`/api/empleados/${id}`, { headers: headersAuth });
            const data = await res.json();
            if (!res.ok) { alert(data.mensaje); return; }
            mostrarExpediente(data.empleado, data.memorandos, 'admin');
        } catch (err) {
            console.error(err);
            alert('Error de conexión.');
        }
    };

    if (esAdmin) {
        $('vistaLista').style.display = 'block';
        Buscador.crear({
    tbody: $('tablaEmpleadosBody'),
    nombre: 'expedientes',
    placeholder: 'Buscar por nombre, documento, correo, teléfono, ciudad, cargo o área…',
    ordenOriginal: 'Nombre (A-Z)',
    filtros: [
        { clave: 'cargo', etiqueta: 'Cargo' },
        { clave: 'depto', etiqueta: 'Área' },
        { clave: 'contrato', etiqueta: 'Tipo de contrato', etiquetas: ETIQUETA_CONTRATO },
        { clave: 'estado', etiqueta: 'Estado', etiquetas: ETIQUETA_ESTADO },
        { clave: 'ciudad', etiqueta: 'Ciudad' }
    ],
    ventana: { clave: 'fin', etiqueta: 'Contrato termina', etiquetaPasada: 'Ya terminó', ignorar: (tr) => tr.dataset.estado === 'retirado' },
    fecha: { clave: 'ingreso', etiqueta: 'Fecha de ingreso' },
    orden: [
        { valor: 'nombre-z', etiqueta: 'Nombre (Z-A)', clave: 'nombre', dir: -1 },
        { valor: 'ingreso-nuevo', etiqueta: 'Ingresaron más recientemente', clave: 'ingreso', dir: -1 },
        { valor: 'ingreso-viejo', etiqueta: 'Ingresaron hace más tiempo', clave: 'ingreso', dir: 1 },
        { valor: 'fin', etiqueta: 'Contrato que termina primero', clave: 'fin', dir: 1 }
    ]
});
        await cargarLista();
    } else {
        const cargarMiExpediente = async () => {
            try {
                const res = await fetch('/api/empleados/mi-expediente', { headers: headersAuth });
                const data = await res.json();
                if (!res.ok) {
                    $('contenedorExpediente').innerHTML = `<p style="color:#ef4444;">${esc(data.mensaje)}</p>`;
                    return;
                }
                mostrarExpediente(data.empleado, data.memorandos, 'propio');
            } catch (err) {
                console.error(err);
                $('contenedorExpediente').innerHTML = '<p style="color:#ef4444;">Error al cargar tu expediente.</p>';
            }
        };

        window.firmarMemorando = async (id) => {
            const firma = await pedirTexto('Firma', {
                titulo: 'Firmar memorando', placeholder: 'firma', si: 'Firmar', max: 80,
                vacio: 'Escribe tu firma para continuar.'
            });
            if (firma === null) return;
            try {
                const res = await fetch(`/api/documentos/${id}/firmar`, {
                    method: 'PUT', headers: headersJson, body: JSON.stringify({ firma })
                });
                const data = await res.json();
                alert(data.mensaje);
                if (res.ok) cargarMiExpediente();
            } catch (err) {
                console.error(err);
                alert('Error de conexión.');
            }
        };

        await cargarMiExpediente();
    }
});