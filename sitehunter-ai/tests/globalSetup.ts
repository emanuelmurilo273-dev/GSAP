import { execSync } from "node:child_process";

// Aplica as migrações (não destrutivo) no banco de TESTE dedicado.
export default function () {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://sitehunter:sitehunter@localhost:5432/sitehunter_test";
  if (!/_test\b/.test(url)) throw new Error("TEST_DATABASE_URL precisa apontar para um banco de teste (nome terminando em _test).");
  execSync("npx prisma migrate deploy", { stdio: "pipe", env: { ...process.env, DATABASE_URL: url } });
}
