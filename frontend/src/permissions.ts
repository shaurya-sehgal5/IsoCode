export type UserRole = "FINANCE_EXECUTIVE" | "CO_FOUNDER";

export function getCurrentUser() {
  const raw = localStorage.getItem("settleflow_user");

  if (!raw) return null;

  try {
    return JSON.parse(raw) as {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
  } catch {
    return null;
  }
}

export function isCoFounder() {
  return getCurrentUser()?.role === "CO_FOUNDER";
}

export function canManageRateCards() {
  return isCoFounder();
}