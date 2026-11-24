const Acta = require('../modelos/compromiso');
const Empleado = require('../modelos/empleado');
const Documento = require('../modelos/documento');

const DIA = 24 * 60 * 60 * 1000;

const mismaEmpresa = (req, empresaId) =>
    req.usuario.rol === 'admin_plataforma' || String(req.usuario.empresaId) === String(empresaId);

const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
const sumarDias = (fecha, n) => new Date(fecha.getTime() + n * DIA);




const resumen = async (req, res) => {
    try {
        const { empresaId } = req.params;
        if (!mismaEmpresa(req, empresaId)) return res.status(403).json({ mensaje: 'No autorizado.' });

        const esAdmin = ['admin_empresa', 'admin_plataforma'].includes(req.usuario.rol);
        const permisosComp = (req.usuario.permisos?.compromisos || []).map(p => String(p).toLowerCase());
        const puedeVerActas = esAdmin || permisosComp.includes('leer');




        const hoy = new Date(`${hoyBogota()}T00:00:00.000Z`);
        const en15 = sumarDias(hoy, 15);
        const en30 = sumarDias(hoy, 30);

        const respuesta = { compromisos: null, empleados: null, memorandos: null };

    


        if (puedeVerActas) {
            const abiertas = { empresaId, estado: { $in: ['pendiente', 'en_proceso'] } };
            const porVencer = { ...abiertas, fechaLimite: { $lte: en15 } }; 

            const [pendientes, vencidas, proximasTotal, proximas] = await Promise.all([
                Acta.countDocuments({ ...abiertas, fechaLimite: { $gte: hoy } }),
                Acta.countDocuments({ ...abiertas, fechaLimite: { $lt: hoy } }),
                Acta.countDocuments(porVencer),
                Acta.find(porVencer)
                    .sort({ fechaLimite: 1 })
                    .limit(8)
                    .select('consecutivo titulo areaResponsable fechaLimite')
                    .lean()
            ]);

            respuesta.compromisos = {
                pendientes,
                vencidas,
                proximasTotal,
                proximas: proximas.map(a => ({
                    consecutivo: a.consecutivo,
                    titulo: a.titulo,
                    areaResponsable: a.areaResponsable,
                    fechaLimite: new Date(a.fechaLimite).toISOString().slice(0, 10),
                    dias: Math.round((new Date(a.fechaLimite) - hoy) / DIA) 
                }))
            };
        }

       



        
        if (esAdmin) {
            const [activos, expedientes, contratosPorVencer, sinFirmar] = await Promise.all([
                Empleado.countDocuments({ empresaId, estado: 'activo' }),
                Empleado.countDocuments({ empresaId }),
                Empleado.countDocuments({
                    empresaId,
                    estado: { $ne: 'retirado' },
                    fechaFinContrato: { $gte: hoy, $lte: en30 }
                }),
                Documento.countDocuments({
                    empresaId, tipoDocumento: 'memorando', estado: 'vigente', 'firmas.0': { $exists: false }
                })
            ]);

            respuesta.empleados = { activos, expedientes, contratosPorVencer };
            respuesta.memorandos = { pendientesFirma: sinFirmar, alcance: 'empresa' };
        } else {
            const emp = await Empleado.findOne({ usuarioId: req.usuario._id }).select('_id');
            const pendientesFirma = emp
                ? await Documento.countDocuments({
                    empresaId,
                    empleadoId: emp._id,
                    tipoDocumento: 'memorando',
                    estado: 'vigente',
                    'firmas.usuarioId': { $ne: req.usuario._id }
                })
                : 0;
            respuesta.memorandos = { pendientesFirma, alcance: 'propios' };
        }

        res.status(200).json(respuesta);
    } catch (error) {
        console.error('Error al armar el resumen del panel:', error);
        res.status(500).json({ mensaje: 'Error al cargar el resumen del panel.' });
    }
};

module.exports = { resumen };