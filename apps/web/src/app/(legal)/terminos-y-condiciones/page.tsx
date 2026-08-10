import { LegalLayout } from '@/components/legal/legal-layout';

const LAST_UPDATED = '2026-08-01';

export default function TermsPage() {
  return (
    <LegalLayout title="Terminos y Condiciones" lastUpdated={LAST_UPDATED}>
      <Section title="1. Aceptacion de los Terminos">
        <p>
          Al registrarse, acceder o utilizar Nexa CRM (&ldquo;la Plataforma&rdquo;), usted
          (&ldquo;el Usuario&rdquo; o &ldquo;el Cliente&rdquo;) acepta de forma plena y sin reservas
          estos Terminos y Condiciones de Uso (&ldquo;los Terminos&rdquo;). Si no esta de acuerdo
          con ellos, debe abstenerse de usar la Plataforma.
        </p>
        <p>
          Nexa CRM es un servicio de software como servicio (SaaS) provisto por un prestador
          independiente persona fisica con domicilio en la Republica Argentina (&ldquo;Nexa&rdquo;,
          &ldquo;nosotros&rdquo; o &ldquo;el Proveedor&rdquo;). El acceso a la Plataforma es de
          caracter personal e intransferible.
        </p>
      </Section>

      <Section title="2. Descripcion del Servicio">
        <p>
          Nexa CRM es una plataforma de gestion y automatizacion comercial que integra
          funcionalidades de CRM, pipeline de ventas, cotizaciones, facturacion electronica,
          inventario, tareas, calendario, automatizaciones mediante flujos de trabajo (n8n), agentes
          de inteligencia artificial e integracion con WhatsApp Business, entre otros.
        </p>
        <p>
          El Proveedor se reserva el derecho de modificar, ampliar, suspender o discontinuar
          funcionalidades de la Plataforma en cualquier momento, notificando con antelacion
          razonable a los Usuarios a traves de la Plataforma o por correo electronico.
        </p>
      </Section>

      <Section title="3. Cuenta de Usuario">
        <ol type="a">
          <li>
            <strong>Registro.</strong> Para usar la Plataforma, el Usuario debe crear una cuenta
            proporcionando informacion verdadera, precisa y completa. Es responsabilidad del Usuario
            mantener actualizada esa informacion.
          </li>
          <li>
            <strong>Credenciales.</strong> El Usuario es el unico responsable de mantener la
            confidencialidad de sus credenciales de acceso (email y contrasena). Cualquier actividad
            realizada bajo su cuenta se presumen efectuada por el Usuario. Nexa no sera responsable
            por el uso no autorizado de la cuenta.
          </li>
          <li>
            <strong>Múltiples usuarios.</strong> Segun el plan contratado, el Usuario podra invitar
            a miembros de su organizacion con distintos roles (OWNER, ADMIN, MEMBER, VIEWER). El
            Usuario titular es responsable de las acciones de todos los miembros de su organizacion.
          </li>
          <li>
            <strong>Verificaci&oacute;n en dos pasos (2FA).</strong> La Plataforma ofrece
            autenticacion de doble factor opcional. Se recomienda encarecidamente su activacion.
          </li>
        </ol>
      </Section>

      <Section title="4. Planes, Precios y Pagos">
        <ol type="a">
          <li>
            <strong>Planes.</strong> La Plataforma ofrece planes gratuitos y pagos (Starter, Pro,
            Enterprise) con funcionalidades, limites y limites de uso diferenciados. Las
            funcionalidades de cada plan pueden consultarse en la pagina del pricing de la
            Plataforma.
          </li>
          <li>
            <strong>Periodo de prugues.</strong> Algunos planes pueden incluir un periodo de prueba
            gratuito. Finalizado ese periodo, el Usuario debera contratar un plan pago para
            continuar usando la Plataforma.
          </li>
          <li>
            <strong>Precios.</strong> Los precios publicados estan expresados en dolares
            estadounidenses (USD) y no incluyen impuestos aplicables segun la jurisdiccion del
            Usuario. Nexa se reserva el derecho de actualizar los precios con notificacion de al
            menos treinta dias de anticipacion.
          </li>
          <li>
            <strong>Facturacion recurrente.</strong> La contratacion de un plan pago implica la
            autorizacion para que Nexa cobre las tarifas correspondientes de forma recurrente
            (mensual) hasta que el usuario cancele la suscripcion.
          </li>
          <li>
            <strong>Procesamiento de pagos.</strong> Los pagos son procesados a traves de
            proveedores externos como Mercado Pago y/o Stripe. Nexa no almacena datos completos de
            tarjetas de credito ni debito; esos datos son manejados directamente por los
            procesadores. No obstante, en caso de utilizar un procesador propio de Nexa, se
            implementaran los controles de seguridad PCI-DSS correspondientes.
          </li>
          <li>
            <strong>Actualización de medio de pago.</strong> Si un pago no puede procesarse, la
            Plataforma podra suspender el acceso hasta que el pago sea regularizado. En ese periodo,
            los datos del Usuario permaneceran protegidos y accesibles por un plazo razonable.
          </li>
          <li>
            <strong>Facturaci&Onde;n.</strong> Nexa emitira la factura correspondiente a cada pago
            recibido segun normativa fiscal argentina (Factura Tipo C para consumidores finales,
            Factura Tipo E para exportacion, segual corresponda, quedando a disposicion el Usuario
            en su panel.
          </li>
        </ol>
      </Section>

      <Section title="5. Derechos de Propiedad intelectual">
        <p>
          La Plataforma, incluyendo su codigo fuente, diseño, logo, textos, graficos y bases de
          datos, es propiedad exclusive del Proveedor y esta protegida por las leyes de propiedad
          intelectual de la Republica Argentina (Ley 11.723) y tratados internacionales.
        </p>
        <p>
          Nexa otorga al Usuario una licencia limitada, no exclusiva, intransferible y revocable
          para usar la Plataforma exclusivamente conforme a estos Terminos y durante la vigencia de
          la suscripción.
        </p>
        <p>
          Los datos que el Usuario genere o cargue en la Plataforma (clientes, transacciones,
          cotizaciones, facturas, etc.) son y seguiran siendo de propiedad exclusiva del Usuario.
        </p>
      </Section>

      <Section title="6. Tratamiento de Datos y Confidencialidad">
        <p>
          Nexa actua como encargado del tratamiento respecto de los datos personales que el Usuario
          carga en la Plataforma (por ejemplo, datos de sus propios clientes). La relacion juridica
          queda regida por estos Terminos y por el
          <a href="/politica-de-privacidad">Aviso de Privacidad</a>.
        </p>
        <p>
          El usuario es el responsable de tratamiento de los datos de sus clientes y garantiza a
          Nexa que las ha obtenido licitamente y tiene derecho a tratarlos.
        </p>
        <p>
          Nexa adoptara medidas tecnicas y organizativas razonables para preservar la seguridad de
          los datos tratados.
        </p>
      </Section>

      <Section title="7. Integracion con Servicios de Terceros">
        <ol type="a">
          <li>
            La Plataforma permite conectarse con servicios externos (WhatsApp Business, Mercado
            Pago, Stripe, Google Calendar, Slack, Shopify, WooCommerce, Microsoft Teams, Google
            Sheets y otros). La utilizacion de dichos servicios se rige por los terminos y
            condiciones de cada uno de ellos.
          </li>
          <li>
            Nexa no garantiza la disponibilidad o funcionamiento de los servicios de terceros y no
            sera responsable por daños derivados de la utilizacion o falta de disponibilidad de
            estos.
          </li>
          <li>
            <strong>WhatsApp Business.</strong> La integracion con WhatsApp se realiza mediante las
            API oficiales de Meta. El usuario es responsable de cumplir el Reglamento de Comercio y
            las Politicas de WhatsApp.
          </li>
        </ol>
      </Section>

      <Section title="8. Agentes de Inteligencia Artificial">
        <p>
          La Plataforma viene con agentes de inteligencia artificial impulsados por modelos de
          lenguaje gnerativos de terceros (OpenAI y alternativas). Estos agentes generan resumenes,
          recomendaciones e insightes automaticos. El usuario reconoce que:
        </p>
        <ol type="a">
          <li>
            Los resultados de la IA son meramente orientativos. No constituyen asesoramiento
            profesional, comercial, fiscal o legal.
          </li>
          <li>
            Nexa no garantiza la exactitud, completitud ni no-bias de las respuestas generadas por
            los agentes.
          </li>
          <li>
            El usuario verificara siempre la informacion resultante de los agentes antes de actuar
            sobre ella.
          </li>
        </ol>
      </Section>

      <Section title="8. Uso esperado y Restricciones">
        <p>
          El usuario se obliga a usar la Plataforma exclusivamente para propositos licitos,
          absteniendose de: :
        </p>
        <ol type="a">
          <li>Cargar contenido ilegal, difamatorio, obseno, fraudulento o malicioso.</li>
          <li>
            Intentar eludir o vulnerar medidas de seguridad, o intentar acceso no autorizado a
            cuentas ajenas.
          </li>
          <li>
            Realizar operaciones de ingenieria inversa, descompilar o extraer codigo fuente de la
            Plataforma.
          </li>
          <li>
            Utilizar la Plataforma para envio de spam no deseado o mensajes masivos sin
            consentimiento.
          </li>
          <li>
            Hacer uso excesivo o desmedido que afecte la operacion de otros usuarios (restriccion de
            Recursos).
          </li>
        </ol>
        <p>
          Nexa se reserva el derecho de suspender o cancelar cualquier cuenta que infrinja estas
          restricciones, sin perjuicio de las acciones legales correspondientes.
        </p>
      </Section>

      <Section title="9. Exclusion de Garantias">
        <p>
          La Plataforma es ofrecida &ldquo;tal cual&rdquo; y &ldquo;como este disponible&rdquo;. Con
          la maxima extension permitida por la ley argentina, Nexa excluye toda correspondiente
          garantia, explítica o implicita, incluyendo pero no limitandose a: comerocidad, adecuacion
          para un fin particular o no infraccion.
        </p>
        <p>
          Nexa no garantiza que la Plataforma sea ininterrumpida, libre de errores, virus u otros
          componentes rmalignos.
        </p>
      </Section>

      <Section title="10. Limitation de Responsabilidad">
        <p>
          En la maxima son permitida por la jurisdiccion en curso, Nexa no sera responsable por
          daños indirectos, incidentales, especiales, punitivos o consecuentes, incluyendo pero sin
          limitar: perdida de ingresos, perdida de beneficios, perdida de produccion, interrupciona
          negocios, perdida de oportunidades de negocio o perdida de datos, incluso si Nexa fue
          avisada de la posibilidad de dichos daños.
        </p>
        <p>
          La responsabilidad maxima de Nexa frente al usuario por cualquier motivo, en el agregado
          de toda reclamacion, que surja de o que este relacionada con estos Terminos, no podra
          exceder: (i) para servicios: el monto total de las facturas pagadas por el Usuario durante
          los doce (12) meses anteriores al hecho que da origen a la reclamacion; y (ii) para plan
          gratuicio: cien dolares (USD 100).
        </p>
      </Section>

      <Section title="11. Terminacion">
        <ol type="a">
          <li>
            El usuario puede cancelar su cuenta en cualquier momento a traves del panel de
            configuracion de la Plataforma. La cancelion es efectiva inmediatamente para los
            servicios pagos al final del periodo de facturacion corriente.
          </li>
          <li>
            Nexa puede suspender o cancelar la cuenta de un usuario por infraccion de estos
            Terminos, por actividad fraudulenta, o por la decision comercial del Proveedor,
            notificando con quince (15) dias de antelación siempre que sea razonable.
          </li>
          <li>
            Tras la terminacion, el Usuario tendra quince (15) dias para exportar sus datos a traves
            de las herramientas que la Plataforma ofrece. Vencido ese plazo, Nexa podra eliminar los
            datos del Usuario.
          </li>
        </ol>
      </Section>

      <Section title="12. Exportacion de Datos y Portabilidad">
        <p>
          La Plataforma facilita al Usuario la descarga de sus datos en formatos estandscr (CSV,
          JSON), a efectos de cumplir con lo dispuesto en la Ley 25.326 de Proteccion de Datos
          Personales.
        </p>
      </Section>

      <Section title="13. Modificaciones en estos Terminos">
        <p>
          Nexa podra modificar estos Terminos en cualquier momento. Las modificaciones seran
          comunicadas por correo electronico o mediante un aviso en la Plataforma conal menos quince
          (15) dias de anterioridad a su entrada en vigencia. El uso continuado de la Plataforma
          tras la fecha de entrada en vigencia de los nuevos Terminoses im((a la aceptacion de los
          mismos.
        </p>
      </Section>

      <Section title="14. Jurisdiccion y Ley Aplicable">
        <p>
          Estos Terminos se rigen por las leyes de la Republica Argentina. Anteva controversia, las
          partes se subm a la competencia de los tribunales ordinarios de la Ciudad Autonoma de
          Buenos Aires, con renuncia a cualquier otro fuero o jurisdiccion que pudiera corresponder.
        </p>
      </Section>

      <Section title="15. Contacto">
        <p>
          Para cualquier consulta sobre estos Terminos, el Usuario puede contactarse a traves de:
        </p>
        <ul>
          <li>
            Correo electronico: <a href="mailto:nexacrm0@gmail.com">nexacrm0@gmail.com</a>
          </li>
          <li>Seccion de soporte dentro de la Plataforma</li>
        </ul>
      </Section>
    </LegalLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-foreground mb-3 text-lg font-semibold">{title}</h2>
      <div className="text-muted-foreground [&_a]:text-primary [&_p]:text-ink-3 space-y-2 text-sm leading-relaxed [&_a]:underline [&_li]:mb-1 [&_li]:ml-4 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ul]:list-disc">
        {children}
      </div>
    </section>
  );
}
