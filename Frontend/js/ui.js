

(() => {
    const css = `
    .ui-stack{position:fixed;top:20px;right:20px;z-index:3000;display:flex;flex-direction:column;gap:10px;width:min(380px,calc(100vw - 40px));pointer-events:none;font-family:'Manrope',system-ui,sans-serif}
    .ui-toast{pointer-events:auto;position:relative;overflow:hidden;display:flex;gap:12px;align-items:flex-start;background:#fffefc;border:1px solid #e6e3da;border-radius:14px;padding:14px 14px 16px 16px;box-shadow:0 12px 32px rgba(20,33,61,.14);color:#16213a;animation:ui-in .28s cubic-bezier(.2,.8,.2,1) both}
    .ui-toast.saliendo{animation:ui-out .22s ease forwards}
    .ui-ico{flex:none;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:#14213d;color:#f4b928}
    .ui-ico svg{width:16px;height:16px}
    .ui-toast.ok .ui-ico{background:#e5f4ec;color:#1f7a4d}
    .ui-toast.error .ui-ico{background:#fbe6e3;color:#b4372f}
    .ui-toast.info .ui-ico{background:#fdf2cf;color:#8a6400}
    .ui-txt{flex:1;font-size:.9rem;line-height:1.45;padding-top:4px;word-break:break-word}
    .ui-x{flex:none;border:0;background:transparent;color:#8089a0;font-size:1.2rem;line-height:1;cursor:pointer;padding:2px 4px;border-radius:6px}
    .ui-x:hover{background:#f1efe8;color:#14213d}
    .ui-bar{position:absolute;left:0;bottom:0;height:3px;width:100%;background:#f4b928;transform-origin:left;animation:ui-bar linear forwards}
    .ui-toast.error .ui-bar{background:#b4372f}
    .ui-toast.ok .ui-bar{background:#1f7a4d}
    .ui-over{position:fixed;inset:0;z-index:3100;background:rgba(20,33,61,.42);backdrop-filter:blur(3px);display:grid;place-items:center;padding:20px;animation:ui-fade .18s ease both;font-family:'Manrope',system-ui,sans-serif}
    .ui-modal{width:min(420px,100%);background:#fffefc;border-radius:18px;padding:26px;box-shadow:0 24px 60px rgba(20,33,61,.28);border-top:4px solid #f4b928;animation:ui-in .24s cubic-bezier(.2,.8,.2,1) both}
    .ui-modal h3{font-family:'Newsreader',Georgia,serif;font-weight:600;font-size:1.3rem;color:#14213d;margin-bottom:8px}
    .ui-modal p{color:#4a5470;font-size:.92rem;line-height:1.55}
    .ui-acc{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
    .ui-acc button{font-family:inherit;font-size:.88rem;font-weight:600;padding:10px 18px;border-radius:10px;cursor:pointer;transition:background .15s,border-color .15s,color .15s}
    .ui-no{background:transparent;border:1px solid #e0dccf;color:#4a5470}
    .ui-no:hover{border-color:#14213d;color:#14213d}
    .ui-si{background:#14213d;border:1px solid #14213d;color:#fff}
    .ui-si:hover{background:#22346a;border-color:#22346a}
    .ui-in{width:100%;margin-top:16px;padding:12px 14px;border:1px solid #e0dccf;border-radius:10px;background:#f8f7f2;color:#14213d;font-family:'Newsreader',Georgia,serif;font-style:italic;font-size:1.35rem;outline:none;transition:border-color .15s,box-shadow .15s}
    .ui-in:focus{border-color:#14213d;background:#fff;box-shadow:0 0 0 4px rgba(244,185,40,.28)}
    .ui-err{min-height:18px;margin-top:6px;font-size:.82rem;color:#b4372f}
    @keyframes ui-in{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:none}}
    @keyframes ui-out{to{opacity:0;transform:translateX(24px)}}
    @keyframes ui-fade{from{opacity:0}to{opacity:1}}
    @keyframes ui-bar{to{transform:scaleX(0)}}
    @media (prefers-reduced-motion:reduce){.ui-toast,.ui-modal,.ui-over{animation:none}}
    `;
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    const SVG = {
        ok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 6v7M12 17.5v.5"/></svg>',
        info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 11v6M12 7v.5"/></svg>'
    };

    // Adivina el tipo de aviso por el texto, así no hay que tocar ningún alert() existente
    const detectar = (t) => {
        const m = String(t).toLowerCase();
        if (/^error|no se pudo|incorrect|no puede|no coincide|debe |obligatori|inválid|anterior a|solo puede|no autorizado|necesita|ingresa|no hay conexión|problema/.test(m)) return 'error';
        if (/éxito|exito|correctamente|creado|creada|actualizad|firmado|aprobad|rechazad|restablecid|registrad|guardad|bienvenido/.test(m)) return 'ok';
        return 'info';
    };

    let pila;
    const obtenerPila = () => {
        if (!pila || !pila.isConnected) {
            pila = document.createElement('div');
            pila.className = 'ui-stack';
            pila.setAttribute('role', 'status');
            pila.setAttribute('aria-live', 'polite');
            document.body.appendChild(pila);
        }
        return pila;
    };

    const toast = (mensaje, tipo, ms) => {
        const t = tipo || detectar(mensaje);
        const dur = ms || (t === 'error' ? 6500 : 4500);
        const el = document.createElement('div');
        el.className = `ui-toast ${t}`;

        const ico = document.createElement('div');
        ico.className = 'ui-ico';
        ico.innerHTML = SVG[t];

        const txt = document.createElement('div');
        txt.className = 'ui-txt';
        txt.textContent = String(mensaje ?? '');

        const x = document.createElement('button');
        x.className = 'ui-x';
        x.type = 'button';
        x.setAttribute('aria-label', 'Cerrar');
        x.textContent = '×';

        const barra = document.createElement('div');
        barra.className = 'ui-bar';
        barra.style.animationDuration = `${dur}ms`;

        el.append(ico, txt, x, barra);
        obtenerPila().appendChild(el);

        let cerrado = false;
        const cerrar = () => {
            if (cerrado) return;
            cerrado = true;
            el.classList.add('saliendo');
            setTimeout(() => el.remove(), 220);
        };
        x.addEventListener('click', cerrar);
        setTimeout(cerrar, dur);
    };

 
    window.alert = (mensaje) => toast(mensaje);
    window.toast = toast;


    window.confirmar = (mensaje, { titulo = 'Confirmar acción', si = 'Continuar', no = 'Cancelar' } = {}) =>
        new Promise((resolve) => {
            const over = document.createElement('div');
            over.className = 'ui-over';
            over.innerHTML = `
                <div class="ui-modal" role="dialog" aria-modal="true">
                    <h3></h3><p></p>
                    <div class="ui-acc">
                        <button type="button" class="ui-no"></button>
                        <button type="button" class="ui-si"></button>
                    </div>
                </div>`;
            over.querySelector('h3').textContent = titulo;
            over.querySelector('p').textContent = mensaje;
            over.querySelector('.ui-no').textContent = no;
            over.querySelector('.ui-si').textContent = si;
            document.body.appendChild(over);

            const fin = (v) => {
                document.removeEventListener('keydown', tecla);
                over.remove();
                resolve(v);
            };
            const tecla = (e) => {
                if (e.key === 'Escape') fin(false);
                if (e.key === 'Enter') fin(true);
            };
            document.addEventListener('keydown', tecla);
            over.querySelector('.ui-no').addEventListener('click', () => fin(false));
            over.querySelector('.ui-si').addEventListener('click', () => fin(true));
            over.addEventListener('click', (e) => { if (e.target === over) fin(false); });
            over.querySelector('.ui-si').focus();
        });


    window.pedirTexto = (mensaje, {
        titulo = 'Escribe tu respuesta', placeholder = '', si = 'Aceptar', no = 'Cancelar',
        max = 80, vacio = 'Este campo es obligatorio.'
    } = {}) =>
        new Promise((resolve) => {
            const over = document.createElement('div');
            over.className = 'ui-over';
            over.innerHTML = `
                <div class="ui-modal" role="dialog" aria-modal="true">
                    <h3></h3><p></p>
                    <input type="text" class="ui-in" autocomplete="off">
                    <div class="ui-err" role="alert"></div>
                    <div class="ui-acc">
                        <button type="button" class="ui-no"></button>
                        <button type="button" class="ui-si"></button>
                    </div>
                </div>`;
            over.querySelector('h3').textContent = titulo;
            over.querySelector('p').textContent = mensaje;
            over.querySelector('.ui-no').textContent = no;
            over.querySelector('.ui-si').textContent = si;

            const input = over.querySelector('.ui-in');
            const err = over.querySelector('.ui-err');
            input.placeholder = placeholder;
            input.maxLength = max;
            document.body.appendChild(over);

            const fin = (v) => {
                document.removeEventListener('keydown', tecla);
                over.remove();
                resolve(v);
            };
            const aceptar = () => {
                const valor = input.value.trim().replace(/\s+/g, ' ');
                if (!valor) { err.textContent = vacio; input.focus(); return; }
                fin(valor);
            };
            const tecla = (e) => { if (e.key === 'Escape') fin(null); };

            document.addEventListener('keydown', tecla);
            input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); aceptar(); } });
            input.addEventListener('input', () => { err.textContent = ''; });
            over.querySelector('.ui-no').addEventListener('click', () => fin(null));
            over.querySelector('.ui-si').addEventListener('click', aceptar);
            over.addEventListener('click', (e) => { if (e.target === over) fin(null); });
            input.focus();
        });
})();




(() => {
    const fetchOriginal = window.fetch.bind(window);

    window.fetch = async (input, init = {}) => {
        let esApiPrivada = false;
        try {
            const url = new URL(typeof input === 'string' ? input : (input.url || String(input)), location.origin);
            esApiPrivada = url.origin === location.origin
                && url.pathname.startsWith('/api/')
                && !/^\/api\/(login|registro)/.test(url.pathname);

            if (esApiPrivada) {
                const u = JSON.parse(localStorage.getItem('usuario') || 'null');
                if (u && u.token) {
                    const base = init.headers || (typeof input !== 'string' && input.headers) || undefined;
                    const headers = new Headers(base);
                    headers.set('Authorization', `Bearer ${u.token}`);
                    init = { ...init, headers };
                }
            }
        } catch (e) {  }

        const res = await fetchOriginal(input, init);

        if (res.status === 401 && esApiPrivada) {
            localStorage.removeItem('usuario');
            window.location.href = '/';
        }
        return res;
    };
})();