// Promove uma conta existente a administrador:  npm run db:seed -- email@dominio.com
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
async function main() {
  await prisma.platformSettings.upsert({ where: { id: "global" }, create: { id: "global" }, update: {} });
  const email = process.argv[2]?.toLowerCase();
  if (!email) {
    console.log("Configurações padrão criadas. Para promover um administrador: npm run db:seed -- email@dominio.com");
    return;
  }
  const u = await prisma.user.update({ where: { email }, data: { role: "ADMIN" } });
  console.log(`${u.email} agora é administrador.`);
}
main().finally(() => prisma.$disconnect());
