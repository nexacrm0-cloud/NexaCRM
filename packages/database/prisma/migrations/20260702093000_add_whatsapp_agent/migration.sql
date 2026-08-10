-- Insert WhatsApp AI agent
INSERT INTO agents (id, name, "displayName", description, type, icon, "webhookUrl", "workflowUrl", "requiredPlan", features, "isActive", "createdAt", "updatedAt")
VALUES (
  'agent-whatsapp-ai',
  'whatsapp_ai',
  'Asistente WhatsApp',
  'Agente IA que gestiona conversaciones de WhatsApp: responde consultas, califica leads, agenda reuniones y da seguimiento automático.',
  'whatsapp_ai',
  'MessageSquare',
  '',
  '',
  'pro',
  '["chat_inteligente", "lead_calification", "auto_reply", "meeting_scheduling", "sentiment_analysis"]',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
