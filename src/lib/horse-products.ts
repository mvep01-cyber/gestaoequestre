export const horseProductSlots = ["feno", "racao", "baia", "outros"] as const;
export type HorseProductSlot = (typeof horseProductSlots)[number];

export const horseProductLabels: Record<HorseProductSlot, string> = {
  feno: "Feno",
  racao: "Ração",
  baia: "Baia",
  outros: "Outros",
};

export type HorseProductSelection = {
  cadastroId: string;
  ids: Record<HorseProductSlot, string>;
};

export function horseProductSlot(name: string): HorseProductSlot {
  const normalized = name.trim().toLocaleLowerCase("pt-BR");
  if (normalized === "feno") return "feno";
  if (normalized === "ração") return "racao";
  if (normalized === "baia") return "baia";
  return "outros";
}
