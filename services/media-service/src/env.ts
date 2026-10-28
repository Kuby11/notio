/**
 * Environment contract of media-service.
 *
 * Files live in R2 (binding MEDIA), metadata in the objects' customMetadata:
 * the service needs no separate database. The service is not exposed outward —
 * only the gateway is public, inside there is only a Service Binding.
 */
export interface Bindings {
  /** R2 bucket with media files. The object key is the file's UUID. */
  MEDIA: R2Bucket;
  ENVIRONMENT: string;
  SERVICE_VERSION: string;
}

export type AppEnv = {
  Bindings: Bindings;
};
