import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, "deploy-assets");
if (output !== join(root, "deploy-assets")) throw new Error("Invalid asset output path");

const files = [
  "index.html", "admin.html", "admin.js", "admin.css",
  "admin-workspace.css", "admin-workspace.js", "admin-console.css",
  "admin-enterprise.css", "admin-enterprise-v6.css", "admin-system.css",
  "favicon.ico", "favicon.svg", "favicon.png", "favicon-16x16.png",
  "favicon-32x32.png", "favicon-48x48.png", "favicon-64x64.png",
  "apple-touch-icon.png", "pickquote-admin-symbol.png", "site.webmanifest",
  "robots.txt", "sitemap.xml",
];
const directories = [
  "alimtalk", "approved-sellers", "brand-hall", "customers",
  "seller-access", "sellers", "anonymous-chat", "anonymous-consultation",
  "subscription-products", "assets", "vendor",
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) await cp(join(root, file), join(output, file));
for (const directory of directories) {
  await cp(join(root, directory), join(output, directory), { recursive: true });
}
