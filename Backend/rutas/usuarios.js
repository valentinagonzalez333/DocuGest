const express = require('express');
const router = express.Router();
const {
    listarUsuariosEmpresa,
    actualizarRolUsuario,
    crearUsuarioEmpresa,
    cambiarPassword,
    actualizarUsuarioCompleto,
    obtenerPerfil
} = require('../Controladores/usuarios');
const { soloAdmin, autenticado } = require('../config/verificarP');

router.get('/perfil/:id', autenticado, obtenerPerfil);
router.get('/:empresaId', soloAdmin, listarUsuariosEmpresa);
router.post('/', soloAdmin, crearUsuarioEmpresa);
router.put('/:id/rol', soloAdmin, actualizarRolUsuario);
router.put('/cambiar-password', autenticado, cambiarPassword);
router.put('/:id', soloAdmin, actualizarUsuarioCompleto);

module.exports = router;