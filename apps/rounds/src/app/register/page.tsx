import { t } from "@/copy";
import { AppTopbar } from "../AppTopbar";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <main className="rounds-shell">
      <AppTopbar section={t("register.title")} />
      <RegisterForm />
    </main>
  );
}
