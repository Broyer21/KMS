const nodemailer = require('nodemailer');
const config = require('./config');

function resendReady() {
  const { apiKey, from } = config.resend;
  return Boolean(apiKey && from);
}

function smtpReady() {
  const { host, user, pass } = config.smtp;
  return Boolean(host && user && pass);
}

async function sendWithResend({ to, subject, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.resend.apiKey}`
    },
    body: JSON.stringify({
      from: config.resend.from,
      to: [to],
      subject,
      text
    })
  });

  if (response.ok) return;

  let detail = '';
  try {
    detail = await response.text();
  } catch {
    detail = 'No response body';
  }

  throw new Error(`[EMAIL][RESEND] Error ${response.status}: ${detail}`);
}

async function sendWithSmtp({ to, subject, text }) {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });

  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text
  });
}

async function sendVerificationCode({ email, code }) {
  const subject = 'Tu codigo de verificacion';
  const text = `Tu codigo de verificacion es: ${code}`;

  if (config.emailProvider === 'resend') {
    if (!resendReady()) {
      throw new Error('[EMAIL] EMAIL_PROVIDER=resend pero faltan RESEND_API_KEY o RESEND_FROM');
    }
    await sendWithResend({ to: email, subject, text });
    return;
  }

  if (config.emailProvider === 'smtp') {
    if (smtpReady()) {
      await sendWithSmtp({ to: email, subject, text });
      return;
    }
    throw new Error('[EMAIL] EMAIL_PROVIDER=smtp pero faltan credenciales SMTP');
  }

  console.log(`[EMAIL][DEV] to=${email} subject=\"${subject}\" code=${code}`);
}

module.exports = {
  sendVerificationCode
};
