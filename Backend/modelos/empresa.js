const mongoose = require('mongoose');

const EmpresaSchema = new mongoose.Schema({
    nombre: { type: String, required: true, trim: true },
    identificacionEmpresarial: { type: String, trim: true }, 
    datosContacto: {
        telefono: String,
        correo: String
    },
    estado: { type: String, enum: ['activo', 'suspendido'], default: 'activo' }
}, { timestamps: true });

module.exports = mongoose.model('Empresa', EmpresaSchema);
