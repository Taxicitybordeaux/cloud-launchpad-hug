import type { ComponentType } from "react";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

import { template as reservationNotification } from "./reservation-notification";
import { template as contactMessage } from "./contact-message";
import { template as reservationClientConfirmation } from "./reservation-client-confirmation";
import { template as courseAccepted } from "./course-accepted";

export const TEMPLATES: Record<string, TemplateEntry> = {
  "reservation-notification": reservationNotification,
  "contact-message": contactMessage,
  "reservation-client-confirmation": reservationClientConfirmation,
  "course-accepted": courseAccepted,
};
