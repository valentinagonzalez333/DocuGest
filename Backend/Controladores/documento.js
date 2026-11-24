const Documento = require('../modelos/documento');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Empleado = require('../modelos/empleado');

const { subirACloudinary } = require('../config/almacenamiento');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

const subirArchivos = (req, res, next) => {
    upload.array('archivos', 10)(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            const mensaje = err.code === 'LIMIT_FILE_SIZE'
                ? 'Cada archivo puede pesar máximo 10 MB.'
                : err.message;
            return res.status(400).json({ mensaje });
        }
        if (err) return next(err);
        subirACloudinary(req, res, next);
    });
};

const mismaEmpresa = (req, empresaId) =>
    req.usuario.rol === 'admin_plataforma' || String(req.usuario.empresaId) === String(empresaId);



const crearDocumento = async (req, res) => {
    try {
        const { tipoDocumento, titulo, descripcion, areaResponsable, firmantesInvolucrados, empleadoId } = req.body;


        const empresaId = req.usuario.rol === 'admin_plataforma' && req.body.empresaId
            ? req.body.empresaId
            : req.usuario.empresaId;

        const tipo = String(tipoDocumento || '').toLowerCase();
        if (!tipo) {
            return res.status(400).json({ mensaje: 'Selecciona el tipo de documento.' });
        }

        if (tipo === 'acta') {
            return res.status(400).json({ mensaje: 'Las actas se crean en el módulo Compromisos & Actas.' });
        }

        if (tipo === 'memorando') {
            if (req.usuario.rol !== 'admin_empresa') {
                return res.status(403).json({ mensaje: 'Solo un administrador puede crear memorandos.' });
            }
            const emp = mongoose.isValidObjectId(empleadoId)
                ? await Empleado.findOne({ _id: empleadoId, empresaId })
                : null;
            if (!emp) {
                return res.status(400).json({ mensaje: 'Selecciona el empleado al que va dirigido el memorando.' });
            }
            if (emp.usuarioId && String(emp.usuarioId) === String(req.usuario._id)) {
                return res.status(400).json({ mensaje: 'No puedes enviarte un memorando a ti mismo.' });
            }
            if (!emp.usuarioId) {
                return res.status(400).json({ mensaje: 'Este empleado no tiene una cuenta de usuario para firmar el memorando.' });
            }
        }

        const prefijos = {
            acta: 'ACT',
            contrato: 'CON',
            informe: 'INF',
            certificado: 'CER',
            visita: 'VIS',
            memorando: 'MEM',
            carta: 'CAR'
        };

        const prefijo = (prefijos[tipo] || 'DOC').toUpperCase();
        const anioActual = new Date().getFullYear();

        const inicioAnio = new Date(`${anioActual}-01-01T00:00:00.000Z`);
        const finAnio = new Date(`${anioActual}-12-31T23:59:59.999Z`);

        const cantidad = await Documento.countDocuments({
            empresaId,
            tipoDocumento: tipo,
            createdAt: { $gte: inicioAnio, $lte: finAnio },
            documentoPadreId: null
        });

        const numeroCorrelativo = String(cantidad + 1).padStart(4, '0');
        const consecutivoGenerado = `${prefijo}-${anioActual}-${numeroCorrelativo}`;

        let arrayFirmantes = [];
        if (firmantesInvolucrados) {
            arrayFirmantes = typeof firmantesInvolucrados === 'string'
                ? firmantesInvolucrados.split(',').map(s => s.trim()).filter(Boolean)
                : firmantesInvolucrados;
        }

        const archivosAdjuntos = req.files ? req.files.map(file => ({
            nombreOriginal: file.originalname,
            ruta: file.filename,
            mimetype: file.mimetype,
            tamanio: file.size
        })) : [];

        const nuevoDocumento = new Documento({
            empresaId,
            tipoDocumento: tipo,
            consecutivo: consecutivoGenerado,
            titulo,
            descripcion,
            areaResponsable,
            firmantesInvolucrados: arrayFirmantes,
            estado: 'vigente',
            version: 1,
            archivos: archivosAdjuntos,
            creadoPor: req.usuario._id,
            empleadoId: tipo === 'memorando' ? empleadoId : null
        });

        await nuevoDocumento.save();

        res.status(201).json({
            mensaje: 'Documento registrado con éxito',
            documento: nuevoDocumento
        });

    } catch (error) {
        console.error('Error al crear documento:', error);
        res.status(500).json({ mensaje: 'Error interno al registrar el documento.' });
    }
};

const promoverVersion = async (version, adminId, comentario) => {
    await Documento.updateMany(
        { empresaId: version.empresaId, consecutivo: version.consecutivo, estado: 'vigente', _id: { $ne: version._id } },
        { $set: { estado: 'archivado' } }
    );
    version.estado = 'vigente';
    version.revisadoPor = adminId;
    version.fechaDecision = new Date();
    if (comentario) version.comentarioDecision = comentario;
    await version.save();
};

const listarDocumentos = async (req, res) => {
    try {
        const { empresaId } = req.params;
        if (!mismaEmpresa(req, empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        const filtro = { empresaId, estado: 'vigente' };
        if (req.usuario.rol !== 'admin_empresa') filtro.tipoDocumento = { $ne: 'memorando' };

        const vigentes = await Documento.find(filtro)
            .populate('creadoPor', 'nombre')
            .populate('editadoPor', 'nombre')
            .sort({ updatedAt: -1 })
            .lean();

        const pendientes = await Documento.find({ empresaId, estado: 'pendiente_aprobacion' })
            .populate('editadoPor', 'nombre')
            .lean();

        const mapaPendientes = new Map(pendientes.map(p => [p.consecutivo, p]));
        const documentos = vigentes.map(d => ({ ...d, pendiente: mapaPendientes.get(d.consecutivo) || null }));

        res.status(200).json({ documentos });
    } catch (error) {
        console.error('Error al listar documentos:', error);
        res.status(500).json({ mensaje: 'Error al obtener los documentos.' });
    }
};

const editarDocumento = async (req, res) => {
    try {
        const { id } = req.params;
        const { titulo, descripcion, areaResponsable, tipoDocumento, firmantesInvolucrados, archivosAEliminar } = req.body;

        const actual = await Documento.findById(id);
        if (!actual) return res.status(404).json({ mensaje: 'Documento no encontrado.' });
        if (!mismaEmpresa(req, actual.empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });
        if (actual.estado !== 'vigente') {
            return res.status(400).json({ mensaje: 'Solo se puede editar la versión vigente del documento.' });
        }

        const tipoNuevo = String(tipoDocumento || actual.tipoDocumento).toLowerCase();
        if ((actual.tipoDocumento === 'memorando' || tipoNuevo === 'memorando') && req.usuario.rol !== 'admin_empresa') {
            return res.status(403).json({ mensaje: 'Solo un administrador puede crear o modificar memorandos.' });
        }

        if ((actual.tipoDocumento === 'memorando') !== (tipoNuevo === 'memorando')) {
            return res.status(400).json({ mensaje: 'No se puede convertir un documento en memorando, ni un memorando en otro tipo.' });
        }

        const hayPendiente = await Documento.exists({
            empresaId: actual.empresaId, consecutivo: actual.consecutivo, estado: 'pendiente_aprobacion'
        });
        if (hayPendiente) {
            return res.status(409).json({ mensaje: 'Este documento ya tiene un cambio pendiente de aprobación.' });
        }

        let arrayFirmantes = actual.firmantesInvolucrados;
        if (firmantesInvolucrados !== undefined) {
            arrayFirmantes = typeof firmantesInvolucrados === 'string'
                ? firmantesInvolucrados.split(',').map(s => s.trim()).filter(Boolean)
                : (Array.isArray(firmantesInvolucrados) ? firmantesInvolucrados : []);
        }

        let idsEliminar = [];
        if (archivosAEliminar) {
            try { idsEliminar = JSON.parse(archivosAEliminar); }
            catch (e) { console.error('Error al parsear archivosAEliminar:', e); }
        }

        const archivosConservados = actual.archivos
            .filter(a => !idsEliminar.includes(a._id.toString()))
            .map(a => ({ nombreOriginal: a.nombreOriginal, ruta: a.ruta, mimetype: a.mimetype, tamanio: a.tamanio }));

        const nuevosArchivos = (req.files || []).map(file => ({
            nombreOriginal: file.originalname,
            ruta: file.filename,
            mimetype: file.mimetype,
            tamanio: file.size
        }));

        const ultima = await Documento.findOne({ empresaId: actual.empresaId, consecutivo: actual.consecutivo })
            .sort({ version: -1 });


        const nueva = new Documento({
            empresaId: actual.empresaId,
            tipoDocumento: tipoNuevo,
            consecutivo: actual.consecutivo,
            titulo: titulo || actual.titulo,
            descripcion: descripcion !== undefined ? descripcion : actual.descripcion,
            areaResponsable: areaResponsable || actual.areaResponsable,
            firmantesInvolucrados: arrayFirmantes,
            archivos: [...archivosConservados, ...nuevosArchivos],
            estado: 'pendiente_aprobacion',
            version: ultima.version + 1,
            documentoPadreId: actual.documentoPadreId || actual._id,
            creadoPor: actual.creadoPor,
            empleadoId: actual.empleadoId,
            editadoPor: req.usuario._id
        });

        await nueva.save();

        if (req.usuario.rol === 'admin_empresa') {
            await promoverVersion(nueva, req.usuario._id, 'Cambio realizado directamente por el administrador');
            return res.status(200).json({ mensaje: 'Documento actualizado correctamente.', documento: nueva });
        }

        res.status(202).json({
            mensaje: 'Cambio enviado. Quedará pendiente hasta que un administrador lo apruebe.',
            documento: nueva
        });
    } catch (error) {
        console.error('Error al editar documento:', error);
        res.status(500).json({ mensaje: 'Error interno al procesar la edición del documento.' });
    }
};

const revisarVersion = async (req, res) => {
    try {
        const { id } = req.params;
        const { decision, comentario } = req.body;

        const version = await Documento.findById(id);
        if (!version) return res.status(404).json({ mensaje: 'Versión no encontrada.' });
        if (!mismaEmpresa(req, version.empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });
        if (version.estado !== 'pendiente_aprobacion') {
            return res.status(400).json({ mensaje: 'Esta versión ya fue revisada.' });
        }

        if (decision === 'aprobar') {
            await promoverVersion(version, req.usuario._id, comentario);
            return res.status(200).json({ mensaje: 'Cambio aprobado. La nueva versión ya es la vigente.' });
        }

        if (decision === 'rechazar') {
            version.estado = 'rechazado';
            version.revisadoPor = req.usuario._id;
            version.fechaDecision = new Date();
            version.comentarioDecision = comentario;
            await version.save();
            return res.status(200).json({ mensaje: 'El cambio propuesto fue rechazado.' });
        }

        res.status(400).json({ mensaje: 'Decisión no válida.' });
    } catch (error) {
        console.error('Error al revisar versión:', error);
        res.status(500).json({ mensaje: 'Error interno al procesar la revisión.' });
    }
};

const restablecerOriginal = async (req, res) => {
    try {
        const { empresaId, consecutivo } = req.params;
        if (!mismaEmpresa(req, empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        const original = await Documento.findOne({ empresaId, consecutivo, version: 1 });
        if (!original) return res.status(404).json({ mensaje: 'No se encontró la versión original.' });

        const vigente = await Documento.findOne({ empresaId, consecutivo, estado: 'vigente' });
        if (vigente && (vigente.version === 1 || vigente.restauradoDeVersion === 1)) {
            return res.status(400).json({ mensaje: 'El documento ya está en su versión original.' });
        }

        await Documento.updateMany(
            { empresaId, consecutivo, estado: 'pendiente_aprobacion' },
            {
                $set: {
                    estado: 'rechazado',
                    revisadoPor: req.usuario._id,
                    fechaDecision: new Date(),
                    comentarioDecision: 'Cancelado: el documento fue restablecido a su versión original.'
                }
            }
        );

        const ultima = await Documento.findOne({ empresaId, consecutivo }).sort({ version: -1 });

        const restaurada = new Documento({
            empresaId,
            tipoDocumento: original.tipoDocumento,
            consecutivo,
            titulo: original.titulo,
            descripcion: original.descripcion,
            areaResponsable: original.areaResponsable,
            firmantesInvolucrados: original.firmantesInvolucrados,
            archivos: original.archivos.map(a => ({
                nombreOriginal: a.nombreOriginal, ruta: a.ruta, mimetype: a.mimetype, tamanio: a.tamanio
            })),
            estado: 'pendiente_aprobacion',
            version: ultima.version + 1,
            documentoPadreId: original._id,
            creadoPor: original.creadoPor,
            empleadoId: original.empleadoId,
            editadoPor: req.usuario._id,
            restauradoDeVersion: 1
        });
        await restaurada.save();
        await promoverVersion(restaurada, req.usuario._id, 'Restablecido a la versión original');

        res.status(200).json({ mensaje: 'Documento restablecido a su versión original.' });
    } catch (error) {
        console.error('Error al restablecer:', error);
        res.status(500).json({ mensaje: 'Error interno al restablecer el documento.' });
    }
};

const obtenerHistorialVersiones = async (req, res) => {
    try {
        const { consecutivo, empresaId } = req.params;
        if (!mismaEmpresa(req, empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        const historial = await Documento.find({ empresaId, consecutivo })
            .populate('creadoPor', 'nombre')
            .populate('editadoPor', 'nombre')
            .populate('revisadoPor', 'nombre')
            .sort({ version: -1 });

        res.status(200).json({ historial });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ mensaje: 'Error al obtener el historial de versiones.' });
    }
};

const firmarMemorando = async (req, res) => {
    try {
        const firma = String(req.body?.firma ?? '').trim().replace(/\s+/g, ' ');
        if (!firma) return res.status(400).json({ mensaje: 'Escribe tu firma para firmar el memorando.' });
        if (firma.length > 80) return res.status(400).json({ mensaje: 'La firma no puede superar los 80 caracteres.' });

        const doc = await Documento.findById(req.params.id);
        if (!doc) return res.status(404).json({ mensaje: 'Memorando no encontrado.' });
        if (doc.tipoDocumento !== 'memorando') {
            return res.status(400).json({ mensaje: 'Solo los memorandos se firman.' });
        }
        if (!mismaEmpresa(req, doc.empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });
        if (doc.estado !== 'vigente') {
            return res.status(400).json({ mensaje: 'Solo se puede firmar la versión vigente del memorando.' });
        }

        const emp = doc.empleadoId ? await Empleado.findById(doc.empleadoId) : null;
        if (!emp || !emp.usuarioId || String(emp.usuarioId) !== String(req.usuario._id)) {
            return res.status(403).json({ mensaje: 'Solo el destinatario del memorando puede firmarlo.' });
        }

        const firmado = await Documento.findOneAndUpdate(
            { _id: doc._id, estado: 'vigente', 'firmas.usuarioId': { $ne: req.usuario._id } },
            { $push: { firmas: { usuarioId: req.usuario._id, nombre: firma, fecha: new Date() } } },
            { new: true }
        );
        if (!firmado) return res.status(400).json({ mensaje: 'Ya firmaste este memorando.' });

        res.status(200).json({ mensaje: 'Memorando firmado correctamente.' });
    } catch (error) {
        console.error('Error al firmar memorando:', error);
        res.status(500).json({ mensaje: 'Error interno al firmar el memorando.' });
    }
};

module.exports = {
    upload,
    crearDocumento,
    listarDocumentos,
    editarDocumento,
    revisarVersion,
    restablecerOriginal,
    obtenerHistorialVersiones,
    firmarMemorando,
    subirArchivos
};