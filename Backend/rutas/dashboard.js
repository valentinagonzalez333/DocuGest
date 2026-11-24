const router = require('express').Router();
const { autenticado } = require('../config/verificarP');
const { resumen } = require('../Controladores/dashboard');

router.get('/:empresaId', autenticado, resumen);

module.exports = router;