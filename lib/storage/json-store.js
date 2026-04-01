import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const lockMap = new Map();

async function ensureParentDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return typeof fallbackValue === "function" ? fallbackValue() : structuredClone(fallbackValue);
    }
    throw error;
  }
}

export async function writeJsonAtomic(filePath, value) {
  await ensureParentDir(filePath);
  const tempFilePath = `${filePath}.tmp-${process.pid}-${Date.now()}-${crypto.randomUUID()}`;
  const payload = `${JSON.stringify(value, null, 2)}\n`;
  await fs.writeFile(tempFilePath, payload, "utf-8");
  await fs.rename(tempFilePath, filePath);
}

export async function ensureJsonFile(filePath, defaultValue) {
  try {
    await fs.access(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    await writeJsonAtomic(
      filePath,
      typeof defaultValue === "function" ? defaultValue() : structuredClone(defaultValue),
    );
  }
}

export async function withDataLock(lockKey, task) {
  const previous = lockMap.get(lockKey) || Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  lockMap.set(lockKey, run.finally(() => {
    if (lockMap.get(lockKey) === run) {
      lockMap.delete(lockKey);
    }
  }));
  return run;
}
