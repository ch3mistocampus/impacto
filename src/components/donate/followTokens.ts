export type SavedPledge = {
  token: string;
  qty: number;
  nameEs: string;
  nameEn: string;
  unit: string;
  alias: string;
  at: number;
};

const KEY = "impacto.followTokens";

export function loadPledges(): SavedPledge[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as SavedPledge[]) : [];
  } catch {
    return [];
  }
}

export function savePledge(p: SavedPledge): boolean {
  try {
    const next = [p, ...loadPledges().filter((x) => x.token !== p.token)].slice(0, 50);
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVT));
    return true;
  } catch {
    return false;
  }
}

// --- tiny external store so components can read saved pledges without effects ---
const EVT = "impacto:pledges";

export function subscribePledges(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVT, cb);
  };
}

export function pledgesSnapshot(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function parsePledges(raw: string): SavedPledge[] {
  try {
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? (arr as SavedPledge[]) : [];
  } catch {
    return [];
  }
}
