import "server-only";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({ secure: true });

export const CLOUDINARY_UPLOAD_FOLDER = "opsdesk/attachments";

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
}

/** Signature pour un upload direct navigateur → Cloudinary (le fichier ne transite pas par notre serveur). */
export function createUploadSignature(): UploadSignature {
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign = { timestamp, folder: CLOUDINARY_UPLOAD_FOLDER };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    cloudinary.config().api_secret as string,
  );

  return {
    cloudName: cloudinary.config().cloud_name as string,
    apiKey: cloudinary.config().api_key as string,
    timestamp,
    signature,
    folder: CLOUDINARY_UPLOAD_FOLDER,
  };
}

export interface VerifiedResource {
  publicId: string;
  secureUrl: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Ne jamais faire confiance aux métadonnées envoyées par le client après un upload
 * direct : on revérifie l'existence et les propriétés réelles auprès de Cloudinary
 * avant de persister l'Attachment.
 */
export async function verifyUploadedResource(publicId: string): Promise<VerifiedResource> {
  if (!publicId.startsWith(`${CLOUDINARY_UPLOAD_FOLDER}/`)) {
    throw new Error("Ressource en dehors du dossier attendu");
  }

  const resource = await cloudinary.api.resource(publicId, { resource_type: "image" });

  return {
    publicId: resource.public_id,
    secureUrl: resource.secure_url,
    mimeType: `image/${resource.format}`,
    sizeBytes: resource.bytes,
  };
}
