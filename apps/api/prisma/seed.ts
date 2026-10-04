import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  {
    name: "Electronics",
    slug: "electronics",
  },
  {
    name: "Books",
    slug: "books",
  },
  {
    name: "Furniture",
    slug: "furniture",
  },
  {
    name: "Clothing",
    slug: "clothing",
  },
  {
    name: "School Supplies",
    slug: "school-supplies",
  },
  {
    name: "Other",
    slug: "other",
  },
];

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: {
        slug: category.slug,
      },
      update: {
        name: category.name,
      },
      create: category,
    });
  }

  console.log("Marketplace categories seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
