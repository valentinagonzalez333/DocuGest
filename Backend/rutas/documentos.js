const express = require('express');
const router = express.Router();
const {
    subirArchivos,
    crearDocumento,
    listarDocumentos,
    editarDocumento,
    revisarVersion,
    restablecerOriginal,
    obtenerHistorialVersiones,
    firmarMemorando
} = require('../Controladores/documento');

const { verificarPermisoDoc, soloAdmin, autenticado } = require('../config/verificarP');

router.get('/:empresaId', verificarPermisoDoc('leer'), listarDocumentos);
router.get('/historial/:empresaId/:consecutivo', verificarPermisoDoc('leer'), obtenerHistorialVersiones);
router.post('/', verificarPermisoDoc('crear'), subirArchivos, crearDocumento);

router.put('/:id/firmar', autenticado, firmarMemorando);
router.put('/:id/revisar', soloAdmin, revisarVersion);
router.put('/restablecer/:empresaId/:consecutivo', soloAdmin, restablecerOriginal);
router.put('/:id', verificarPermisoDoc('editar'), subirArchivos, editarDocumento);

module.exports = router;