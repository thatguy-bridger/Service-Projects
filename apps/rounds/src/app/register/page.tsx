import { t } from "@/copy";
import { AppTopbar } from "../AppTopbar";
import { RegisterForm } from "./RegisterForm";

export default function RegisterPage() {
  return (
    <>
      <AppTopbar section={t("register.title")} />
      <main className="rounds-shell">
        <RegisterForm />
      </main>
    </>
  );
}
