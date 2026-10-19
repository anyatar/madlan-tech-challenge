// Prints the ADMIN_PASSWORD_HASH value for a password. Asks for it so it never lands in shell history.
import { createInterface } from "node:readline/promises";
import { hashPassword } from "../lib/admin-auth.ts";

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = (await rl.question("Admin password: ")).trim();
rl.close();
if (password.length < 16) throw new Error("use at least 16 characters");
console.log(`ADMIN_PASSWORD_HASH=${hashPassword(password)}`);
