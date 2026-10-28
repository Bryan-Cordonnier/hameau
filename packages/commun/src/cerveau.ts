// Accès au cerveau pour tous les plugins de Hameau : chaque appel passe par le moteur (permission « distant »),
// qui seul connaît l'adresse et la clé. Les réponses sont du JSON rendu par les outils du cerveau.
import { connect } from "@etabli/sdk";

export class ErreurCerveau extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

/** Appelle un outil du cerveau et rend sa réponse lue en JSON (ou le texte brut si ce n'est pas du JSON). */
export async function appeler<T = unknown>(outil: string, args: Record<string, unknown> = {}): Promise<T> {
  const etabli = await connect();
  const r = await etabli.distant.appeler(outil, args);
  if (!r.ok) throw new ErreurCerveau(r.message, r.code);
  try {
    return JSON.parse(r.texte) as T;
  } catch {
    return r.texte as unknown as T;
  }
}
