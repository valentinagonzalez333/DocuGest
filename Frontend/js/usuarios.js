let listaUsuariosGlobal = [];
let pasoActual = 1;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const $id = (id) => document.getElementById(id);

const CAMPOS_EXPEDIENTE = [
    'nombres', 'apellidos', 'documentoIdentidad', 'departamento', 'fechaIngreso',
    'tipoContrato', 'fechaFinContrato', 'salario', 'estado', 'telefono', 'direccion', 'ciudad', 'contactoEmergencia'
];



window.setPasoUsuario = (n, edicion = false) => {
    pasoActual = n;
    $id('pasoUsuario').style.display = n === 1 ? 'flex' : 'none';
    $id('pasoExpediente').style.display = n === 2 ? 'block' : 'none';
    $id('btnAtras').style.display = n === 2 ? 'inline-block' : 'none';
    $id('btnSiguiente').style.display = (n === 1 && !edicion) ? 'inline-block' : 'none';
    $id('btnGuardarFormUsuario').style.display = (n === 2 || edicion) ? 'inline-block' : 'none';
    $id('indicadorPaso').textContent = edicion ? '' : `Paso ${n} de 2 — ${n === 1 ? 'Cuenta y permisos' : 'Expediente laboral'}`;
};


const validarPaso1 = () => {
    const campos = $id('pasoUsuario').querySelectorAll('input, select');
    for (const campo of campos) {
        if (campo.disabled || campo.offsetParent === null) continue;
        if (!campo.checkValidity()) {
            campo.reportValidity();
            return false;
        }
    }
    return true;
};

document.addEventListener('DOMContentLoaded', () => {
    const usuarioGuardado = localStorage.getItem('usuario');
    if (!usuarioGuardado) { window.location.href = '/'; return; }
    const usuario = JSON.parse(usuarioGuardado);
    const currentUserId = usuario._id || usuario.id;

    if (usuario.rol !== 'admin_empresa') {
        alert('Acceso no autorizado. Se requieren privilegios de administrador.');
        window.location.href = '/panel';
        return;
    }

    const tbody = $id('tablaUsuariosBody');
    const btnAbrirModal = $id('btnAbrirModalUsuario');
    const modalContainer = $id('modalUsuarioContainer');
    const btnCancelarModal = $id('btnCancelarModal');
    const formUsuario = $id('formCrearUsuario');
    const modalTitulo = $id('modalTitulo');

    const headersJson = { 'Content-Type': 'application/json', 'usuario-id': currentUserId };



    $id('nombreEmpresa').textContent = usuario.nombreEmpresa || 'DocuGets';
    $id('userNombre').textContent = usuario.nombre;
    $id('userRol').textContent = 'Administrador';
    $id('saludoHeader').textContent = `Welcome, ${usuario.nombre}`;
    $id('seccionAdmin').style.display = 'block';

    $id('btnCerrarSesion').addEventListener('click', () => {
        localStorage.removeItem('usuario');
        window.location.href = '/';
    });



    const cerrarModal = () => {
        modalContainer.style.display = 'none';
        formUsuario.reset();
        $id('usuarioEditandoId').value = '';
        window.setPasoUsuario(1, false);
    };

    btnAbrirModal.addEventListener('click', () => {
        formUsuario.reset();
        $id('usuarioEditandoId').value = '';
        modalTitulo.textContent = 'Registrar Nuevo Usuario y Permisos';

        const inputPassNuevo = $id('passwordNuevo');
        inputPassNuevo.style.display = 'block';
        inputPassNuevo.setAttribute('required', 'true');
        $id('passwordEstatico').style.display = 'none';

        window.setPasoUsuario(1, false);
        modalContainer.style.display = 'block';
        modalContainer.scrollIntoView({ behavior: 'smooth' });
    });

    btnCancelarModal.addEventListener('click', cerrarModal);



    const actualizarContrato = Contrato.enlazar({
        tipo: $id('exp_tipoContrato'),
        estado: $id('exp_estado'),
        ingreso: $id('exp_fechaIngreso'),
        fin: $id('exp_fechaFinContrato'),
        etiqueta: $id('lbl_fin')
    });



    const irAPaso2 = () => {
        if (!validarPaso1()) return;
        if (($id('passwordNuevo').value || '').length < 8) {
            alert('La contraseña inicial debe tener al menos 8 caracteres.');
            return;
        }


        if (!$id('exp_nombres').value) $id('exp_nombres').value = $id('nombreNuevo').value.trim();

        $id('exp_cargo').value = Contrato.cargoPorRol($id('rolNuevo').value);
        actualizarContrato();
        window.setPasoUsuario(2, false);
    };

    $id('btnSiguiente').addEventListener('click', irAPaso2);
    $id('btnAtras').addEventListener('click', () => window.setPasoUsuario(1, false));




    const cargarUsuarios = async () => {
        try {
            const res = await fetch(`/api/usuarios/${usuario.empresaId}`, {
                headers: { 'usuario-id': currentUserId }
            });
            const data = await res.json();

            if (res.ok && data.usuarios && data.usuarios.length > 0) {
                listaUsuariosGlobal = data.usuarios;

                tbody.innerHTML = data.usuarios.map(u => {
                    const esMiCuenta = String(u._id) === String(currentUserId);

                    const permisosDocs = (u.permisos?.documentos?.length) ? u.permisos.documentos.join(', ') : 'Ninguno';
                    const permisosComp = (u.permisos?.compromisos?.length) ? u.permisos.compromisos.join(', ') : 'Ninguno';
                    const textoRol = u.rol === 'admin_empresa'
                        ? 'Administrador'
                        : `Documentos: [ ${esc(permisosDocs)} ] / Compromisos: [ ${esc(permisosComp)} ]`;

                    const esAdminU = u.rol === 'admin_empresa';
                    const attrs = `data-rol="${esc(u.rol)}" data-estado="${esc(u.estado || 'activo')}" data-pass="${u.cambiarPassword ? 'pendiente' : 'ok'}" ` +
                        `data-pdoc="${esAdminU ? 'leer|crear|editar|archivar|anular|descargar' : esc((u.permisos?.documentos || []).join('|'))}" ` +
                        `data-pcomp="${esAdminU ? 'leer|crear|editar' : esc((u.permisos?.compromisos || []).join('|'))}" ` +
                        `data-nombre="${esc(u.nombre)}" data-correo="${esc(u.correo)}"`;

                    return `
                       <tr ${attrs} style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding: 12px 15px; font-weight: 600; color: #1e293b;">
                                ${esc(u.nombre)} ${esMiCuenta ? '<span style="color: #0ea5e9; font-size: 0.8rem; font-weight: bold;"></span>' : ''}
                            </td>
                            <td style="padding: 12px 15px; color: #475569;">${esc(u.correo)}</td>
                            <td style="padding: 12px 15px;">
                                <span style="padding: 4px 8px; background: ${u.rol === 'admin_empresa' ? '#dcfce7' : '#e0f2fe'}; color: ${u.rol === 'admin_empresa' ? '#166534' : '#0369a1'}; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                                    ${textoRol}
                                </span>
                            </td>
                            <td style="padding: 12px 15px;">
                                ${!esMiCuenta
                            ? `<button type="button" onclick="prepararEdicion('${esc(u._id)}')" style="background: #f59e0b; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">Editar</button>`
                            : '<span style="color: #94a3b8; font-size: 0.85rem; font-style: italic; font-weight: 600;">Bloqueado</span>'}
                            </td>
                        </tr>`;
                }).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="4" style="padding: 30px; text-align: center; color: #64748b;">No hay usuarios registrados en la empresa.</td></tr>`;
            }
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            tbody.innerHTML = `<tr><td colspan="4" style="padding: 30px; text-align: center; color: #ef4444;">Error al cargar los usuarios.</td></tr>`;
        }
    };

    Buscador.crear({
    tbody,
    nombre: 'usuarios',
    placeholder: 'Buscar por nombre, correo o permiso…',
    ordenOriginal: 'Más recientes primero',
    filtros: [
        { clave: 'rol', etiqueta: 'Rol', fijas: [['admin_empresa', 'Administrador'], ['usuario_personalizado', 'Personalizado']] },
        { clave: 'pdoc', etiqueta: 'Permiso en documentos', multi: true, fijas: [['leer', 'Puede leer'], ['crear', 'Puede crear'], ['editar', 'Puede editar'], ['archivar', 'Puede archivar'], ['anular', 'Puede anular'], ['descargar', 'Puede descargar']] },
        { clave: 'pcomp', etiqueta: 'Permiso en compromisos', multi: true, fijas: [['leer', 'Puede leer'], ['crear', 'Puede crear'], ['editar', 'Puede editar']] },
        { clave: 'pass', etiqueta: 'Contraseña inicial', fijas: [['pendiente', 'Aún debe cambiarla'], ['ok', 'Ya la cambió']] },
        { clave: 'estado', etiqueta: 'Estado', etiquetas: { activo: 'Activo', inactivo: 'Inactivo' } }
    ],
    orden: [
        { valor: 'nombre', etiqueta: 'Nombre (A-Z)', clave: 'nombre', dir: 1 },
        { valor: 'correo', etiqueta: 'Correo (A-Z)', clave: 'correo', dir: 1 }
    ]
});

    cargarUsuarios();





    formUsuario.addEventListener('submit', async (e) => {
        e.preventDefault();

        const userId = $id('usuarioEditandoId').value;



        if (!userId && pasoActual === 1) { irAPaso2(); return; }

        if (!validarPaso1()) { window.setPasoUsuario(1, !!userId); return; }

        const leerChecks = (name) =>
            Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);

        const payload = {
            empresaId: usuario.empresaId,
            nombre: $id('nombreNuevo').value.trim(),
            correo: $id('correoNuevo').value.trim(),
            rol: $id('rolNuevo').value,
            permisos: {
                documentos: leerChecks('permisoDoc'),
                compromisos: leerChecks('permisoComp')
            },
            adminIdActual: currentUserId
        };

        if (!userId) {
            const pass = $id('passwordNuevo').value;
            if (pass.trim() === '') {
                alert('La contraseña inicial es obligatoria para nuevos usuarios.');
                window.setPasoUsuario(1, false);
                return;
            }
            if (pass.length < 8) {
                alert('La contraseña inicial debe tener al menos 8 caracteres.');
                window.setPasoUsuario(1, false);
                return;
            }
            payload.contrasenahash = pass;

            const errContrato = Contrato.validar({
                tipo: $id('exp_tipoContrato').value,
                estado: $id('exp_estado').value,
                ingreso: $id('exp_fechaIngreso').value,
                fin: $id('exp_fechaFinContrato').value
            });
            if (errContrato) {
                alert(errContrato);
                window.setPasoUsuario(2, false);
                return;
            }

            payload.expediente = {};
            CAMPOS_EXPEDIENTE.forEach(c => { payload.expediente[c] = $id(`exp_${c}`).value; });
        }

        const url = userId ? `/api/usuarios/${userId}` : '/api/usuarios';
        const method = userId ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, { method, headers: headersJson, body: JSON.stringify(payload) });
            const data = await res.json();

            if (res.ok) {
                alert(data.mensaje || (userId ? 'Usuario actualizado con éxito.' : 'Usuario creado con éxito.'));
                cerrarModal();
                cargarUsuarios();
            } else {
                alert(`Error: ${data.mensaje}`);
            }
        } catch (error) {
            console.error(error);
            alert('Error de conexión con el servidor.');
        }
    });
});




window.prepararEdicion = (userId) => {
    const u = listaUsuariosGlobal.find(x => String(x._id) === String(userId));
    if (!u) return;

    $id('usuarioEditandoId').value = u._id;
    $id('nombreNuevo').value = u.nombre;
    $id('correoNuevo').value = u.correo;
    $id('rolNuevo').value = u.rol;

    const inputPassNuevo = $id('passwordNuevo');
    inputPassNuevo.style.display = 'none';
    inputPassNuevo.removeAttribute('required');
    inputPassNuevo.value = '';

    const inputPassEst = $id('passwordEstatico');
    inputPassEst.style.display = 'block';
    inputPassEst.value = '********';

    $id('modalTitulo').textContent = `Editar Permisos de: ${u.nombre}`;

    const marcar = (name, lista) => {
        document.querySelectorAll(`input[name="${name}"]`).forEach(cb => { cb.checked = lista.includes(cb.value); });
    };
    marcar('permisoDoc', u.permisos?.documentos || []);
    marcar('permisoComp', u.permisos?.compromisos || []);

    window.setPasoUsuario(1, true);

    const modal = $id('modalUsuarioContainer');
    modal.style.display = 'block';
    modal.scrollIntoView({ behavior: 'smooth' });
};