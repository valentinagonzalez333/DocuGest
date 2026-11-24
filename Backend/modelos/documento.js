const mongoose = require('mongoose');

const ArchivoSchema = new mongoose.Schema({
    nombreOriginal: { type: String, required: true },
    ruta: { type: String, required: true },
    mimetype: { type: String, required: true },
    tamanio: { type: Number, required: true }
});


const FirmaSchema = new mongoose.Schema({
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    nombre: { type: String, required: true, trim: true },
    fecha: { type: Date, default: Date.now }
}, { _id: false });

const DocumentoSchema = new mongoose.Schema({
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    tipoDocumento: { type: String, required: true, lowercase: true, trim: true },
    consecutivo: { type: String, required: true },
    titulo: { type: String, required: true, trim: true },
    descripcion: { type: String, trim: true },
    areaResponsable: { type: String, required: true, trim: true },
    firmantesInvolucrados: { type: [String], default: [] },
    firmas: { type: [FirmaSchema], default: [] },
    estado: { type: String, enum: ['vigente', 'pendiente_aprobacion', 'rechazado', 'archivado', 'anulado'], default: 'vigente' },
    version: { type: Number, default: 1 },
    documentoPadreId: { type: mongoose.Schema.Types.ObjectId, ref: 'Documento', default: null },
    archivos: [ArchivoSchema],
    creadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
    empleadoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empleado', default: null, index: true },
    comentarioDecision: { type: String, trim: true },
    editadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },   // quién propuso/hizo este cambio
    revisadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },  // admin que aprobó o rechazó
    fechaDecision: { type: Date, default: null },
    restauradoDeVersion: { type: Number, default: null }
}, { timestamps: true });

DocumentoSchema.index({ empresaId: 1, consecutivo: 1 },
    { unique: true, partialFilterExpression: { estado: 'vigente' } }
);

module.exports = mongoose.model('Documento', DocumentoSchema);