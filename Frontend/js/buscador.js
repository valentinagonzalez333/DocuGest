

(() => {
    const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));

   
    const norm = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normCar = (t) => t.split('').map(c => c.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()).join('');

    const hoyBogota = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const sumarDias = (iso, n) => {
        const d = new Date(`${iso}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + n);
        return d.toISOString().slice(0, 10);
    };

   
    const separar = (q) => {
        const out = [];
        const re = /"([^"]+)"|(\S+)/g;
        const n = norm(q);
        let m;
        while ((m = re.exec(n))) out.push((m[1] || m[2]).trim());
        return out.filter(Boolean);
    };

    const crear = (cfg) => {
        const tbody = cfg.tbody;
        if (!tbody) return null;
        const tabla = tbody.closest('table');
        const contenedor = cfg.antesDe || tabla.parentElement;
        const excluirUltima = cfg.excluirUltima !== false; // la última columna es "Acciones"
        const filtros = cfg.filtros || [];
        const nombre = cfg.nombre || 'registros';
        const estado = { q: '', filtros: {}, desde: '', hasta: '', ventana: '', orden: '' };

       
        const raiz = document.createElement('div');
        raiz.className = 'buscador';
        raiz.innerHTML = `
            <div class="buscador-fila">
                <div class="buscador-caja">
                    <svg class="buscador-lupa" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
                    <input type="text" class="buscador-input" autocomplete="off" spellcheck="false" aria-label="Buscar">
                    <button type="button" class="buscador-x" aria-label="Borrar búsqueda" hidden>×</button>
                </div>
                <button type="button" class="buscador-toggle" aria-expanded="false">Filtros<span class="buscador-n" hidden>0</span></button>
                <span class="buscador-cuenta" aria-live="polite"></span>
            </div>
            <div class="buscador-panel" hidden></div>`;

        const input = raiz.querySelector('.buscador-input');
        const btnX = raiz.querySelector('.buscador-x');
        const btnToggle = raiz.querySelector('.buscador-toggle');
        const badge = raiz.querySelector('.buscador-n');
        const cuenta = raiz.querySelector('.buscador-cuenta');
        const panel = raiz.querySelector('.buscador-panel');
        input.placeholder = cfg.placeholder || 'Buscar…';

        const campo = (titulo, control) => `<label class="bf"><span>${esc(titulo)}</span>${control}</label>`;
        let html = '';

        for (const f of filtros) {
            const fijas = f.fijas ? f.fijas.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join('') : '';
            html += campo(f.etiqueta, `<select data-f="${esc(f.clave)}"><option value="">Todos</option>${fijas}</select>`);
        }
        if (cfg.ventana) {
            const v = cfg.ventana;
            html += campo(v.etiqueta, `<select data-v>
                <option value="">Cualquier fecha</option>
                <option value="hoy">Hoy</option>
                <option value="7">Próximos 7 días</option>
                <option value="15">Próximos 15 días</option>
                <option value="30">Próximos 30 días</option>
                <option value="pasada">${esc(v.etiquetaPasada || 'Ya pasó')}</option></select>`);
        }
        if (cfg.fecha) {
            html += `<div class="bf bf-fecha"><span>${esc(cfg.fecha.etiqueta)}</span>
                <div class="bf-rango">
                    <input type="date" data-d aria-label="${esc(cfg.fecha.etiqueta)} desde">
                    <input type="date" data-h aria-label="${esc(cfg.fecha.etiqueta)} hasta">
                </div></div>`;
        }
        if (cfg.orden && cfg.orden.length) {
            html += campo('Ordenar por', `<select data-o>
                <option value="">${esc(cfg.ordenOriginal || 'Orden original')}</option>
                ${cfg.orden.map(o => `<option value="${esc(o.valor)}">${esc(o.etiqueta)}</option>`).join('')}</select>`);
        }
        html += '<div class="bf bf-acc"><button type="button" class="buscador-limpiar">Limpiar filtros</button></div>';
        panel.innerHTML = html;

    

        const hayDe = (fila) => {
            if (fila._hay === undefined) {
                const celdas = Array.from(fila.cells);
                if (excluirUltima) celdas.pop();
                fila._hay = norm(celdas.map(c => c.textContent).join(' ') + ' ' + (fila.dataset.q || ''));
            }
            return fila._hay;
        };

        const pasa = (fila, tokens) => {
            const hay = hayDe(fila);
            if (!tokens.every(t => hay.includes(t))) return false;

            for (const f of filtros) {
                const val = estado.filtros[f.clave];
                if (!val) continue;
                const v = fila.dataset[f.clave] || '';
                if (f.multi ? !v.split('|').includes(val) : v !== val) return false;
            }

            if (cfg.fecha && (estado.desde || estado.hasta)) {
                const d = fila.dataset[cfg.fecha.clave];
                if (!d) return false;
                if (estado.desde && d < estado.desde) return false;
                if (estado.hasta && d > estado.hasta) return false;
            }

            if (cfg.ventana && estado.ventana) {
                const d = fila.dataset[cfg.ventana.clave];
                if (!d || (cfg.ventana.ignorar && cfg.ventana.ignorar(fila))) return false;
                const hoy = hoyBogota();
                if (estado.ventana === 'pasada') { if (!(d < hoy)) return false; }
                else if (estado.ventana === 'hoy') { if (d !== hoy) return false; }
                else if (d < hoy || d > sumarDias(hoy, Number(estado.ventana))) return false;
            }
            return true;
        };

        const comparador = () => {
            const o = (cfg.orden || []).find(x => x.valor === estado.orden);
            const original = (a, b) => Number(a.dataset.orig) - Number(b.dataset.orig);
            if (!o) return original;
            return (a, b) => {
                const va = a.dataset[o.clave] || '';
                const vb = b.dataset[o.clave] || '';
                if (!va && vb) return 1; // los vacíos van al final
                if (va && !vb) return -1;
                const c = va.localeCompare(vb, 'es', { numeric: true, sensitivity: 'base' });
                return (c * o.dir) || original(a, b);
            };
        };

        const reconstruirOpciones = (filas) => {
            for (const f of filtros) {
                if (f.fijas) continue;
                const sel = panel.querySelector(`select[data-f="${f.clave}"]`);
                const valores = new Set();
                filas.forEach(r => {
                    const v = r.dataset[f.clave];
                    if (v) (f.multi ? v.split('|') : [v]).forEach(x => x && valores.add(x));
                });
                const etiqueta = (v) => (f.etiquetas && f.etiquetas[v]) || (f.formato ? f.formato(v) : v);
                const lista = [...valores].sort((a, b) => etiqueta(a).localeCompare(etiqueta(b), 'es'));
                const actual = estado.filtros[f.clave] || '';
                sel.innerHTML = '<option value="">Todos</option>' +
                    lista.map(v => `<option value="${esc(v)}">${esc(etiqueta(v))}</option>`).join('');
                if (actual && valores.has(actual)) sel.value = actual;
                else estado.filtros[f.clave] = '';
                sel.closest('.bf').hidden = lista.length === 0;
            }
        };

        const quitarMarcas = (fila) => {
            fila.querySelectorAll('mark.bq').forEach(m => m.replaceWith(document.createTextNode(m.textContent)));
            fila.normalize();
        };

        const marcar = (fila, tokens) => {
            const celdas = Array.from(fila.cells);
            if (excluirUltima) celdas.pop();
            for (const celda of celdas) {
                const walker = document.createTreeWalker(celda, NodeFilter.SHOW_TEXT, {
                    acceptNode: (n) => (n.nodeValue.trim() && !n.parentElement.closest('button, input, select, textarea, mark'))
                        ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
                });
                const nodos = [];
                while (walker.nextNode()) nodos.push(walker.currentNode);

                for (const nodo of nodos) {
                    const texto = nodo.nodeValue;
                    const n = normCar(texto);
                    if (n.length !== texto.length) continue;

                    const rangos = [];
                    for (const t of tokens) {
                        let i = n.indexOf(t);
                        while (t && i !== -1) { rangos.push([i, i + t.length]); i = n.indexOf(t, i + t.length); }
                    }
                    if (!rangos.length) continue;

                    rangos.sort((a, b) => a[0] - b[0]);
                    const unidos = [rangos[0].slice()];
                    for (const [a, b] of rangos.slice(1)) {
                        const ult = unidos[unidos.length - 1];
                        if (a <= ult[1]) ult[1] = Math.max(ult[1], b); else unidos.push([a, b]);
                    }

                    const frag = document.createDocumentFragment();
                    let pos = 0;
                    for (const [a, b] of unidos) {
                        if (a > pos) frag.append(texto.slice(pos, a));
                        const m = document.createElement('mark');
                        m.className = 'bq';
                        m.textContent = texto.slice(a, b);
                        frag.append(m);
                        pos = b;
                    }
                    if (pos < texto.length) frag.append(texto.slice(pos));
                    nodo.replaceWith(frag);
                }
            }
        };

        const filtrosActivos = () =>
            filtros.filter(f => estado.filtros[f.clave]).length +
            ((estado.desde || estado.hasta) ? 1 : 0) + (estado.ventana ? 1 : 0);

        const sincronizarControles = () => {
            panel.querySelectorAll('select[data-f]').forEach(s => { s.value = estado.filtros[s.dataset.f] || ''; });
            const v = panel.querySelector('select[data-v]'); if (v) v.value = estado.ventana;
            const o = panel.querySelector('select[data-o]'); if (o) o.value = estado.orden;
            const d = panel.querySelector('input[data-d]'); if (d) d.value = estado.desde;
            const h = panel.querySelector('input[data-h]'); if (h) h.value = estado.hasta;
        };

        const limpiarFiltros = () => {
            estado.filtros = {}; estado.desde = ''; estado.hasta = ''; estado.ventana = ''; estado.orden = '';
            sincronizarControles();
            aplicar();
        };

        const limpiarTodo = () => {
            estado.q = '';
            input.value = '';
            limpiarFiltros();
        };

        const obs = new MutationObserver(() => aplicar({ reconstruir: true }));

        const aplicar = (opts = {}) => {
            obs.disconnect(); 
            try {
                tbody.querySelectorAll(':scope > tr.sin-resultados').forEach(r => r.remove());


                const filas = Array.from(tbody.querySelectorAll(':scope > tr'))
                    .filter(r => !(r.cells.length === 1 && r.cells[0].colSpan > 1));
                filas.forEach((r, i) => { if (r.dataset.orig === undefined) r.dataset.orig = String(i); });

                if (opts.reconstruir) reconstruirOpciones(filas);

                const tokens = separar(estado.q);
                let visibles = 0;
                filas.forEach(f => {
                    quitarMarcas(f);
                    const ok = pasa(f, tokens);
                    f.hidden = !ok;
                    if (ok) visibles++;
                });

                filas.sort(comparador()).forEach(f => tbody.appendChild(f));
                if (tokens.length) filas.filter(f => !f.hidden).forEach(f => marcar(f, tokens));

                if (filas.length && visibles === 0) {
                    const tr = document.createElement('tr');
                    tr.className = 'sin-resultados';
                    const td = document.createElement('td');
                    td.colSpan = (tabla.tHead && tabla.tHead.rows[0]) ? tabla.tHead.rows[0].cells.length : 1;
                    td.innerHTML = `<strong>Sin resultados</strong>
                        <span>${estado.q ? `No encontramos coincidencias para “${esc(estado.q)}”.` : 'Ningún registro cumple los filtros elegidos.'}
                        Prueba con otras palabras o quita algún filtro.</span>
                        <button type="button" class="buscador-reset">Limpiar búsqueda y filtros</button>`;
                    td.querySelector('button').addEventListener('click', limpiarTodo);
                    tr.appendChild(td);
                    tbody.appendChild(tr);
                }

                const activos = filtrosActivos();
                const hayAlgo = tokens.length > 0 || activos > 0;
                cuenta.textContent = !filas.length ? '' : hayAlgo ? `${visibles} de ${filas.length} ${nombre}` : `${filas.length} ${nombre}`;
                badge.textContent = String(activos);
                badge.hidden = activos === 0;
                btnX.hidden = !estado.q;
            } finally {
                obs.observe(tbody, { childList: true });
            }
        };

    


        let espera;
        input.addEventListener('input', () => {
            clearTimeout(espera);
            espera = setTimeout(() => { estado.q = input.value.trim(); aplicar(); }, 120);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (input.value) { input.value = ''; estado.q = ''; aplicar(); } else input.blur();
            }
        });

        btnX.addEventListener('click', () => { input.value = ''; estado.q = ''; aplicar(); input.focus(); });

        btnToggle.addEventListener('click', () => {
            panel.hidden = !panel.hidden;
            btnToggle.setAttribute('aria-expanded', String(!panel.hidden));
        });

        panel.addEventListener('change', (e) => {
            const t = e.target;
            if (t.matches('select[data-f]')) estado.filtros[t.dataset.f] = t.value;
            else if (t.matches('select[data-v]')) estado.ventana = t.value;
            else if (t.matches('select[data-o]')) estado.orden = t.value;
            else if (t.matches('input[data-d]')) estado.desde = t.value;
            else if (t.matches('input[data-h]')) estado.hasta = t.value;
            aplicar();
        });

        panel.querySelector('.buscador-limpiar').addEventListener('click', limpiarFiltros);

        
        document.addEventListener('keydown', (e) => {
            if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.target.closest('input, textarea, select, [contenteditable]')) return;
            if (document.querySelector('.ui-over')) return;
            e.preventDefault();
            input.focus();
        });

       
        
        const qUrl = new URLSearchParams(location.search).get('q');
        if (qUrl) { input.value = qUrl; estado.q = qUrl; }

        contenedor.parentNode.insertBefore(raiz, contenedor);
        aplicar({ reconstruir: true });

        return { aplicar, limpiar: limpiarTodo };
    };

    window.Buscador = { crear };
})();