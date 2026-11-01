export type AccountAction = "reset" | "delete";

export function validateAccountConfirmation(action: AccountAction, confirmation: unknown): string {
  const expected = action === "reset" ? "RESET" : "DELETE";
  if (confirmation !== expected) throw new Error(`Type ${expected} to confirm.`);
  return expected;
}