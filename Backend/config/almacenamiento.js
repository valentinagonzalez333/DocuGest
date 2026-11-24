const { v2: cloudinary } = require('cloudinary');


cloudinary.config({ secure: true });

const CARPETA = 'docugets';



const nombreSeguro = (nombre) =>
    String(nombre || 'archivo')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9._-]/g, '_')
        .slice(-80);

const subirBuffer = (buffer, publicId) => new Promise((resolve, reject) => {
    cloudinary.uploader
        .upload_stream({ resource_type: 'raw', public_id: publicId, overwrite: false }, (err, result) =>
            err ? reject(err) : resolve(result))
        .end(buffer);
});

const borrar = (ruta) =>
    cloudinary.uploader.destroy(`${CARPETA}/${ruta}`, { resource_type: 'raw' }).catch(() => { });




const subirACloudinary = async (req, res, next) => {
    const subidos = [];
    try {
        for (const f of req.files || []) {
            const ruta = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${nombreSeguro(f.originalname)}`;
            await subirBuffer(f.buffer, `${CARPETA}/${ruta}`);
            f.filename = ruta;
            delete f.buffer;
            subidos.push(ruta);
        }
        next();
    } catch (error) {
        console.error('Error al subir archivos a Cloudinary:', error);
        await Promise.all(subidos.map(borrar)); 
        res.status(502).json({ mensaje: 'No se pudo guardar el archivo. Inténtalo de nuevo.' });
    }
};




const redirigirArchivo = (req, res) => {
    const nombre = req.params.nombre;
    if (!/^[A-Za-z0-9._-]+$/.test(nombre)) return res.status(404).end();
    res.redirect(302, cloudinary.url(`${CARPETA}/${nombre}`, { resource_type: 'raw', secure: true }));
};

module.exports = { subirACloudinary, redirigirArchivo };