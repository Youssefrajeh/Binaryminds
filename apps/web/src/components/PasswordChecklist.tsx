import { PASSWORD_RULES } from "@campushub/shared";

export function PasswordChecklist({ password }: { password: string }) {
  return (
    <ul className="mt-2 space-y-1 text-xs" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <li key={rule.id} className={met ? "text-success" : "text-muted"}>
            <span aria-hidden="true">{met ? "✓" : "○"}</span> {rule.label}
            <span className="sr-only">{met ? " (met)" : " (not met)"}</span>
          </li>
        );
      })}
    </ul>
  );
}
