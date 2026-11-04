// Cria ou atualiza a conta PROPRIETÁRIA (modo privado, sem cadastro público).
//
//   npm run owner:create -- voce@dominio.com "Seu nome"
//   Docker: docker compose exec -it app node scripts/owner.mjs voce@dominio.com "Seu nome"
//
// A senha vem de OWNER_PASSWORD ou é pedida no terminal (sem eco). Mínimo de
// 12 caracteres. Ao trocar a senha, todas as sessões abertas são encerradas.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline";

const MIN = 12;

function askHidden(q) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const out = rl;
    out._writeToOutput = (s) => { if (s.includes(q)) process.stdout.write(s); };
    rl.question(q, (a) => { rl.close(); process.stdout.write("\n"); resolve(a); });
  });
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  const name = process.argv[3]?.trim() || email?.split("@")[0] || "Proprietário";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Uso: npm run owner:create -- voce@dominio.com "Seu nome"');
    process.exit(1);
  }
  const password = process.env.OWNER_PASSWORD ?? (await askHidden(`Senha para ${email} (mín. ${MIN} caracteres): `));
  if (password.length < MIN) {
    console.error(`A senha precisa ter pelo menos ${MIN} caracteres.`);
    process.exit(1);
  }
  const prisma = new PrismaClient();
  try {
    await prisma.platformSettings.upsert({ where: { id: "global" }, create: { id: "global" }, update: {} });
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name, passwordHash, role: "ADMIN", emailVerifiedAt: new Date(), subscription: { create: { status: "NONE" } } },
      update: { passwordHash, role: "ADMIN", adminSuspendedAt: null, emailVerifiedAt: new Date() },
    });
    const ended = await prisma.session.deleteMany({ where: { userId: user.id } });
    const others = await prisma.user.count({ where: { id: { not: user.id } } });
    console.log(`Conta proprietária pronta: ${user.email}. Sessões encerradas: ${ended.count}.`);
    if (process.env.OWNER_EMAIL && process.env.OWNER_EMAIL.toLowerCase() !== email) console.warn(`Atenção: OWNER_EMAIL está definido como ${process.env.OWNER_EMAIL}; defina-o como ${email} para que esta conta consiga entrar.`);
    if (others) console.log(`Há ${others} outra(s) conta(s) no banco. No modo privado (ACCESS_MODE=private) elas não conseguem entrar.`);
  } finally {
    await prisma.$disconnect();
  }
}
main();
