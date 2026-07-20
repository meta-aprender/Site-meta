import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const { PrismaClient } = require("@prisma/client");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const spaces = [
  {
    name: "1º Ano",
    slug: "1-ano",
    displayOrder: 1,
  },
  {
    name: "2º Ano",
    slug: "2-ano",
    displayOrder: 2,
  },
  {
    name: "3º Ano",
    slug: "3-ano",
    displayOrder: 3,
  },
  {
    name: "4º Ano",
    slug: "4-ano",
    displayOrder: 4,
  },
  {
    name: "5º Ano",
    slug: "5-ano",
    displayOrder: 5,
  },
  {
    name: "Jatobá",
    slug: "jatoba",
    displayOrder: 6,
  },
  {
    name: "São Sebastião",
    slug: "sao-sebastiao",
    displayOrder: 7,
  },
  {
    name: "Belo Horizonte",
    slug: "belo-horizonte",
    displayOrder: 8,
  },
  {
    name: "Campo",
    slug: "campo",
    displayOrder: 9,
  },
  {
    name: "Frei Damião",
    slug: "frei-damiao",
    displayOrder: 10,
  },
  {
    name: "SAEV",
    slug: "saev",
    displayOrder: 11,
  },
  {
    name: "SEDUC",
    slug: "seduc",
    displayOrder: 12,
  },
];

async function main() {
  console.log("Criando espaços iniciais...");

  for (const space of spaces) {
    await prisma.space.upsert({
      where: {
        slug: space.slug,
      },
      update: {
        name: space.name,
        displayOrder: space.displayOrder,
        active: true,
      },
      create: {
        ...space,
        active: true,
      },
    });

    console.log(`✓ ${space.name}`);
  }

  console.log("Todos os espaços foram configurados com sucesso.");
}

main()
  .catch((error) => {
    console.error("Erro ao criar os espaços:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });