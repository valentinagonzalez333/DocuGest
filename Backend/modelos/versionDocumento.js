const mongoose = require('mongoose');

const VersionDocumentoSchema = new mongoose.Schema({
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    documentoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Documento', required: true, index: true },
    numeroVersion: { type: Number, required: true }, 
    archivos: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Archivo' }], 
    estado: { type: String, enum: ['pendiente', 'aprobado', 'rechazado'], default: 'pendiente' },
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    revisadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' },
    comentarioRevision: { type: String } 
}, { timestamps: true });

module.exports = mongoose.model('VersionDocumento', VersionDocumentoSchema);
