const Usuario = require('../modelos/usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const DURACION_SESION = '8h';

const login = async (req, res) => {
    try {
        const { correo, contrasenahash } = req.body;

        if (typeof correo !== 'string' || typeof contrasenahash !== 'string') {
            return res.status(400).json({ mensaje: 'Correo o contraseña incorrectos.' });
        }

        const usuario = await Usuario.findOne({ correo: correo.toLowerCase().trim() });
        if (!usuario) {
            return res.status(400).json({ mensaje: 'Correo o contraseña incorrectos.' });
        }

        if (usuario.estado !== 'activo') {
            return res.status(403).json({ mensaje: 'El usuario se encuentra inactivo.' });
        }

        const esPassword = await bcrypt.compare(contrasenahash, usuario.contrasenahash);
        if (!esPassword) {
            return res.status(400).json({ mensaje: 'Correo o contraseña incorrectos.' });
        }

        const Empresa = require('../modelos/empresa');
        const empresa = await Empresa.findById(usuario.empresaId);
        const nombreEmpresa = empresa ? empresa.nombre : 'Mi Empresa';

        
        const token = jwt.sign({ sub: String(usuario._id) }, process.env.JWT_SECRET, { expiresIn: DURACION_SESION });

        res.status(200).json({
            mensaje: 'Login exitoso',
            token,
            usuario: {
                id: usuario._id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: usuario.rol,
                empresaId: usuario.empresaId,
                nombreEmpresa: nombreEmpresa,
                cambiarPassword: usuario.cambiarPassword
            }
        });

    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor' });
    }
};

module.exports = { login };