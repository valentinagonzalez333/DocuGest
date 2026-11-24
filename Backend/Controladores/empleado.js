const Empleado = require('../modelos/empleado');
const Usuario = require('../modelos/usuario');
const Documento = require('../modelos/documento');

const CAMPOS_PERSONALES = ['telefono', 'direccion', 'ciudad', 'contactoEmergencia'];

const CAMPOS_ADMIN = [
    'nombres', 'apellidos', 'documentoIdentidad', 'correo', 'departamento',
    'fechaIngreso', 'tipoContrato', 'fechaFinContrato', 'salario', 'estado',
    ...CAMPOS_PERSONALES
];

const mismaEmpresa = (req, empresaId) =>
    req.usuario.rol === 'admin_plataforma' || String(req.usuario.empresaId) === String(empresaId);

const asegurarExpediente = async (usuario) => {
    const cargo = Empleado.cargoPorRol(usuario.rol);
    let emp = await Empleado.findOne({ usuarioId: usuario._id });
    if (!emp) {
        emp = await Empleado.create({
            empresaId: usuario.empresaId,
            usuarioId: usuario._id,
            nombres: usuario.nombre,
            correo: usuario.correo,
            cargo
        });
    } else if (emp.cargo !== cargo) {
        emp.cargo = cargo;
        await emp.save();
    }
    return emp;
};

const aplicarCampos = (emp, body, campos) => {
    for (const c of campos) {
        if (body[c] !== undefined) emp[c] = body[c] === '' ? undefined : body[c];
    }
};



const memorandosDe = async (emp) => {
    const memos = await Documento.find({
        empresaId: emp.empresaId, empleadoId: emp._id, tipoDocumento: 'memorando', estado: 'vigente'
    })
        .populate('creadoPor', 'nombre')
        .sort({ createdAt: -1 })
        .lean();

    return memos.map(m => {
        const firma = (m.firmas || []).find(f => String(f.usuarioId) === String(emp.usuarioId));
       return { ...m, firmado: !!firma, firmadoEl: firma ? firma.fecha : null, firmaTexto: firma ? firma.nombre : null };
    });
};

const responderError = (res, error, texto) => {
    if (error.name === 'ValidationError' || error.code === 11000) {
        const mensaje = error.code === 11000
            ? 'Ya existe un empleado con ese documento de identidad.'
            : Object.values(error.errors).map(e => e.message).join(' ');
        return res.status(400).json({ mensaje });
    }
    console.error(texto, error);
    res.status(500).json({ mensaje: texto });
};



const obtenerMiExpediente = async (req, res) => {
    try {
        const empleado = await asegurarExpediente(req.usuario);
        const memorandos = await memorandosDe(empleado);
        res.status(200).json({ empleado, memorandos });
    } catch (error) {
        responderError(res, error, 'Error al obtener tu expediente.');
    }
};

const actualizarMiExpediente = async (req, res) => {
    try {
        const empleado = await asegurarExpediente(req.usuario);
        aplicarCampos(empleado, req.body, CAMPOS_PERSONALES);
        await empleado.save();
        res.status(200).json({ mensaje: 'Tus datos fueron actualizados.', empleado });
    } catch (error) {
        responderError(res, error, 'Error al actualizar tu expediente.');
    }
};




const listarEmpleados = async (req, res) => {
    try {
        const { empresaId } = req.params;
        if (!mismaEmpresa(req, empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        const usuarios = await Usuario.find({ empresaId });
        const existentes = await Empleado.find({ empresaId }).select('usuarioId');
        const conExpediente = new Set(existentes.map(e => String(e.usuarioId)));
        for (const u of usuarios) {
            if (!conExpediente.has(String(u._id))) await asegurarExpediente(u);
        }



        const operaciones = usuarios.map(u => {
            const cargo = Empleado.cargoPorRol(u.rol);
            return {
                updateOne: {
                    filter: { usuarioId: u._id, cargo: { $ne: cargo } },
                    update: { $set: { cargo } }
                }
            };
        });
        if (operaciones.length) await Empleado.bulkWrite(operaciones);

        const empleados = await Empleado.find({ empresaId }).sort({ nombres: 1 });
        res.status(200).json({ empleados });
    } catch (error) {
        responderError(res, error, 'Error al obtener los empleados.');
    }
};

const obtenerEmpleado = async (req, res) => {
    try {
        const empleado = await Empleado.findById(req.params.id);
        if (!empleado) return res.status(404).json({ mensaje: 'Expediente no encontrado.' });
        if (!mismaEmpresa(req, empleado.empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        res.status(200).json({ empleado, memorandos: await memorandosDe(empleado) });
    } catch (error) {
        responderError(res, error, 'Error al obtener el expediente.');
    }
};

const actualizarEmpleado = async (req, res) => {
    try {
        const empleado = await Empleado.findById(req.params.id);
        if (!empleado) return res.status(404).json({ mensaje: 'Expediente no encontrado.' });
        if (!mismaEmpresa(req, empleado.empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        aplicarCampos(empleado, req.body, CAMPOS_ADMIN);
        await empleado.save();
        res.status(200).json({ mensaje: 'Expediente actualizado.', empleado });
    } catch (error) {
        responderError(res, error, 'Error al actualizar el expediente.');
    }
};

module.exports = { obtenerMiExpediente, actualizarMiExpediente, listarEmpleados, obtenerEmpleado, actualizarEmpleado };