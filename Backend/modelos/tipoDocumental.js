const mongoose = require('mongoose');

const TipoDocumentalSchema = new mongoose.Schema({
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    nombre: { type: String, required: true, trim: true }, 
    prefijo: { type: String, required: true, uppercase: true, trim: true }, 
    consecutivoActual: { type: Number, default: 0 },
    estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' }
}, { timestamps: true });

// Índice compuesto para evitar prefijos duplicados dentro de la MISMA empresa
TipoDocumentalSchema.index({ empresaId: 1, prefijo: 1 }, { unique: true });

module.exports = mongoose.model('TipoDocumental', TipoDocumentalSchema);
