const router = require('express').Router();
const { subirArchivos } = require('../Controladores/documento');
const { crearActa, listarActas, editarActa } = require('../Controladores/compromisos');
const { verificarPermiso } = require('../config/verificarP');

router.get('/:empresaId', verificarPermiso('compromisos', 'leer'), listarActas);
router.post('/', verificarPermiso('compromisos', 'crear'), subirArchivos, crearActa);
router.put('/:id', verificarPermiso('compromisos', 'editar'), subirArchivos, editarActa);

module.exports = router;