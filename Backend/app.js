require("node:dns").setServers(["1.1.1.1", "8.8.8.8"]);
require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const conectarDB = require('./config/conexion');
const { redirigirArchivo } = require('./config/almacenamiento');
const rutasLogin = require('./rutas/login');
const rutasDocumentos = require('./rutas/documentos');
const rutasCompromisos = require('./rutas/compromisos');
const rutasUsuarios = require('./rutas/usuarios');
const rutasEmpleados = require('./rutas/empleados');
const rutasDashboard = require('./rutas/dashboard');
const rutasRecuperacion = require('./rutas/recuperacion');

if (!process.env.JWT_SECRET) {
    throw new Error('Falta la variable de entorno JWT_SECRET.');
}

const FRONTEND = path.join(__dirname, '../Frontend');

const app = express();


app.set('trust proxy', 1);


app.use(helmet({ contentSecurityPolicy: false }));


app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/uploads/:nombre', redirigirArchivo);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(FRONTEND));

const limiteLogin = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    limit: 15,                // Máximo 15 intentos por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos de inicio de sesión. Espera unos minutos e inténtalo de nuevo.' }
});



const limiteRecuperacion = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensaje: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.' }
});




app.use('/api/login', limiteLogin);
app.use('/api', rutasLogin);
app.use('/api/documentos', rutasDocumentos);
app.use('/api/compromisos', rutasCompromisos);
app.use('/api/usuarios', rutasUsuarios);
app.use('/api/empleados', rutasEmpleados);
app.use('/api/dashboard', rutasDashboard);
app.use('/api/recuperacion', limiteRecuperacion, rutasRecuperacion);

const PAGINAS = {
    '/': 'index.html',
    '/login': 'index.html',
    '/registro': 'html/registro.html',
    '/recuperar': 'html/recuperar.html',
    '/panel': 'html/panel.html',
    '/documentos': 'html/documentos.html',
    '/compromisos': 'html/compromisos.html',
    '/empleados': 'html/empleados.html',
    '/usuarios': 'html/usuarios.html',
    '/perfil': 'html/perfil.html',
    '/restablecer': 'html/restablecer.html',
};

for (const [url, archivo] of Object.entries(PAGINAS)) {
    app.get(url, (req, res) => res.sendFile(path.join(FRONTEND, archivo)));
}



conectarDB().then(() => {
    const puerto = process.env.PORT || 4000;
    app.listen(puerto, () => console.log(`http://localhost:${puerto}`));
});