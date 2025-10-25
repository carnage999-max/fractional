#!/usr/bin/env node
import { dbService } from "./lib/dbService.js";

async function seed() {
  try {
    console.log("Starting database seeding...");
    await dbService.seed();
    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  }
}

seed();