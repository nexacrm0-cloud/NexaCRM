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
    const html = standardInvitationHtml({ organizationName, invitedByName, link });
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
        <p style="font-size:14px;line-height:1.55;margin:0 0 12px 0"><strong>${escapeHtml(invitedByName)}</strong> te provisionó <strong>${escapeHtml(workflowName)}</strong> en tu workspace <strong>${escapeHtml(organizationName)}</strong> de Nexa CRM.</p>
        <p style="font-size:13px;color:#7c7565;margin:0 0 16px 0">Se va a disparar cuando ocurra el evento <code style="background:#f6f1e6;padding:2px 6px;border-radius:3px">${escapeHtml(workflowTrigger)}</code>.</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fffefb;text-decoration:none;border-radius:4px;font-weight:500">Entrar a mi workspace</a></p>
        <p style="font-size:12px;color:#a8a094;margin-top:24px">Si no esperabas este mail, ignorálo. Si no estás seguro, comunicate con quien te invitó.</p>
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
        <p style="font-size:14px;line-height:1.55;margin:0 0 8px 0">Recibimos un pedido para restablecer la contraseña asociada a esta casilla.</p>
        <p style="font-size:14px;line-height:1.55;margin:0 0 16px 0">Si lo hiciste vos, ingresá al siguiente enlace y elegí una nueva contraseña. Si no, ignorá este mensaje.</p>
        <p><a href="${resetLink}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fffefb;text-decoration:none;border-radius:4px;font-weight:500">Restablecer contraseña</a></p>
        <p style="font-size:12px;color:#a8a094;margin-top:24px">Este enlace expira en 1 hora.</p>
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
        <p style="font-size:14px;line-height:1.55;margin:0 0 16px 0">Confirmá que esta es tu casilla de correo para activar todas las funciones de tu cuenta.</p>
        <p><a href="${verifyLink}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fffefb;text-decoration:none;border-radius:4px;font-weight:500">Verificar email</a></p>
        <p style="font-size:12px;color:#a8a094;margin-top:24px">Este enlace expira en 7 días. Si no creaste una cuenta en Nexa CRM, ignorá este mensaje.</p>
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
        <p style="font-size:14px;line-height:1.55;margin:0 0 16px 0">${onwardCopy}</p>
        <p><a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#1a1a1a;color:#fffefb;text-decoration:none;border-radius:4px;font-weight:500">Entrar a Nexa CRM</a></p>
        <p style="font-size:13px;color:#7c7565;margin-top:20px">Si necesitás ayuda para arrancar, la sección <em>Automatizaciones</em> tiene plantillas listas para WhatsApp, Slack y Mailchimp.</p>
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
        <p style="font-size:14px;line-height:1.55;margin:0 0 8px 0">Hola, ${escapeHtml(firstName)}, tu suscripción ya está activa y cobraremos <strong>${escapeHtml(formatted)}/mes</strong>.</p>
        <p style="font-size:14px;line-height:1.55;margin:0 0 16px 0">El próximo ciclo vence el <strong>${escapeHtml(until)}</strong>.</p>
        <p style="font-size:13px;color:#7c7565;margin:0">Si necesitás cancelar, lo hacés desde tu panel en <em>Automatizaciones → Mis suscripciones</em>.</p>
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
      title: `Pausamos tu automatización`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.55;margin:0 0 8px 0">Hola, ${escapeHtml(firstName)}, pausamos <strong>${escapeHtml(templateName)}</strong> porque no pudimos procesar el pago.</p>
        <p style="font-size:13px;color:#7c7565;margin:0 0 16px 0">Motivo: ${escapeHtml(reason)}</p>
        <p style="font-size:14px;line-height:1.55;margin:0">Te avisemos para que actualices el medio de pago o un técnico te contacte.</p>
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
    const eyebrow = ok ? 'NEXA · AI Agents' : 'NEXA · AI Agents';
    const accent = ok ? `#22c55e` : `#ef4444`;
    const dur = typeof durationMs === 'number' ? `${(durationMs / 1000).toFixed(1)}s` : '—';
    const summaryHtml = summary
      ? `<pre style="font-family:'Inter',Arial,sans-serif;font-size:13px;line-height:1.55;background:#f6f1e6;border:1px solid #e6e1d2;padding:14px;border-radius:4px;white-space:pre-wrap;margin:0 0 16px 0;color:#1a1a1a">${escapeHtml(summary)}</pre>`
      : '';
    const errorHtml = error
      ? `<pre style="font-family:'Inter',Arial,sans-serif;font-size:12px;background:#fef2f2;border:1px solid #fecaca;padding:14px;border-radius:4px;white-space:pre-wrap;margin:0 0 16px 0;color:#7f1d1d">${escapeHtml(error)}</pre>`
      : '';
    const cta = dashboardsUrl
      ? `<p style="margin:16px 0 0 0"><a href="${dashboardsUrl}" style="display:inline-block;padding:12px 24px;background:${accent};color:#fffefb;text-decoration:none;border-radius:4px;font-weight:500">Ver en CRM</a></p>`
      : '';
    const html = emailShell({
      eyebrow: `${eyebrow} · ${agentType}`,
      title: `${escapeHtml(title)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.55;margin:0 0 4px 0">Hola, ${escapeHtml(firstName)}. ${escapeHtml(agentName)} terminó de procesarse por el evento <strong>${escapeHtml(eventName)}</strong>.</p>
        <p style="font-size:13px;color:#7c7565;margin:0 0 16px 0">Estado: <strong style="color:${accent}">${ok ? 'OK' : 'FAILED'}</strong> · Duración: ${dur}</p>
        ${summaryHtml}
        ${errorHtml}
        ${cta}
        <p style="font-size:12px;color:#a8a094;margin-top:24px">Si querés cambiar a qué eventos este agente responde, editá la configuración del agente.</p>
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
      title: `Tu código, ${escapeHtml(firstName)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.55;margin:0 0 24px 0">Ingresá este código para entrar a tu cuenta:</p>
        <div style="text-align:center;margin:0 0 24px 0">
          <div style="display:inline-block;font-family:'Courier New',monospace;font-size:32px;letter-spacing:8px;font-weight:700;color:#1a1a1a;background:#f6f1e6;padding:18px 24px;border-radius:6px;border:2px solid #1a1a1a">${escapeHtml(code)}</div>
        </div>
        <p style="font-size:13px;color:#7c7565;margin:0">El código expira en ${expiresInMinutes} minutos y solo se puede usar una vez.</p>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendNewLoginEmail(opts: { to: string; firstName: string; at: Date; ip?: string }) {
    const { to, firstName, at, ip } = opts;
    const when = at.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
    const ipLine = ip
      ? `<p style="font-size:13px;color:#7c7565;margin:8px 0 0 0">Dirección IP: <code style="background:#f6f1e6;padding:2px 6px;border-radius:3px">${escapeHtml(ip)}</code></p>`
      : '';
    const subject = `Nuevo inicio de sesión en Nexa CRM`;
    const html = emailShell({
      eyebrow: 'NEXA · Seguridad',
      title: `Hola, ${escapeHtml(firstName)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.55;margin:0 0 4px 0">Registramos un inicio de sesión en tu cuenta el <strong>${escapeHtml(when)}</strong>.</p>
        ${ipLine}
        <p style="font-size:12px;color:#a8a094;margin-top:24px">Si no fuiste vos, cambiá tu contraseña de inmediato desde Settings.</p>
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

function standardInvitationHtml(opts: {
  organizationName: string;
  invitedByName: string;
  link: string;
}) {
  return `
    <p>Hola,</p>
    <p><strong>${escapeHtml(opts.invitedByName)}</strong> te ha invitado a unirte a <strong>${escapeHtml(opts.organizationName)}</strong> en Nexa CRM.</p>
    <p>Haz clic en el siguiente enlace para aceptar la invitación:</p>
    <p><a href="${opts.link}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;">Aceptar invitación</a></p>
    <p>Este enlace expirará en 7 días.</p>
    <p>Si no esperabas esta invitación, ignora este mensaje.</p>
  `;
}

function emailShell(opts: { eyebrow: string; title: string; bodyHtml: string }) {
  return `
    <div style="font-family:Inter,Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e6e1d2;background:#fffefb">
      <p style="margin:0 0 8px 0;letter-spacing:.18em;text-transform:uppercase;font-size:11px;color:#a8a094">${escapeHtml(opts.eyebrow)}</p>
      <h1 style="font-family:Georgia,serif;font-weight:500;font-size:24px;margin:0 0 16px 0">${opts.title}</h1>
      ${opts.bodyHtml}
      <p style="font-size:11px;color:#a8a094;margin-top:32px;letter-spacing:.06em">NEXA CRM · Recibiste este email porque tenés una cuenta asociada a esta dirección.</p>
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
