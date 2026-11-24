const jwt = require('jsonwebtoken');
const Usuario = require('../modelos/usuario');



const cargarUsuario = async (req, res) => {
    const cabecera = req.headers.authorization || '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7).trim() : '';

    if (!token) {
        res.status(401).json({ mensaje: 'Debes iniciar sesión para continuar.' });
        return null;
    }

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch (error) {
        res.status(401).json({ mensaje: 'Tu sesión expiró. Inicia sesión de nuevo.' });
        return null;
    }

    const usuario = await Usuario.findById(payload.sub);
    if (!usuario) {
        res.status(401).json({ mensaje: 'Usuario no encontrado.' });
        return null;
    }
    if (usuario.estado === 'inactivo') {
        res.status(403).json({ mensaje: 'Tu cuenta está inactiva.' });
        return null;
    }

    req.usuario = usuario;
    return usuario;
};


const verificarPermiso = (modulo, accionRequerida) => {
    return async (req, res, next) => {
        try {
            const usuario = await cargarUsuario(req, res);
            if (!usuario) return;

            if (usuario.rol === 'admin_empresa') return next();

            const permisos = (usuario.permisos?.[modulo] || []).map(p => String(p).toLowerCase());
            if (!permisos.includes(accionRequerida)) {
                return res.status(403).json({
                    mensaje: `Acción no autorizada. Tu cuenta no tiene permisos para '${accionRequerida}' en ${modulo}.`
                });
            }
            next();
        } catch (error) {
            console.error('Error al verificar permisos:', error);
            res.status(500).json({ mensaje: 'Error interno al validar permisos de usuario.' });
        }
    };
};

const verificarPermisoDoc = (accion) => verificarPermiso('documentos', accion);

const soloAdmin = async (req, res, next) => {
    try {
        const usuario = await cargarUsuario(req, res);
        if (!usuario) return;

        if (usuario.rol !== 'admin_empresa') {
            return res.status(403).json({ mensaje: 'Solo un administrador puede realizar esta acción.' });
        }
        next();
    } catch (error) {
        console.error('Error al verificar admin:', error);
        res.status(500).json({ mensaje: 'Error interno al validar permisos de usuario.' });
    }
};

const autenticado = async (req, res, next) => {
    try {
        const usuario = await cargarUsuario(req, res);
        if (!usuario) return;

        next();
    } catch (error) {
        console.error('Error al verificar autenticación:', error);
        res.status(500).json({ mensaje: 'Error interno al validar autenticación de usuario.' });
    }
};

module.exports = { verificarPermiso, verificarPermisoDoc, soloAdmin, autenticado };