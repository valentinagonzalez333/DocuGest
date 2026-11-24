const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema({
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    nombre: { type: String, required: true, trim: true },
    correo: { type: String, required: true, unique: true, lowercase: true, trim: true },
    contrasenahash: { type: String, required: true },
    rol: { type: String, enum: ['admin_plataforma', 'admin_empresa', 'usuario_personalizado'], required: true },
    estado: { type: String, enum: ['activo', 'inactivo'], default: 'activo' },
        permisos: {
        documentos: [{ type: String, enum: ['leer', 'crear', 'editar', 'archivar', 'anular', 'descargar'] }],
        compromisos: [{ type: String, enum: ['leer', 'crear', 'editar'] }]
    },
    cambiarPassword: { type: Boolean, default: true }

}, { timestamps: true });


UsuarioSchema.pre('save', async function() {
    if (!this.isModified('contrasenahash')) return;
    const salt = await bcrypt.genSalt(10);
    this.contrasenahash = await bcrypt.hash(this.contrasenahash, salt);
});

module.exports = mongoose.model('Usuario', UsuarioSchema);