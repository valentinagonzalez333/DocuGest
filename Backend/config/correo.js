// Envío de correos por la API HTTP de Brevo (puerto 443).

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const enviarCorreo = async ({ para, asunto, html, texto }) => {
    const apiKey = process.env.BREVO_API_KEY;
    const remitente = process.env.MAIL_REMITENTE;

    if (!apiKey || !remitente) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Faltan las variables BREVO_API_KEY o MAIL_REMITENTE.');
        }
   
        console.log(`\n[Correo no enviado: faltan credenciales]\nPara: ${para}\nAsunto: ${asunto}\n${texto || ''}\n`);
        return;
    }

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
            sender: { name: process.env.MAIL_NOMBRE || 'DocuGets', email: remitente },
            to: [{ email: para }],
            subject: asunto,
            htmlContent: html,
            textContent: texto
        })
    });

    if (!res.ok) {
        throw new Error(`Brevo respondió ${res.status}: ${await res.text()}`);
    }
};

const plantillaRecuperacion = ({ nombre, enlace, minutos }) => ({
    asunto: 'Restablece tu contraseña de DocuGets',
    texto: `Hola ${nombre}, recibimos una solicitud para restablecer tu contraseña. ` +
        `Abre este enlace (vale ${minutos} minutos): ${enlace}\n` +
        'Si no fuiste tú, ignora este mensaje: tu contraseña no cambia.',
    html: `
<div style="background:#f5f4ef;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#fffefc;border:1px solid #e6e3da;border-top:5px solid #f4b928;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 8px;font-size:22px;color:#14213d;">DocuGets</h1>
    <p style="margin:0 0 16px;color:#4a5470;font-size:15px;line-height:1.55;">Hola ${esc(nombre)}, recibimos una solicitud para restablecer tu contraseña.</p>
    <p style="margin:24px 0;text-align:center;">
      <a href="${esc(enlace)}" style="display:inline-block;background:#14213d;color:#ffffff;text-decoration:none;font-weight:bold;font-size:15px;padding:14px 26px;border-radius:10px;">Crear nueva contraseña</a>
    </p>
    <p style="margin:0 0 8px;color:#4a5470;font-size:13px;line-height:1.55;">El enlace vale ${minutos} minutos y solo se puede usar una vez.</p>
    <p style="margin:0;color:#8089a0;font-size:12px;line-height:1.55;">Si no fuiste tú, ignora este mensaje: tu contraseña no cambia.</p>
  </div>
</div>`
});

module.exports = { enviarCorreo, plantillaRecuperacion };