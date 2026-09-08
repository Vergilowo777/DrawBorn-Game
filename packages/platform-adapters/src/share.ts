export interface ShareRequest {
  readonly title: string;
  readonly resourceId: string;
}

export interface ShareAdapter {
  share(request: ShareRequest): Promise<void>;
}
