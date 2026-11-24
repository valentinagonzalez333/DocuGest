const mongoose = require('mongoose');

const ArchivoSchema = new mongoose.Schema({
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    nombreOriginal: { type: String, required: true },
    nombreAlmacenado: { type: String, required: true }, 
    rutaPrivada: { type: String, required: true }, 
    tipo: { type: String, required: true }, 
    tamano: { type: Number, required: true }, 
    subidoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true }
}, { timestamps: true });

module.exports = mongoose.model('Archivo', ArchivoSchema);
