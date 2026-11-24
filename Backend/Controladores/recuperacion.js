const crypto = require('crypto');
const Usuario = require('../modelos/usuario');
const { enviarCorreo, plantillaRecuperacion } = require('../config/correo');

const MINUTOS_VALIDEZ = 30;



const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const MENSAJE_GENERICO =
    'Si el correo está registrado, te enviamos un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.';




const solicitarRecuperacion = async (req, res) => {
    const correo = typeof req.body?.correo === 'string' ? req.body.correo.toLowerCase().trim() : '';
    if (!correo) return res.status(400).json({ mensaje: 'Escribe tu correo.' });

    res.status(200).json({ mensaje: MENSAJE_GENERICO });

   
    try {
        const usuario = await Usuario.findOne({ correo });
        if (!usuario || usuario.estado !== 'activo') return;

        const token = crypto.randomBytes(32).toString('hex');
        await Usuario.updateOne({ _id: usuario._id }, {
            $set: {
                resetTokenHash: hashToken(token),
                resetExpira: new Date(Date.now() + MINUTOS_VALIDEZ * 60 * 1000)
            }
        });

        const base = (process.env.APP_URL || `http://localhost:${process.env.PORT || 4000}`).replace(/\/+$/, '');
        const enlace = `${base}/restablecer?token=${token}`;

        const { asunto, html, texto } = plantillaRecuperacion({
            nombre: usuario.nombre, enlace, minutos: MINUTOS_VALIDEZ
        });
        await enviarCorreo({ para: usuario.correo, asunto, html, texto });
    } catch (error) {
        console.error('Error al enviar el correo de recuperación:', error);
    }
};




const restablecerPassword = async (req, res) => {
    try {
        const { token, passwordNueva, passwordConfirmar } = req.body || {};
        const ENLACE_INVALIDO = 'El enlace no es válido o ya venció. Solicita uno nuevo.';

        if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
            return res.status(400).json({ mensaje: ENLACE_INVALIDO });
        }
        if (typeof passwordNueva !== 'string' || passwordNueva.length < 8) {
            return res.status(400).json({ mensaje: 'La nueva contraseña debe tener al menos 8 caracteres.' });
        }
        if (passwordNueva !== passwordConfirmar) {
            return res.status(400).json({ mensaje: 'La confirmación no coincide con la nueva contraseña.' });
        }

        const usuario = await Usuario.findOne({
            resetTokenHash: hashToken(token),
            resetExpira: { $gt: new Date() }
        }).select('+resetTokenHash +resetExpira');

        if (!usuario || usuario.estado !== 'activo') {
            return res.status(400).json({ mensaje: ENLACE_INVALIDO });
        }

        usuario.contrasenahash = passwordNueva; 
        usuario.cambiarPassword = false;
        usuario.resetTokenHash = null;         
        usuario.resetExpira = null;
        await usuario.save();

        res.status(200).json({ mensaje: 'Contraseña actualizada con éxito. Ya puedes iniciar sesión.' });
    } catch (error) {
        console.error('Error al restablecer la contraseña:', error);
        res.status(500).json({ mensaje: 'Error interno al restablecer la contraseña.' });
    }
};

module.exports = { solicitarRecuperacion, restablecerPassword };