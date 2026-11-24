const router = require('express').Router();
const { soloAdmin, autenticado } = require('../config/verificarP'); 
const {
    obtenerMiExpediente, actualizarMiExpediente,
    listarEmpleados, obtenerEmpleado, actualizarEmpleado
} = require('../Controladores/empleado');

router.get('/mi-expediente', autenticado, obtenerMiExpediente);
router.put('/mi-expediente', autenticado, actualizarMiExpediente);

router.get('/empresa/:empresaId', soloAdmin, listarEmpleados);
router.get('/:id', soloAdmin, obtenerEmpleado);
router.put('/:id', soloAdmin, actualizarEmpleado);

module.exports = router;