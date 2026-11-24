const mongoose = require('mongoose');

const EmpleadoSchema = new mongoose.Schema({
    empresaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true, index: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', default: null },

    nombres: { type: String, required: true, trim: true },
    apellidos: { type: String, trim: true, default: '' },
    documentoIdentidad: { type: String, trim: true },
    correo: { type: String, required: true, trim: true, lowercase: true },
    cargo: { type: String, trim: true },           
    departamento: { type: String, trim: true },
    fechaIngreso: { type: Date },
    tipoContrato: { type: String, enum: ['indefinido', 'fijo', 'prestacion_servicios', 'obra_labor'] },
    fechaFinContrato: { type: Date },             
    salario: { type: Number, min: 0 },
    estado: { type: String, enum: ['candidato', 'activo', 'vacaciones', 'suspendido', 'retirado'], default: 'activo' },

    telefono: { type: String, trim: true },
    direccion: { type: String, trim: true },
    ciudad: { type: String, trim: true },
    contactoEmergencia: { type: String, trim: true }
}, { timestamps: true });

EmpleadoSchema.index({ usuarioId: 1 }, { unique: true, partialFilterExpression: { usuarioId: { $type: 'objectId' } } });

EmpleadoSchema.index(
    { empresaId: 1, documentoIdentidad: 1 },
    { unique: true, partialFilterExpression: { documentoIdentidad: { $gt: '' } } }
);


EmpleadoSchema.statics.cargoPorRol = function (rol) {
    return rol === 'admin_empresa' ? 'Administrador' : 'Usuario';
};

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);



EmpleadoSchema.pre('validate', async function () {
    const cambio = (c) => this.isNew || this.isModified(c);

    const tipo = this.tipoContrato;
    const ingreso = dia(this.fechaIngreso);
    const fin = dia(this.fechaFinContrato);

    if (tipo && !ingreso && (cambio('tipoContrato') || cambio('fechaIngreso'))) {
        this.invalidate('fechaIngreso', 'La fecha de ingreso es obligatoria cuando hay tipo de contrato.');
    }

    if ((tipo === 'fijo' || tipo === 'prestacion_servicios') && !fin &&
        (cambio('tipoContrato') || cambio('fechaFinContrato'))) {
        this.invalidate('fechaFinContrato', 'Este tipo de contrato necesita la fecha "hasta".');
    }

    if (fin && ingreso && fin < ingreso && (cambio('fechaFinContrato') || cambio('fechaIngreso'))) {
        this.invalidate('fechaFinContrato', 'La fecha final no puede ser anterior a la fecha de ingreso.');
    }

    if (fin && tipo && tipo !== 'indefinido' && cambio('fechaFinContrato') && fin < hoyBogota()) {
        this.invalidate('fechaFinContrato', 'La fecha "hasta" no puede ser anterior a hoy.');
    }

    if (fin && tipo === 'indefinido' && this.estado !== 'retirado' &&
        (cambio('tipoContrato') || cambio('fechaFinContrato') || cambio('estado'))) {
        this.invalidate('fechaFinContrato', 'Un contrato indefinido solo tiene fecha de retiro cuando el empleado se retira.');
    }
});

module.exports = mongoose.model('Empleado', EmpleadoSchema);