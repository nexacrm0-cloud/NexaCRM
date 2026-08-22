import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { EmailProvider, SendEmailOptions } from './email-provider.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(@Inject('EMAIL_PROVIDER') @Optional() private provider?: EmailProvider) {
    if (!this.provider) {
      this.logger.warn('No email provider available — using fallback logger');
    }
  }

  async sendEmail(options: SendEmailOptions) {
    if (!this.provider) {
      this.logger.log(`[FALLBACK] To: ${options.to}, Subject: ${options.subject}`);
      return { success: true, messageId: `fallback-${Date.now()}`, provider: 'fallback' };
    }
    return this.provider.send(options);
  }

  async sendInvitationEmail(
    to: string,
    token: string,
    organizationName: string,
    invitedByName: string,
  ) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/accept-invitation?token=${token}`;
    const subject = `Invitación a ${organizationName} en Nexa CRM`;
    const html = emailShell({
      eyebrow: 'NEXA · Equipo',
      title: 'Te invitaron a un workspace',
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 20px 0"><strong>${escapeHtml(invitedByName)}</strong> te ha invitado a unirte a <strong>${escapeHtml(organizationName)}</strong> en Nexa CRM.</p>
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 28px 0">Hacé clic en el siguiente enlace para aceptar la invitación:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background-color:#1a1a1a;border-radius:8px">
              <a href="${link}" style="display:inline-block;padding:14px 32px;color:#fffefb;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Aceptar invitación</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0">
          <tr><td style="border-top:1px solid #e8e4dc;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#a8a094;margin:0 0 6px 0">Este enlace expirará en 7 días.</p>
        <p style="font-size:12px;color:#a8a094;margin:0">Si no esperabas esta invitación, ignora este mensaje.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendAutomationProvisioningEmail(opts: {
    to: string;
    token: string;
    organizationName: string;
    invitedByName: string;
    workflowName: string;
    workflowTrigger: string;
  }) {
    const { to, token, organizationName, invitedByName, workflowName, workflowTrigger } = opts;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const link = `${frontendUrl}/accept-invitation?token=${token}&utm_source=automation-transfer`;
    const subject = `${invitedByName} te activó "${workflowName}" en Nexa CRM`;
    const html = emailShell({
      eyebrow: 'NEXA · Automatizaciones',
      title: 'Tu automatización está lista',
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 20px 0"><strong>${escapeHtml(invitedByName)}</strong> te provisionó <strong>${escapeHtml(workflowName)}</strong> en tu workspace <strong>${escapeHtml(organizationName)}</strong> de Nexa CRM.</p>
        <p style="font-size:13px;color:#7c7565;margin:0 0 28px 0">Se va a disparar cuando ocurra el evento <code style="background:#f4f1ec;padding:3px 8px;border-radius:4px;font-size:12px;color:#3d3832">${escapeHtml(workflowTrigger)}</code>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background-color:#1a1a1a;border-radius:8px">
              <a href="${link}" style="display:inline-block;padding:14px 32px;color:#fffefb;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Entrar a mi workspace</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0">
          <tr><td style="border-top:1px solid #e8e4dc;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#a8a094;margin:0">Si no esperabas este mail, ignorálo. Si no estás seguro, comunicate con quien te invitó.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendPasswordResetEmail(to: string, resetLink: string) {
    const subject = 'Restablecé tu contraseña en Nexa CRM';
    const html = emailShell({
      eyebrow: 'NEXA · Seguridad',
      title: 'Restablecer contraseña',
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 20px 0">Recibimos un pedido para restablecer la contraseña asociada a esta casilla.</p>
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 28px 0">Si lo hiciste vos, ingresá al siguiente enlace y elegí una nueva contraseña. Si no, ignorá este mensaje.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background-color:#1a1a1a;border-radius:8px">
              <a href="${resetLink}" style="display:inline-block;padding:14px 32px;color:#fffefb;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Restablecer contraseña</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0">
          <tr><td style="border-top:1px solid #e8e4dc;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#a8a094;margin:0">Este enlace expira en 1 hora.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendEmailVerificationEmail(to: string, firstName: string, verifyLink: string) {
    const greeting = firstName ? `Hola, ${escapeHtml(firstName)}` : 'Hola';
    const subject = 'Verificá tu email en Nexa CRM';
    const html = emailShell({
      eyebrow: 'NEXA · Acceso',
      title: greeting,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 20px 0">Confirmá que esta es tu casilla de correo para activar todas las funciones de tu cuenta.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background-color:#1a1a1a;border-radius:8px">
              <a href="${verifyLink}" style="display:inline-block;padding:14px 32px;color:#fffefb;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Verificar email</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0">
          <tr><td style="border-top:1px solid #e8e4dc;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#a8a094;margin:0 0 6px 0">Este enlace expira en 7 días.</p>
        <p style="font-size:12px;color:#a8a094;margin:0">Si no creaste una cuenta en Nexa CRM, ignorá este mensaje.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendWelcomeEmail(opts: {
    to: string;
    firstName: string;
    organizationName: string;
    loginUrl: string;
    isInvitation?: boolean;
  }) {
    const { to, firstName, organizationName, loginUrl, isInvitation = false } = opts;
    const subject = isInvitation
      ? `Te uniste a ${organizationName} en Nexa CRM`
      : `Tu Nexa CRM está listo, ${firstName}`;
    const onwardCopy = isInvitation
      ? `Te uniste a <strong>${escapeHtml(organizationName)}</strong>. Ya tenés acceso al workspace y podés empezar a usar todas las funciones.`
      : `Esta es la base de tu CRM. Clientes, oportunidades, presupuestos y automatizaciones están listos para usarse desde ya. La arrancaste.`;
    const html = emailShell({
      eyebrow: 'NEXA · CRM',
      title: `Hola, ${escapeHtml(firstName)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 28px 0">${onwardCopy}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background-color:#1a1a1a;border-radius:8px">
              <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;color:#fffefb;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Entrar a Nexa CRM</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0">
          <tr><td style="border-top:1px solid #e8e4dc;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#a8a094;margin:0">Si necesitás ayuda para arrancar, la sección <em>Automatizaciones</em> tiene plantillas listas para WhatsApp, Slack y Mailchimp.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendSubscriptionActivatedEmail(opts: {
    to: string;
    firstName: string;
    templateName: string;
    amountCents: number;
    cycleEndsAt: Date;
  }) {
    const { to, firstName, templateName, amountCents, cycleEndsAt } = opts;
    const formatted =
      amountCents > 0
        ? new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(
            amountCents / 100,
          )
        : '—';
    const until = cycleEndsAt.toLocaleDateString('es-AR', { dateStyle: 'medium' });
    const subject = `Suscripción activa · ${templateName}`;
    const html = emailShell({
      eyebrow: 'NEXA · Suscripciones',
      title: `${escapeHtml(templateName)} está activa`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 20px 0">Hola, ${escapeHtml(firstName)}, tu suscripción ya está activa y cobraremos <strong>${escapeHtml(formatted)}/mes</strong>.</p>
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 28px 0">El próximo ciclo vence el <strong>${escapeHtml(until)}</strong>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0">
          <tr><td style="border-top:1px solid #e8e4dc;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#a8a094;margin:0">Si necesitás cancelar, lo hacés desde tu panel en <em>Automatizaciones → Mis suscripciones</em>.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendSubscriptionFailedEmail(opts: {
    to: string;
    firstName: string;
    templateName: string;
    reason: string;
  }) {
    const { to, firstName, templateName, reason } = opts;
    const subject = `Tu automatización fue pausada · ${templateName}`;
    const html = emailShell({
      eyebrow: 'NEXA · Suscripciones',
      title: 'Pausamos tu automatización',
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 20px 0">Hola, ${escapeHtml(firstName)}, pausamos <strong>${escapeHtml(templateName)}</strong> porque no pudimos procesar el pago.</p>
        <p style="font-size:13px;color:#7c7565;margin:0 0 28px 0">Motivo: ${escapeHtml(reason)}</p>
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0">Te avisemos para que actualices el medio de pago o un técnico te contacte.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendAgentExecutionEmail(opts: {
    to: string;
    firstName: string;
    agentType: string;
    agentName: string;
    eventName: string;
    status: 'COMPLETED' | 'FAILED';
    durationMs?: number;
    summary?: string;
    error?: string;
    dashboardsUrl?: string;
  }) {
    const {
      to,
      firstName,
      agentName,
      eventName,
      status,
      durationMs,
      summary,
      error,
      dashboardsUrl,
      agentType,
    } = opts;
    const ok = status === 'COMPLETED';
    const title = ok ? `Resumen: ${agentName} completó su tarea` : `Falló ${agentName}`;
    const eyebrow = 'NEXA · AI Agents';
    const accent = ok ? '#16a34a' : '#dc2626';
    const dur = typeof durationMs === 'number' ? `${(durationMs / 1000).toFixed(1)}s` : '—';
    const summaryHtml = summary
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px 0"><tr><td style="background:#f4f1ec;border:1px solid #e8e4dc;border-radius:8px;padding:16px"><pre style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.6;color:#3d3832;margin:0;white-space:pre-wrap">${escapeHtml(summary)}</pre></td></tr></table>`
      : '';
    const errorHtml = error
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px 0"><tr><td style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px"><pre style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.6;color:#7f1d1d;margin:0;white-space:pre-wrap">${escapeHtml(error)}</pre></td></tr></table>`
      : '';
    const cta = dashboardsUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0"><tr><td style="background-color:${accent};border-radius:8px"><a href="${dashboardsUrl}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Ver en CRM</a></td></tr></table>`
      : '';
    const html = emailShell({
      eyebrow: `${eyebrow} · ${agentType}`,
      title: `${escapeHtml(title)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 8px 0">Hola, ${escapeHtml(firstName)}. ${escapeHtml(agentName)} terminó de procesarse por el evento <strong>${escapeHtml(eventName)}</strong>.</p>
        <p style="font-size:13px;color:#7c7565;margin:0 0 24px 0">Estado: <strong style="color:${accent}">${ok ? 'OK' : 'FAILED'}</strong> · Duración: ${dur}</p>
        ${summaryHtml}
        ${errorHtml}
        ${cta}
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #e8e4dc;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#a8a094;margin:0">Si querés cambiar a qué eventos este agente responde, editá la configuración del agente.</p>
      `,
    });
    const subject = ok
      ? `${agentName} terminó · ${eventName}`
      : `${agentName} falló · ${eventName}`;
    return this.sendEmail({ to, subject, html });
  }

  async sendOtpEmail(opts: {
    to: string;
    firstName: string;
    code: string;
    purpose: string;
    expiresInMinutes: number;
  }) {
    const { to, firstName, code, purpose, expiresInMinutes } = opts;
    const subject =
      purpose === 'login'
        ? `Tu código de acceso a Nexa CRM`
        : purpose === 'reset'
          ? `Tu código para restablecer la contraseña`
          : `Tu código de verificación Nexa CRM`;
    const html = emailShell({
      eyebrow: 'NEXA · Acceso',
      title: `Hola, ${escapeHtml(firstName)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 28px 0">Ingresá este código para entrar a tu cuenta:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding:0 0 28px 0">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#f4f1ec;border:1px solid #e8e4dc;border-radius:12px;padding:20px 36px">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#1a1a1a">${escapeHtml(code)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 20px 0">
          <tr><td style="border-top:1px solid #e8e4dc;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#a8a094;margin:0">El código expira en ${expiresInMinutes} minutos y solo se puede usar una vez.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendNewLoginEmail(opts: { to: string; firstName: string; at: Date; ip?: string }) {
    const { to, firstName, at, ip } = opts;
    const when = at.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
    const ipLine = ip
      ? `<p style="font-size:12px;color:#a8a094;margin:8px 0 0 0">Dirección IP: <code style="background:#f4f1ec;padding:3px 8px;border-radius:4px;font-size:12px;color:#3d3832">${escapeHtml(ip)}</code></p>`
      : '';
    const subject = `Nuevo inicio de sesión en Nexa CRM`;
    const html = emailShell({
      eyebrow: 'NEXA · Seguridad',
      title: `Hola, ${escapeHtml(firstName)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#3d3832;margin:0 0 4px 0">Registramos un inicio de sesión en tu cuenta el <strong>${escapeHtml(when)}</strong>.</p>
        ${ipLine}
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0 0 0">
          <tr><td style="border-top:1px solid #e8e4dc;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#a8a094;margin:20px 0 0 0">Si no fuiste vos, cambiá tu contraseña de inmediato desde Settings.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendQuoteEmail(quoteId: string, quoteNumber: string, to: string, pdfBuffer?: Buffer) {
    const subject = `Presupuesto ${quoteNumber}`;
    const html = `<p>Adjunto encontrarás el presupuesto <strong>${quoteNumber}</strong>.</p><p>Quedamos a tu disposición para cualquier consulta.</p>`;

    return this.sendEmail({
      to,
      subject,
      html,
      attachments: pdfBuffer
        ? [{ filename: `${quoteNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        : undefined,
    });
  }

  async sendInvoiceEmail(opts: {
    invoiceId: string;
    invoiceNumber: string;
    to: string;
    clientName?: string | null;
    total?: number;
    currency?: string;
    pdfBuffer?: Buffer;
    kind: 'issued' | 'paid' | 'cancelled';
  }) {
    const { invoiceNumber, to, clientName, total, currency = 'ARS', pdfBuffer, kind } = opts;
    const subject =
      kind === 'issued'
        ? `Factura ${invoiceNumber}`
        : kind === 'paid'
          ? `Pago registrado — ${invoiceNumber}`
          : `Factura ${invoiceNumber} anulada`;

    const totalText =
      typeof total === 'number'
        ? new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
          }).format(total)
        : null;

    const greeting = clientName ? `Hola, <strong>${clientName}</strong>` : 'Hola';
    const body =
      kind === 'issued'
        ? `${greeting}. Adjuntamos la factura <strong>${invoiceNumber}</strong>${totalText ? ` por <strong>${totalText}</strong>` : ''}. Vencimiento y datos de pago están en el adjunto.`
        : kind === 'paid'
          ? `${greeting}. Te confirmamos el pago de la factura <strong>${invoiceNumber}</strong>${totalText ? ` por <strong>${totalText}</strong>` : ''}. Gracias por tu pago.`
          : `${greeting}. Te avisamos que la factura <strong>${invoiceNumber}</strong> fue anulada. Si tenés dudas, contactanos.`;

    const html = `
      <div style="font-family:Inter,Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e6e1d2;background:#fffefb">
        <p style="margin:0 0 8px 0;letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#a8a094">NEXA · Facturación</p>
        <h1 style="font-family:Georgia,serif;font-weight:500;font-size:24px;margin:0 0 16px 0">${escapeHtml(strip(kind === 'paid' ? 'Pago confirmado' : kind === 'cancelled' ? 'Factura anulada' : 'Nueva factura'))}</h1>
        <p style="font-size:14px;line-height:1.55">${body}</p>
        ${kind !== 'cancelled' ? `<p style="font-size:12px;color:#7c7565;margin-top:24px">Factura <strong>${escapeHtml(invoiceNumber)}</strong>${totalText ? ` · Total <strong>${escapeHtml(totalText)}</strong>` : ''}</p>` : ''}
      </div>
    `;

    return this.sendEmail({
      to,
      subject,
      html,
      attachments: pdfBuffer
        ? [{ filename: `${invoiceNumber}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
        : undefined,
    });
  }
}

function emailShell(opts: { eyebrow: string; title: string; bodyHtml: string }) {
  return `
    <div style="margin:0;padding:0;background-color:#f4f1ec;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f1ec">
        <tr>
          <td align="center" style="padding:40px 20px">
            <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%">
              <!-- Logo -->
              <tr>
                <td align="center" style="padding-bottom:32px">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background-color:#1a1a1a;color:#fffefb;font-family:Georgia,serif;font-size:16px;font-weight:600;letter-spacing:-0.02em;padding:8px 14px;border-radius:6px">Nexa</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Card -->
              <tr>
                <td style="background-color:#fffefb;border-radius:12px;border:1px solid #e8e4dc;overflow:hidden">
                  <!-- Header accent bar -->
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="height:4px;background:linear-gradient(90deg,#1a1a1a 0%,#a8a094 100%);font-size:0;line-height:0">&nbsp;</td>
                    </tr>
                  </table>
                  <!-- Content -->
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:40px 40px 32px 40px">
                        <p style="margin:0 0 6px 0;letter-spacing:0.14em;text-transform:uppercase;font-size:10px;font-weight:600;color:#a8a094">${escapeHtml(opts.eyebrow)}</p>
                        <h1 style="font-family:Georgia,serif;font-weight:500;font-size:26px;line-height:1.3;color:#1a1a1a;margin:0 0 24px 0;letter-spacing:-0.01em">${opts.title}</h1>
                        ${opts.bodyHtml}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="padding:28px 20px 0 20px">
                  <p style="margin:0 0 6px 0;font-size:11px;color:#a8a094;letter-spacing:0.04em">Nexa CRM</p>
                  <p style="margin:0;font-size:11px;color:#b8b0a4">Recibiste este email porque tenés una cuenta asociada a esta dirección.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '\u0026amp;')
    .replace(/</g, '\u0026lt;')
    .replace(/>/g, '\u0026gt;')
    .replace(/"/g, '\u0026quot;')
    .replace(/'/g, '\u0026#39;');
}

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}
