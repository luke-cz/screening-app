export interface WebhookStatus {
  lastReceivedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  receivedCount: number;
  successCount: number;
  errorCount: number;
}

const status: WebhookStatus = {
  lastReceivedAt: null,
  lastSuccessAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  receivedCount: 0,
  successCount: 0,
  errorCount: 0,
};

export function recordWebhookReceived(): void {
  status.receivedCount += 1;
  status.lastReceivedAt = new Date().toISOString();
}

export function recordWebhookSuccess(): void {
  status.successCount += 1;
  status.lastSuccessAt = new Date().toISOString();
}

export function recordWebhookError(message: string): void {
  status.errorCount += 1;
  status.lastErrorAt = new Date().toISOString();
  status.lastErrorMessage = message;
}

export function getWebhookStatus(): WebhookStatus {
  return { ...status };
}
