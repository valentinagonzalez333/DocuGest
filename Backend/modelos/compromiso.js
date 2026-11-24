const mongoose = require('mongoose');

const ArchivoSchema = new mongoose.Schema({
    nombreOriginal: { type: String, required: true },
    ruta: { type: String, required: true },
    mimetype: { type: String, required: true },
    tamanio: { type: Number, required: true }
});

const ActaSchema = new mongoose.Schema({
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    consecutivo: { type: String, required: true },
    titulo: { type: String, required: true, trim: true },
    areaResponsable: { type: String, required: true, trim: true },
    firmantes: { type: [String], default: [] },
    fechaLimite: { type: Date, required: true },
    estado: { type: String, enum: ['pendiente', 'en_proceso', 'completado'], default: 'pendiente' },
    archivos: [ArchivoSchema],
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    editadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null }
}, { timestamps: true });

ActaSchema.index({ empresaId: 1, consecutivo: 1 }, { unique: true });

module.exports = mongoose.model('Acta', ActaSchema);