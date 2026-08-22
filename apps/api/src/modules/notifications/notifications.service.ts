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
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 20px 0"><strong>${escapeHtml(invitedByName)}</strong> te invitó a formar parte del equipo de <strong>${escapeHtml(organizationName)}</strong> en Nexa CRM.</p>
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 28px 0">Al aceptar, vas a tener acceso al workspace compartido con clientes, oportunidades, presupuestos y todas las herramientas del CRM.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background-color:#FF5E1F;border-radius:8px">
              <a href="${link}" style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Aceptar invitación</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:12px;color:#9E9A94;margin:0 0 8px 0;letter-spacing:0.04em;text-transform:uppercase;font-weight:600">Qué incluye</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0">· Acceso completo al CRM del equipo</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0">· Colaboración en tiempo real</p>
              <p style="font-size:13px;color:#605C57;margin:0">· Automatizaciones y reportes compartidos</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#9E9A94;margin:0 0 6px 0">Este enlace expira en 7 días.</p>
        <p style="font-size:12px;color:#9E9A94;margin:0">Si no esperabas esta invitación, ignorá este mensaje.</p>
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
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 20px 0"><strong>${escapeHtml(invitedByName)}</strong> te provisionó <strong>${escapeHtml(workflowName)}</strong> en tu workspace <strong>${escapeHtml(organizationName)}</strong> de Nexa CRM.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0"><strong>Trigger:</strong> <code style="background:#EDE5D8;padding:2px 6px;border-radius:4px;font-size:12px">${escapeHtml(workflowTrigger)}</code></p>
              <p style="font-size:13px;color:#605C57;margin:0"><strong>Estado:</strong> <span style="color:#1F6B38">Activa</span></p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background-color:#FF5E1F;border-radius:8px">
              <a href="${link}" style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Entrar a mi workspace</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#9E9A94;margin:0">Si no esperabas este mail, ignorálo. Si no estás seguro, comunicate con quien te invitó.</p>
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
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 20px 0">Recibimos un pedido para restablecer la contraseña de tu cuenta en Nexa CRM.</p>
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 28px 0">Hacé clic en el botón de abajo para elegir una nueva contraseña. Si no solicitaste este cambio, podés ignorar este mensaje de forma segura.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background-color:#FF5E1F;border-radius:8px">
              <a href="${resetLink}" style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Restablecer contraseña</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:12px;color:#9E9A94;margin:0 0 8px 0;letter-spacing:0.04em;text-transform:uppercase;font-weight:600">Recomendaciones de seguridad</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0">· Usá una contraseña larga (mínimo 12 caracteres)</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0">· Combiná letras, números y símbolos</p>
              <p style="font-size:13px;color:#605C57;margin:0">· No reutilizá contraseñas de otros servicios</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#9E9A94;margin:0">Este enlace expira en 1 hora. Si no fuiste vos, cambiá tu contraseña lo antes posible.</p>
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
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 20px 0">Bienvenido a Nexa CRM. Para activar tu cuenta y empezar a usar todas las funciones, confirmá que esta es tu casilla de correo.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0">
          <tr>
            <td style="background-color:#FF5E1F;border-radius:8px">
              <a href="${verifyLink}" style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Verificar mi email</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:12px;color:#9E9A94;margin:0 0 8px 0;letter-spacing:0.04em;text-transform:uppercase;font-weight:600">¿Qué obtenés al verificar?</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0">· Acceso completo a tu dashboard y herramientas</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0">· Notificaciones de actividad y automatizaciones</p>
              <p style="font-size:13px;color:#605C57;margin:0">· Soporte prioritario ante cualquier consulta</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#9E9A94;margin:0 0 6px 0">Este enlace expira en 7 días.</p>
        <p style="font-size:12px;color:#9E9A94;margin:0">Si no creaste una cuenta en Nexa CRM, ignorá este mensaje.</p>
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
      : `Tu espacio de trabajo en Nexa CRM está listo. Clientes, oportunidades, presupuestos y automatizaciones están configurados y esperándote.`;
    const html = emailShell({
      eyebrow: 'NEXA · CRM',
      title: `Hola, ${escapeHtml(firstName)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 28px 0">${onwardCopy}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 32px 0">
          <tr>
            <td style="background-color:#FF5E1F;border-radius:8px">
              <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Entrar a Nexa CRM</a>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:12px;color:#9E9A94;margin:0 0 10px 0;letter-spacing:0.04em;text-transform:uppercase;font-weight:600">Primeros pasos</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 6px 0">· <strong>Cargá tus contactos</strong> — importá desde CSV o agregalos uno a uno</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 6px 0">· <strong>Creá tu primer presupuesto</strong> — usá las plantillas prediseñadas</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 6px 0">· <strong>Activá automatizaciones</strong> — conectá WhatsApp, Slack o email</p>
              <p style="font-size:13px;color:#605C57;margin:0">· <strong>Invitá a tu equipo</strong> — trabajá en conjunto desde el mismo workspace</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#9E9A94;margin:0">Si necesitás ayuda, respondé este email o visitá nuestra documentación.</p>
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
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 20px 0">Hola, ${escapeHtml(firstName)}, tu suscripción ya está activa.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0"><strong>Plan:</strong> ${escapeHtml(templateName)}</p>
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0"><strong>Monto:</strong> ${escapeHtml(formatted)}/mes</p>
              <p style="font-size:13px;color:#605C57;margin:0"><strong>Próximo cobro:</strong> ${escapeHtml(until)}</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#9E9A94;margin:0">Podés gestionar tu suscripción desde <em>Automatizaciones → Mis suscripciones</em>.</p>
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
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 20px 0">Hola, ${escapeHtml(firstName)}, pausamos <strong>${escapeHtml(templateName)}</strong> porque no pudimos procesar el pago.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FEF2F2;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:12px;color:#9E9A94;margin:0 0 6px 0;letter-spacing:0.04em;text-transform:uppercase;font-weight:600">Motivo</p>
              <p style="font-size:13px;color:#605C57;margin:0">${escapeHtml(reason)}</p>
            </td>
          </tr>
        </table>
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 24px 0">Para reactivarla, actualizá tu medio de pago desde <strong>Settings → Suscripciones</strong> o contactanos para asistencia.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#9E9A94;margin:0">La automatización permanecerá pausa hasta que se resuelva el problema de pago.</p>
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
    const accent = ok ? '#1F6B38' : '#C42218';
    const dur = typeof durationMs === 'number' ? `${(durationMs / 1000).toFixed(1)}s` : '—';
    const summaryHtml = summary
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px 0"><tr><td style="background:#F5F0E9;border:1px solid #DDD0C1;border-radius:8px;padding:16px"><pre style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.6;color:#1A1A1A;margin:0;white-space:pre-wrap">${escapeHtml(summary)}</pre></td></tr></table>`
      : '';
    const errorHtml = error
      ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px 0"><tr><td style="background:#FEF2F2;border:1px solid #F5D6D2;border-radius:8px;padding:16px"><pre style="font-family:'Courier New',Courier,monospace;font-size:12px;line-height:1.6;color:#7f1d1d;margin:0;white-space:pre-wrap">${escapeHtml(error)}</pre></td></tr></table>`
      : '';
    const cta = dashboardsUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0"><tr><td style="background-color:${accent};border-radius:8px"><a href="${dashboardsUrl}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:0.02em">Ver en CRM</a></td></tr></table>`
      : '';
    const html = emailShell({
      eyebrow: `${eyebrow} · ${agentType}`,
      title: `${escapeHtml(title)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 8px 0">Hola, ${escapeHtml(firstName)}. ${escapeHtml(agentName)} terminó de procesarse por el evento <strong>${escapeHtml(eventName)}</strong>.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0"><strong>Estado:</strong> <span style="color:${accent}">${ok ? 'Completado' : 'Fallido'}</span></p>
              <p style="font-size:13px;color:#605C57;margin:0"><strong>Duración:</strong> ${dur}</p>
            </td>
          </tr>
        </table>
        ${summaryHtml}
        ${errorHtml}
        ${cta}
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#9E9A94;margin:0">Si querés cambiar a qué eventos este agente responde, editá la configuración del agente.</p>
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
    const purposeLabel = purpose === 'login' ? 'iniciar sesión' : 'restablecer tu contraseña';
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
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 24px 0">Usá el siguiente código para ${purposeLabel} en tu cuenta de Nexa CRM:</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="center" style="padding:0 0 28px 0">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#F5F0E9;border:1px solid #DDD0C1;border-radius:12px;padding:20px 40px">
                    <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#1A1A1A">${escapeHtml(code)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:13px;color:#605C57;margin:0 0 8px 0">Este código expira en <strong>${expiresInMinutes} minutos</strong> y solo se puede usar una vez.</p>
        <p style="font-size:13px;color:#605C57;margin:0 0 24px 0">Si no pediste este código, podés ignorar este mensaje de forma segura.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;padding:16px">
          <tr>
            <td style="padding:16px">
              <p style="font-size:12px;color:#9E9A94;margin:0 0 4px 0;letter-spacing:0.04em;text-transform:uppercase;font-weight:600">Consejo de seguridad</p>
              <p style="font-size:13px;color:#605C57;margin:0">Nunca compartas este código con nadie. El equipo de Nexa CRM nunca te lo va a pedir por teléfono o chat.</p>
            </td>
          </tr>
        </table>
      `,
    });
    return this.sendEmail({ to, subject, html });
  }

  async sendNewLoginEmail(opts: { to: string; firstName: string; at: Date; ip?: string }) {
    const { to, firstName, at, ip } = opts;
    const when = at.toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
    const ipLine = ip
      ? `<p style="font-size:13px;color:#605C57;margin:8px 0 0 0">Dirección IP: <code style="background:#F5F0E9;padding:3px 8px;border-radius:4px;font-size:12px;color:#1A1A1A">${escapeHtml(ip)}</code></p>`
      : '';
    const subject = `Nuevo inicio de sesión en Nexa CRM`;
    const html = emailShell({
      eyebrow: 'NEXA · Seguridad',
      title: `Hola, ${escapeHtml(firstName)}`,
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 8px 0">Se detectó un nuevo inicio de sesión en tu cuenta de Nexa CRM.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0"><strong>Fecha:</strong> ${escapeHtml(when)}</p>
              ${ipLine}
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#FEF2F2;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:12px;color:#9E9A94;margin:0 0 6px 0;letter-spacing:0.04em;text-transform:uppercase;font-weight:600">¿No fuiste vos?</p>
              <p style="font-size:13px;color:#605C57;margin:0">Si no reconocés este inicio de sesión, cambiá tu contraseña inmediatamente desde <strong>Settings → Seguridad</strong>. También podés cerrar todas las sesiones activas desde ahí.</p>
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px 0">
          <tr><td style="border-top:1px solid #DDD0C1;font-size:0;line-height:0">&nbsp;</td></tr>
        </table>
        <p style="font-size:12px;color:#9E9A94;margin:0">Este es un email automático de seguridad. No respondas a este mensaje.</p>
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

    const html = emailShell({
      eyebrow: 'NEXA · Facturación',
      title: escapeHtml(
        strip(
          kind === 'paid'
            ? 'Pago confirmado'
            : kind === 'cancelled'
              ? 'Factura anulada'
              : 'Nueva factura',
        ),
      ),
      bodyHtml: `
        <p style="font-size:14px;line-height:1.65;color:#605C57;margin:0 0 20px 0">${body}</p>
        ${
          kind !== 'cancelled'
            ? `
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#F5F0E9;border-radius:8px;margin:0 0 24px 0">
          <tr>
            <td style="padding:16px">
              <p style="font-size:13px;color:#605C57;margin:0 0 4px 0"><strong>Factura:</strong> ${escapeHtml(invoiceNumber)}</p>
              ${totalText ? `<p style="font-size:13px;color:#605C57;margin:0"><strong>Total:</strong> ${escapeHtml(totalText)}</p>` : ''}
            </td>
          </tr>
        </table>`
            : ''
        }
        ${pdfBuffer ? `<p style="font-size:12px;color:#9E9A94;margin:0">El comprobante adjunto contiene los detalles completos de la transacción.</p>` : ''}
      `,
    });

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

function emailShell(opts: {
  eyebrow: string;
  title: string;
  bodyHtml: string;
  footerHtml?: string;
}) {
  return `
    <div style="margin:0;padding:0;background-color:#EDE5D8;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#EDE5D8">
        <tr>
          <td align="center" style="padding:40px 20px">
            <table role="presentation" cellpadding="0" cellspacing="0" width="560" style="max-width:560px;width:100%">
              <!-- Logo -->
              <tr>
                <td align="center" style="padding-bottom:32px">
                  <table role="presentation" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background-color:#1A1A1A;color:#fffefb;font-family:Georgia,serif;font-size:16px;font-weight:600;letter-spacing:-0.02em;padding:8px 16px;border-radius:6px">Nexa</td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Card -->
              <tr>
                <td style="background-color:#FFFFFF;border-radius:12px;border:1px solid #DDD0C1;overflow:hidden">
                  <!-- Naranja accent bar -->
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="height:4px;background-color:#FF5E1F;font-size:0;line-height:0">&nbsp;</td>
                    </tr>
                  </table>
                  <!-- Content -->
                  <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td style="padding:40px 40px 32px 40px">
                        <p style="margin:0 0 6px 0;letter-spacing:0.14em;text-transform:uppercase;font-size:10px;font-weight:600;color:#9E9A94">${escapeHtml(opts.eyebrow)}</p>
                        <h1 style="font-family:Georgia,serif;font-weight:500;font-size:26px;line-height:1.3;color:#1A1A1A;margin:0 0 24px 0;letter-spacing:-0.01em">${opts.title}</h1>
                        ${opts.bodyHtml}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td align="center" style="padding:28px 20px 0 20px">
                  ${
                    opts.footerHtml ||
                    `
                  <p style="margin:0 0 6px 0;font-size:11px;color:#9E9A94;letter-spacing:0.04em">Nexa CRM</p>
                  <p style="margin:0;font-size:11px;color:#BFB4A1">Recibiste este email porque tenés una cuenta asociada a esta dirección.</p>
                  `
                  }
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
