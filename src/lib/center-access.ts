import { getCurrentUser, isTenantAvailable } from "@/lib/current-user";

export async function authorizedCenterUser() {
  const user = await getCurrentUser();
  if (!user || !isTenantAvailable(user)) return null;
  if (user.perfil === "ADMIN") return user;
  if (user.perfil === "CLIENTE" && user.tenant_id && user.cadastro_cte_haras_id) return user;
  return null;
}

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export const brazilianStates = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
