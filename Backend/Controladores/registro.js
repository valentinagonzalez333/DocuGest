const Empresa = require('../modelos/empresa');
const Usuario = require('../modelos/usuario');

const registrar = async (req, res) => {
    try {
        const { nombre, 'nombre-empresa': nombreEmpresa, correo, contrasena, contrasenaConfirmar } = req.body;

       
        if (contrasena !== contrasenaConfirmar) {
            return res.status(400).json({ mensaje: 'Las contraseñas no coinciden.' });
        }

        if (contrasena.length < 8) {
            return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 8 caracteres.' });
        }

        
        const usuarioExistente = await Usuario.findOne({ correo });
        if (usuarioExistente) {
            return res.status(400).json({ mensaje: 'El correo electrónico ya está registrado.' });
        }




        let empresa = await Empresa.findOne({ nombre: nombreEmpresa });
        if (empresa) {
            return res.status(400).json({ mensaje: 'Ya existe una empresa registrada con ese nombre. Intenta con otro.' });
        }

        empresa = new Empresa({
            nombre: nombreEmpresa,
            estado: 'activo'
        });
        await empresa.save();

       
        const nuevoAdmin = new Usuario({
            empresaId: empresa._id,
            nombre,
            correo,
            contrasenahash: contrasena, 
            rol: 'admin_empresa',  
            estado: 'activo',
            permisos: {
                documentos: ['leer', 'crear', 'editar', 'archivar', 'anular', 'descargar'],
                laboral: ['gestionar_expedientes', 'solo_lectura']
            },
            cambiarPassword: false
        });

        await nuevoAdmin.save();

        res.status(201).json({
            mensaje: '¡Empresa y cuenta de administrador registradas con éxito!',
            usuario: {
                nombre: nuevoAdmin.nombre,
                correo: nuevoAdmin.correo,
                rol: nuevoAdmin.rol,
                empresaId: empresa._id
            }
        });

    } catch (error) {
        console.error('Error en el registro de empresa:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor al procesar el registro.' });
    }
};

module.exports = { registrar };