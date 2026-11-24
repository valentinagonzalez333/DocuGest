const Acta = require('../modelos/compromiso');

const mismaEmpresa = (req, empresaId) =>
    req.usuario.rol === 'admin_plataforma' || String(req.usuario.empresaId) === String(empresaId);

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
const fechaStr = (d) => new Date(d).toISOString().slice(0, 10);
const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS = ['pendiente', 'en_proceso', 'completado'];

const separarFirmantes = (valor) =>
    String(valor || '').split(',').map(s => s.trim()).filter(Boolean);




const conEstadoReal = (acta) => {
    const a = acta.toObject ? acta.toObject() : { ...acta };
    a.estadoGuardado = a.estado;
    if (a.estado !== 'completado' && fechaStr(a.fechaLimite) < hoyBogota()) a.estado = 'vencido';
    return a;
};

const crearActa = async (req, res) => {
    try {
        const { titulo, areaResponsable, firmantes, fechaLimite } = req.body;

        if (!FORMATO_FECHA.test(fechaLimite || '')) {
            return res.status(400).json({ mensaje: 'Fecha límite no válida.' });
        }
        if (fechaLimite < hoyBogota()) {
            return res.status(400).json({ mensaje: 'La fecha límite no puede ser anterior a hoy.' });
        }

        const anio = new Date().getFullYear();
        const cantidad = await Acta.countDocuments({
            empresaId: req.usuario.empresaId,
            consecutivo: new RegExp(`^ACT-${anio}-`)
        });
        const consecutivo = `ACT-${anio}-${String(cantidad + 1).padStart(4, '0')}`;

        const archivos = (req.files || []).map(f => ({
            nombreOriginal: f.originalname, ruta: f.filename, mimetype: f.mimetype, tamanio: f.size
        }));

        const acta = await Acta.create({
            empresaId: req.usuario.empresaId,
            consecutivo, titulo, areaResponsable,
            firmantes: separarFirmantes(firmantes),
            fechaLimite,
            archivos,
            creadoPor: req.usuario._id
        });

        res.status(201).json({ mensaje: 'Acta registrada con éxito', acta });
    } catch (error) {
        console.error('Error al crear acta:', error);
        res.status(500).json({ mensaje: 'Error interno al registrar el acta.' });
    }
};

const listarActas = async (req, res) => {
    try {
        const { empresaId } = req.params;
        if (!mismaEmpresa(req, empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        const actas = await Acta.find({ empresaId })
            .populate('creadoPor', 'nombre')
            .populate('editadoPor', 'nombre')
            .sort({ fechaLimite: 1 });

        res.status(200).json({ actas: actas.map(conEstadoReal) });
    } catch (error) {
        console.error('Error al listar actas:', error);
        res.status(500).json({ mensaje: 'Error al obtener las actas.' });
    }
};




const editarActa = async (req, res) => {
    try {
        const acta = await Acta.findById(req.params.id);
        if (!acta) return res.status(404).json({ mensaje: 'Acta no encontrada.' });
        if (!mismaEmpresa(req, acta.empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        const { titulo, areaResponsable, firmantes, fechaLimite, estado, archivosAEliminar } = req.body;
        const estadoPrevio = acta.estado;
        const fechaPrevia = fechaStr(acta.fechaLimite);

        if (titulo !== undefined) {
            const t = String(titulo).trim();
            if (!t) return res.status(400).json({ mensaje: 'El título no puede estar vacío.' });
            acta.titulo = t;
        }
        if (areaResponsable !== undefined) {
            const ar = String(areaResponsable).trim();
            if (!ar) return res.status(400).json({ mensaje: 'El área responsable no puede estar vacía.' });
            acta.areaResponsable = ar;
        }
        if (firmantes !== undefined) acta.firmantes = separarFirmantes(firmantes);

      


        if (fechaLimite !== undefined && fechaLimite !== fechaPrevia) {
            if (!FORMATO_FECHA.test(fechaLimite)) {
                return res.status(400).json({ mensaje: 'Fecha límite no válida.' });
            }
            if (fechaLimite < hoyBogota()) {
                return res.status(400).json({ mensaje: 'La fecha límite no puede ser anterior a hoy.' });
            }
            acta.fechaLimite = fechaLimite;
        }

        if (estado !== undefined) {
            if (!ESTADOS.includes(estado)) return res.status(400).json({ mensaje: 'Estado no válido.' });
            acta.estado = estado;
        }

  


        if (acta.estado !== estadoPrevio && acta.estado !== 'completado' &&
            fechaStr(acta.fechaLimite) < hoyBogota()) {
            return res.status(400).json({
                mensaje: 'Un acta vencida solo puede marcarse como completada, o debes ampliar la fecha límite.'
            });
        }

  

        
        let idsEliminar = [];
        if (archivosAEliminar) {
            try {
                const parsed = JSON.parse(archivosAEliminar);
                if (Array.isArray(parsed)) idsEliminar = parsed.map(String);
            } catch (e) {
                console.error('Error al parsear archivosAEliminar:', e);
            }
        }
        idsEliminar.forEach(id => acta.archivos.pull(id));

        (req.files || []).forEach(f => acta.archivos.push({
            nombreOriginal: f.originalname, ruta: f.filename, mimetype: f.mimetype, tamanio: f.size
        }));

        acta.editadoPor = req.usuario._id;
        await acta.save();

        const actualizada = await Acta.findById(acta._id)
            .populate('creadoPor', 'nombre')
            .populate('editadoPor', 'nombre');

        res.status(200).json({ mensaje: 'Acta actualizada.', acta: conEstadoReal(actualizada) });
    } catch (error) {
        console.error('Error al editar acta:', error);
        res.status(500).json({ mensaje: 'Error interno al actualizar el acta.' });
    }
};

module.exports = { crearActa, listarActas, editarActa };