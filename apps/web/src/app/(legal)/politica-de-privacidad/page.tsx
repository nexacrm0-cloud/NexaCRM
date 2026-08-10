import { LegalLayout } from '@/components/legal/legal-layout';

const LAST_UPDATED = '2026-08-01';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Politica de Privacidad" lastUpdated={LAST_UPDATED}>
      <p className="text-muted-foreground mb-8 text-sm leading-relaxed">
        En Nexa CRM respetamos tu privacidad y nos comprometemos a proteger tus datos personales.
        Esta Politica explica que datos recolectamos, como los usamos, con quien los compartimos y
        que derechos tenes como titular de los datos, en cumplimiento de la Ley 25.326 de Proteccion
        de Datos Personales de la Republica Argentina y normativa complementaria.
      </p>

      <Section title="1. Responsable del Tratamiento">
        <p>
          El responsable del tratamiento de los datos personales que vos nos proporcionas
          directamente es el proveedor del servicio Nexa CRM, persona fisica con domicilio en la
          Republica Argentina.
        </p>
        <p>
          Correo de contacto para cuestiones de privacidad:{' '}
          <a href="mailto:nexacrm0@gmail.com">nexacrm0@gmail.com</a>.
        </p>
        <p>
          Nexa CRM actua tambien como <strong>encargado del tratamiento</strong> respecto de los
          datos que nuestros clientes (los Usuarios) ingresan en la Plataforma acerca de sus propios
          clientes y contactos. En ese caso, el responsable del tratamiento es el Usuario titular de
          la cuenta.
        </p>
      </Section>

      <Section title="2. Datos que Recolectamos">
        <p>Recolectamos las siguientes categorias de datos personales:</p>

        <h3 className="text-foreground mt-4 font-medium">a. Datos de registro y cuenta</h3>
        <ul>
          <li>Nombre y apellido (obligatorios)</li>
          <li>Correo electronico (obligatorio)</li>
          <li>Contrasena (Hash encriptado, nunca en texto plano)</li>
          <li>Nombre de la organizacion (obligatorio)</li>
          <li>Numero de telefono (opcional)</li>
          <li>Avatar (opcional)</li>
        </ul>

        <h3 className="text-foreground mt-4 font-medium">
          b. Datos que vos cargas en la Plataforma (como responsable)
        </h3>
        <ul>
          <li>
            Datos de tus clientes: nombres, razon social, email, telefono, direccion, notas,
            etiquetas
          </li>
          <li>Datos fiscales de facturacion: CUIT, condicion ante el IVA, CAE, punto de venta</li>
          <li>Cotizaciones y oportunidades comerciales con valores economicos</li>
          <li>Tareas vinculadas a clientes y oportunidades</li>
          <li>Productos de inventario, variantes, precios y costos</li>
        </ul>

        <h3 className="text-foreground mt-4 font-medium">c. Mensajes de WhatsApp</h3>
        <p>
          Si activaste la integracion con WhatsApp Business, la Plataforma recibe y almacena el
          contenido de los mensajes intercambiados entre vos y tus clientes a traves de las APIs
          oficiales de Meta, con mecanismos de deduplicacion de mensajes.
        </p>

        <h3 className="text-foreground mt-4 font-medium">d. Datos de uso y navegacion</h3>
        <ul>
          <li>IP</li>
          <li>Tipo de navegador y sistema operativo</li>
          <li>Referrer (pagina de origen)</li>
          <li>Paginas visitadas, fecha y hora de acceso</li>
          <li>Interacciones dentro de la Plataforma (anomizadas o pseudonimizadas)</li>
        </ul>

        <h3 className="text-foreground mt-4 font-medium">e) Datos de pago</h3>
        <p>
          Nexa <strong>no almacena datos completos de tarjetas de credito o debito</strong>. El
          procesamiento de pagos es manejado por Mercado Pago o Stripe, proveedores con
          certificacion PCI-DSS.
        </p>
      </Section>

      <Section title="3. Finalidades del Tratamiento">
        <p>Utilizamos los datos recolectados para las siguientes finalidades:</p>
        <ol type="a">
          <li>Crear, mantener, gestionar tu cuenta.</li>
          <li>
            Prestar, mantener, mejorar y personalizar el servicio CRM contratado (pipeline,
            inventario, etc.).
          </li>
          <li>
            Enviarte notificaciones operativas (cambios, actualizaciones, alertas de seguridad).
          </li>
          <li>Enviarte avisos de vencimiento de suscripcion o incidencias de pago.</li>
          <li>Procesar pagos de los planes contratados.</li>
          <li>
            Proveer los servicios de agentes de inteligencia artificial disponibles en la
            Plataforma.
          </li>
          <li>
            Generar metricas y analitica de producto agregada (anonymizada) para fin de negocio de
            Nexa.
          </li>
          <li>Cumplir con requerimientos legales y regulatorios de jurisdiccion argentina.</li>
          <li>Prevenir fraudes, abuso y violaciones de estos Terminos.</li>
          <li>
            Enviar, previo consentimiento, comunicaciones comerciales sobre nuevas funcionalidades y
            mejoras que puedan interesarte.
          </li>
        </ol>
      </Section>

      <Section title="4. Base Legal del Tratamiento (segual Arg. Ley 25.326)">
        <p>El tratamiento de tus datos se funda en:</p>
        <ol type="a">
          <li>
            <strong>Ejecucion del contrato:</strong> necesitamos ciertos datos para proporcionar el
            servicio que contrataste.
          </li>
          <li>
            <strong>Consentimiento del titular:</strong> para envio de comunicaciones de msrketing y
            ciertas funcionalidades de automatizaciones
          </li>
          <li>
            <strong>Interes legitimo:</strong> para analitica de producto agareda, prevencion de
            fraude y recomendaciones de mejora basadas en la operacion interna de Nexa
          </li>
        </ol>
      </Section>

      <Section title="5. Tratamiento de Datos de Terceros">
        <p>
          El Usuario como responsable de tratamiento garantiza a Nexa que cumple con las
          obligaciones que le imponen las leyes de proteccion de datos aplicables respecto de los
          datos de clientes, prospectos y empleados que carga en la Plataforma. Nexa no evalua
          dichos datos ni los usa para fines distintos de proveer el servicio.
        </p>
        <p>
          El uso de WhatsApp Business implica a su vez que la Plataforma recibe datos personales en
          nombre del Usuario. La Plataforma es encargada del tratamiento de esos datos.
        </p>
      </Section>

      <Section title="6. Comparticion de Datos con Terceros">
        <p>No vendemos, alquilamos ni comercializamos datos personales en ningua circunstancia.</p>
        <p>Podemos compartir datos en estos escenarios:</p>
        <ol type="a">
          <li>
            <strong>Procesadores de pago</strong> (Mercado Pago, Stripe) limitado necesario para
            procesar el cobro.
          </li>
          <li>
            <strong>Servicios en la nube</strong> donde se aloja la Plataforma (infraestructura de
            base de datos y archivos hosteada por proveedores como Railway, AWS o Vercel, segual
            despliegue), con medida de cifrado en reposo y en transito.
          </li>
          <li>
            <strong>Servicios de IA</strong> (OpenAI y/o modelos alternativos) unicamente para
            procesar las peticiones de los agentes. Nexa no envía datos sin que el usuario invoque
            una funcion o interactue con el agente.
          </li>
          <li>
            <strong>APIs de Meta</strong> (WhatsApp Business): para habilitar la integracion, segal
            los Terminos de Meta.
          </li>
          <li>
            <strong>Obligacion legal</strong>: si un juez administrativo o un tribunal con
            competencia lo requiere formalmente.
          </li>
          <li>
            <strong>Proteccion de Nexa</strong>: cuando fuera necesario para proteger derechos,
            propiedad o la seguridad de Nexa, sus usuarios, empleados o el resolucion de incidencias
            de la plataforma.
          </li>
        </ol>
      </Section>

      <Section title="7. Transferencia Internacional de Datos">
        <p>
          Nexa utiliza infraestructura en la nube que puede estar alojada en Estados Unidos, Europa
          o Argentina.
        </p>
        <p>
          Los proveedores de servicios de infraestructura, pago, IA y comunicaciones contratados
          ofrecen clausulas contractuales tipo (SCCs / CCA) que garantizan nivel de proteccion. Se
          ha evaluado que estos ofrecen un nivel de proteccion similar al de la legislacion
          argentina.
        </p>
      </Section>

      <Section title="8. AI y Grandes Modelos de Lenguaje">
        <p>
          La plataforma integra servicios de inteligencia artificial generativa. Las interacciones y
          las consultas de los agentes son enviadas a las APIs de OpenAI (o proveedores
          alternativos) para su procesamiento.
        </p>
        <p>
          La ejecucion de agentes de IA estan bajo configuracion de opt-out (la IA solo se ejecuta
          si vos herarchicamente activas la funcionalidad).
        </p>
        <p>
          Los datos de los agentes no se comunican a los model sources de los modelos de IA de
          terceros (OpenAI politicas de no-entrenamiento en API).
        </p>
      </Section>

      <Section title="9. Conservacion de Datos">
        <p>Conservamos los datos personales durante estos tiempos:</p>
        <ul>
          <li>
            <strong>Cuenta activa:</strong> durante la vigencia de tu cuenta.
          </li>
          <li>
            <strong>Cuenta cancelada:</strong> durante quince dias, plazo durante el cual podras
            exportar tus datos vos mismo. Luego de ese periodo, son eliminados tanto de la base
            primaria como de los backups en un plazo compatible con la retencion de backup (max 90
            dias).
          </li>
          <li>Registro de auditoria: retencion de 2 anios.</li>
          <li>Lo registros de actividad: retencion de 6 meses.</li>
        </ul>
      </Section>

      <Section title="10. Seguridad">
        <p>
          Aplicando medidas tecnicas y organizativas: datos en reposito encriptados (AES-256), datos
          en transito (TLS 1.3), reglas separacion de tenants via Row-Level Security, roles de
          acceso minimo, y auditorias periodicas.
        </p>
        <p>
          Sin embargo, ningun sistema es impenetrable. En caso de una brecha de seguridad que
          comprometa tus datos, te notificaremos sin demora excesiva por correo electronico y
          haremos lo posible para mitigar el impacto.
        </p>
      </Section>

      <Section title="11. Cookies y Tecnologias Similares">
        <p>
          Usamos cookies tecnicas y de sesion necesarias para el funcionamiento seguro de la
          Plataforma (tales como cookies de JWT httpOnly para renovacion de sesion). No usamos
          cookies de seguimiento publicitario ni de terceros.
        </p>
        <p>
          Docker/user policies de navegador, el usuario siempre puede configurar su navegador para
          rechazar cookies, pero esto puede impedir el acceso correcto a Nexa.
        </p>
      </Section>

      <Section title="12. Derechos del Titular de Datos">
        <p>Como titular de datos, tenes derecho a:</p>
        <ol type="a">
          <li>
            <strong>Acceso y consulta:</strong> Obtener informacion de datos que Nexa tiene sobre
            vos.
          </li>
          <li>
            <strong>Ratificacion:</strong> Solicitar la correccion de datos inexactos.
          </li>
          <li>
            <strong>Supresion:</strong> Solicitar la eliminacion de los datos (salvo que debamos
            conservarlos por obligacion legal). Equivale a cancelar tu cuenta
          </li>
          <li>
            <strong>Portabilidad:</strong> Tus datos exportados en formato CSV/JSON standard.
          </li>
          <li>
            <strong>Oposicion:</strong> Oponerse al tratamiento para ciertas finalidades (por
            ejemplo, marketing directo).
          </li>
        </ol>
        <p>
          Para ejercer cualquiera de estos, envianos un correo a{' '}
          <a href="mailto:nexacrm0@gmail.com">nexacrm0@gmail.com</a>. Respondemos pedidos en un
          plazo maximo de 10 dias habiles. La identidad debe ser acreditada en ciertos casos.
        </p>
        <p>
          Sin que perjudique la via jurisdiccional -podes notificar, la AAIP (Agencia de Acceso a la
          Informacion Publica) como autoridad de control dependiente de la Ley 25.326.
        </p>
      </Section>

      <Section title="13. Menores de Edad">
        <p>
          Nexa CRM no esta dirigido a personas menores de 18 anios. Si como socio legal de un menor
          has percibido que se ha registrado un menor, contactanos a la casilla{' '}
          <a href="mailto:nexacrm0@gmail.com">nexacrm0@gmail.com</a> para cumplemente.
        </p>
      </Section>

      <Section title="14. Actualizaciones a esta Policia">
        <p>
          La intentidad actualizacion de esta Pagina es la que aparece al comienzo de la pagina. Si
          introducimos cambios relevantes, te notificaremos por mail con al menos 30 dias de
          anterioridad a que se aplicen. Seguir usando la Nexa despues de dicho plazo implicara
          aceptar los cambios.
        </p>
      </Section>

      <Section title="15. Consentimiento adicional">
        <p>
          Cuando, adicional a los derechos enumerado arriba, hay procesamiento que exigen
          consentimiento expreso segun la Ley de proteccion de datos (ejemplo envio de marketing,
          ciertas integraciones de IA proactivas), la Plataforma pedira ese consentimiento mediante
          un mecanismo de opt-in check en el panel.
        </p>
      </Section>

      <Section title="16. Contacto">
        <p>Para dudas sobre esta Politica, comunicate a:</p>
        <ul>
          <li>
            Correo: <a href="mailto:nexacrm0@gmail.com">nexacrm0@gmail.com</a>
          </li>
          <li>Soporte dentro de la Plataforma</li>
        </ul>
      </Section>
    </LegalLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-foreground mb-3 text-lg font-semibold">{title}</h2>
      <div className="text-muted-foreground [&_a]:text-primary [&_p]:text-ink-3 [&_h3]:text-foreground space-y-2 text-sm leading-relaxed [&_a]:underline [&_h3]:font-medium [&_li]:mb-1 [&_li]:ml-4 [&_ol]:ml-4 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ul]:list-disc">
        {children}
      </div>
    </section>
  );
}
