const router = require('express').Router();
const { solicitarRecuperacion, restablecerPassword } = require('../Controladores/recuperacion');

router.post('/solicitar', solicitarRecuperacion);
router.post('/restablecer', restablecerPassword);

module.exports = router;