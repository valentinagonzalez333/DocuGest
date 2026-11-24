const express = require('express');
const router = express.Router();
const { login } = require('../Controladores/login');
const { registrar } = require('../Controladores/registro');


router.post('/login', login);
router.post('/registro', registrar);

module.exports = router;