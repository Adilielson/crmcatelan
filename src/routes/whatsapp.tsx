import { createFileRoute } from '@tanstack/react-router';
import { WhatsAppConfig } from '@/pages/WhatsAppConfig';

export const Route = createFileRoute('/whatsapp')({
  component: WhatsAppConfig,
});
