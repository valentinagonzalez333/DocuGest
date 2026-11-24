const Usuario = require('../modelos/usuario');
const Empleado = require('../modelos/empleado');
const bcrypt = require('bcryptjs');



const ROLES_EMPRESA = ['admin_empresa', 'usuario_personalizado'];

const CAMPOS_EXPEDIENTE = [
    'nombres', 'apellidos', 'documentoIdentidad', 'departamento', 'fechaIngreso',
    'tipoContrato', 'fechaFinContrato', 'salario', 'estado', 'telefono', 'direccion', 'ciudad', 'contactoEmergencia'
];

const mismaEmpresa = (req, empresaId) =>
    req.usuario.rol === 'admin_plataforma' || String(req.usuario.empresaId) === String(empresaId);



const sinHash = (u) => {
    const obj = u.toObject ? u.toObject() : { ...u };
    delete obj.contrasenahash;
    return obj;
};



const exigirSesion = (req, res) => {
    if (!req.usuario) {
        res.status(401).json({ mensaje: 'No autenticado.' });
        return false;
    }
    return true;
};

const mensajeValidacion = (error, porDefecto) => {
    if (error.code === 11000) return 'Ya existe un registro con esos datos (correo o documento de identidad).';
    if (error.errors) return Object.values(error.errors).map(e => e.message).join(' ');
    return porDefecto;
};




const listarUsuariosEmpresa = async (req, res) => {
    try {
        if (!exigirSesion(req, res)) return;
        const { empresaId } = req.params;
        if (!mismaEmpresa(req, empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        const usuarios = await Usuario.find({ empresaId }).select('-contrasenahash').sort({ createdAt: -1 });
        res.status(200).json({ usuarios });
    } catch (error) {
        console.error('Error al listar usuarios:', error);
        res.status(500).json({ mensaje: 'Error al obtener los usuarios de la empresa.' });
    }
};

const obtenerPerfil = async (req, res) => {
    try {


        if (String(req.usuario._id) !== String(req.params.id)) {
            return res.status(403).json({ mensaje: 'No autorizado.' });
        }

        const usuario = await Usuario.findById(req.params.id).select('-contrasenahash');
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        res.status(200).json({ usuario });
    } catch (error) {
        console.error('Error al obtener perfil:', error);
        res.status(500).json({ mensaje: 'Error al obtener el perfil.' });
    }
};

const actualizarRolUsuario = async (req, res) => {
    try {
        if (!exigirSesion(req, res)) return;
        const { id } = req.params;
        const { rol, permisos } = req.body;

        if (String(id) === String(req.usuario._id)) {
            return res.status(400).json({ mensaje: 'Por seguridad, no puedes modificar tu propio rol o permisos.' });
        }

        const usuario = await Usuario.findById(id);
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        if (!mismaEmpresa(req, usuario.empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        if (rol) {
            if (!ROLES_EMPRESA.includes(rol)) return res.status(400).json({ mensaje: 'Rol no válido.' });
            usuario.rol = rol;
        }
        if (permisos) usuario.permisos = permisos;

        await usuario.save();
        await Empleado.updateOne({ usuarioId: usuario._id }, { cargo: Empleado.cargoPorRol(usuario.rol) });
        res.status(200).json({ mensaje: 'Permisos y rol actualizados con éxito', usuario: sinHash(usuario) });
    } catch (error) {
        console.error('Error al actualizar permisos:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar los permisos.' });
    }
};

const actualizarUsuarioCompleto = async (req, res) => {
    try {
        if (!exigirSesion(req, res)) return;
        const { id } = req.params;
        const { nombre, correo, rol, permisos, contrasenahash } = req.body;

        if (String(id) === String(req.usuario._id)) {
            return res.status(400).json({ mensaje: 'Por seguridad, no puedes modificar tu propia cuenta desde aquí.' });
        }

        const usuario = await Usuario.findById(id);
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
        if (!mismaEmpresa(req, usuario.empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        if (nombre) usuario.nombre = nombre;

        let correoCambio = false;
        if (correo) {
            const nuevoCorreo = String(correo).toLowerCase().trim();
            if (nuevoCorreo !== usuario.correo) {
                const existe = await Usuario.findOne({ correo: nuevoCorreo, _id: { $ne: usuario._id } });
                if (existe) return res.status(400).json({ mensaje: 'El correo electrónico ya está registrado.' });
                usuario.correo = nuevoCorreo;
                correoCambio = true;
            }
        }

        if (rol) {
            if (!ROLES_EMPRESA.includes(rol)) return res.status(400).json({ mensaje: 'Rol no válido.' });
            usuario.rol = rol;
        }
        if (permisos) usuario.permisos = permisos;
        if (contrasenahash) {
            if (String(contrasenahash).length < 8) {
                return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
            }
            usuario.contrasenahash = contrasenahash;
        }

        await usuario.save();


        const cambiosExpediente = { cargo: Empleado.cargoPorRol(usuario.rol) };
        if (correoCambio) cambiosExpediente.correo = usuario.correo;
        await Empleado.updateOne({ usuarioId: usuario._id }, cambiosExpediente);

        res.status(200).json({ mensaje: 'Usuario actualizado con éxito', usuario: sinHash(usuario) });
    } catch (error) {
        console.error('Error al actualizar usuario:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar el usuario.' });
    }
};

const crearUsuarioEmpresa = async (req, res) => {
    try {
        if (!exigirSesion(req, res)) return;
        const { nombre, correo, contrasenahash, rol, permisos, expediente } = req.body;




        const empresaId = req.usuario.rol === 'admin_plataforma' && req.body.empresaId
            ? req.body.empresaId
            : req.usuario.empresaId;

        if (!nombre || !correo || !contrasenahash) {
            return res.status(400).json({ mensaje: 'Nombre, correo y contraseña son obligatorios.' });
        }
        if (String(contrasenahash).length < 8) {
            return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
        }
        if (rol && !ROLES_EMPRESA.includes(rol)) {
            return res.status(400).json({ mensaje: 'Rol no válido.' });
        }

        const correoNorm = String(correo).toLowerCase().trim();
        const existe = await Usuario.findOne({ correo: correoNorm });
        if (existe) return res.status(400).json({ mensaje: 'El correo electrónico ya está registrado.' });



        const datos = {};
        for (const c of CAMPOS_EXPEDIENTE) {
            const v = expediente?.[c];
            if (v !== undefined && v !== '') datos[c] = v;
        }
        const nuevoEmpleado = new Empleado({
            ...datos,
            nombres: datos.nombres || nombre,
            cargo: Empleado.cargoPorRol(rol || 'usuario_personalizado'),
            empresaId,
            correo: correoNorm
        });
        try {
            await nuevoEmpleado.validate();
        } catch (errVal) {
            return res.status(400).json({ mensaje: mensajeValidacion(errVal, 'Datos del expediente no válidos.') });
        }

        const nuevoUsuario = new Usuario({
            empresaId,
            nombre,
            correo: correoNorm,
            contrasenahash,
            rol: rol || 'usuario_personalizado',
            permisos: permisos || { documentos: ['leer'], compromisos: ['leer'] },
            cambiarPassword: true
        });
        await nuevoUsuario.save();

        nuevoEmpleado.usuarioId = nuevoUsuario._id;
        try {
            await nuevoEmpleado.save();
        } catch (errEmp) {
            await Usuario.findByIdAndDelete(nuevoUsuario._id); // no dejar usuario sin expediente
            return res.status(400).json({ mensaje: mensajeValidacion(errEmp, 'Error al crear el expediente.') });
        }

        res.status(201).json({
            mensaje: 'Usuario y expediente creados exitosamente.',
            usuario: sinHash(nuevoUsuario)
        });
    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({ mensaje: 'Error interno al registrar el usuario.' });
    }
};

const cambiarPassword = async (req, res) => {
    try {
        const { passwordActual, passwordNueva, passwordConfirmar } = req.body;


        const usuarioId = req.usuario._id;

        if (!passwordActual) {
            return res.status(400).json({ mensaje: 'Ingresa tu contraseña actual.' });
        }
        if (!passwordNueva || String(passwordNueva).length < 8) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 8 caracteres.' });
        }
        if (passwordConfirmar !== undefined && passwordNueva !== passwordConfirmar) {
            return res.status(400).json({ mensaje: 'La confirmación no coincide con la nueva contraseña.' });
        }
        if (passwordActual === passwordNueva) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe ser distinta de la actual.' });
        }

        const usuario = await Usuario.findById(usuarioId);
        if (!usuario) return res.status(404).json({ mensaje: 'Usuario no encontrado.' });

        const esMatch = await bcrypt.compare(passwordActual, usuario.contrasenahash);
        if (!esMatch) return res.status(400).json({ mensaje: 'La contraseña actual es incorrecta.' });

        usuario.contrasenahash = passwordNueva;
        usuario.cambiarPassword = false;
        await usuario.save();

        res.status(200).json({ mensaje: 'Contraseña actualizada con éxito.' });
    } catch (error) {
        console.error('Error al cambiar contraseña:', error);
        res.status(500).json({ mensaje: 'Error interno al cambiar la contraseña.' });
    }
};

module.exports = {
    listarUsuariosEmpresa,
    obtenerPerfil,
    actualizarRolUsuario,
    actualizarUsuarioCompleto,
    crearUsuarioEmpresa,
    cambiarPassword
};