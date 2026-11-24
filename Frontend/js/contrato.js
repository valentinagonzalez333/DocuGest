
(() => {
    const TIPOS = [
        ['', '— Sin definir —'],
        ['indefinido', 'Término indefinido'],
        ['fijo', 'Término fijo'],
        ['prestacion_servicios', 'Prestación de servicios'],
        ['obra_labor', 'Obra o labor']
    ];

    const CARGO_POR_ROL = {
        admin_empresa: 'Administrador',
        usuario_personalizado: 'Usuario'
    };
    const cargoPorRol = (rol) => CARGO_POR_ROL[rol] || 'Usuario';

  
    const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

    
    const enlazar = ({ tipo, estado, ingreso, fin, etiqueta, finOriginal = '' }) => {
        const actualizar = () => {
            const t = tipo.value;
            const est = estado ? estado.value : '';
            const hoy = hoyBogota();

            let habilitado = true;
            let requerido = false;
            let texto = 'Contrato hasta';

            if (!t) {
                habilitado = false;
            } else if (t === 'indefinido') {
                texto = 'Fecha de retiro (solo si se retira)';
                habilitado = est === 'retirado';
            } else if (t === 'obra_labor') {
                texto = 'Contrato hasta (estimada, opcional)';
            } else {
                requerido = true;
            }

            etiqueta.textContent = texto;
            fin.disabled = !habilitado;
            fin.required = habilitado && requerido;
            fin.style.background = habilitado ? '' : '#f1f5f9';
            if (!habilitado) fin.value = '';

        
            let min = ingreso.value || '';
            if (t && t !== 'indefinido') {
       
                const vencidoSinCambio = finOriginal && finOriginal < hoy;
                if (!vencidoSinCambio && hoy > min) min = hoy;
            }
            if (min) fin.min = min; else fin.removeAttribute('min');
        };

        [tipo, estado, ingreso].forEach(el => {
            if (!el) return;
            el.addEventListener('change', actualizar);
            el.addEventListener('input', actualizar);
        });
        actualizar();
        return actualizar;
    };


    const validar = ({ tipo, estado, ingreso, fin, finOriginal = '' }) => {
        const hoy = hoyBogota();

        if (tipo && !ingreso) return 'La fecha de ingreso es obligatoria cuando hay tipo de contrato.';

        if ((tipo === 'fijo' || tipo === 'prestacion_servicios') && !fin) {
            return 'Este tipo de contrato necesita la fecha "hasta".';
        }
        if (fin && ingreso && fin < ingreso) {
            return 'La fecha final no puede ser anterior a la fecha de ingreso.';
        }
        if (fin && tipo && tipo !== 'indefinido' && fin !== finOriginal && fin < hoy) {
            return 'La fecha "hasta" no puede ser anterior a hoy.';
        }
        if (fin && tipo === 'indefinido' && estado !== 'retirado') {
            return 'Un contrato indefinido solo tiene fecha de retiro cuando el empleado se retira.';
        }
        return null;
    };

    window.Contrato = { TIPOS, cargoPorRol, hoyBogota, enlazar, validar };
})();