export interface PurchaseRequest {
  readonly productId: string;
}

export interface PurchaseResult {
  readonly platformTransactionId: string;
}

export interface PaymentAdapter {
  purchase(request: PurchaseRequest): Promise<PurchaseResult>;
  restorePurchases(): Promise<readonly PurchaseResult[]>;
}