import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

type Section = {
  body: string;
  start: number;
  title: string;
};

const CHANGELOG = new URL("../CHANGELOG.md", import.meta.url);
const PACKAGE = new URL("../package.json", import.meta.url);
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/;
const BETA = "> This is a beta release. Please report any issues you encounter.";

function die(message: string): never {
  console.error(`release: ${message}`);
  process.exit(1);
}

function git(...args: string[]) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }).trim();
  } catch {
    die(`git ${args.join(" ")} failed`);
  }
}

function readSections(text: string): Section[] {
  const heads = [...text.matchAll(/^# (.+)$/gm)];
  if (heads.length === 0) die("CHANGELOG.md has no sections");

  return heads.map((head, index) => ({
    body: text.slice(head.index + head[0].length, heads[index + 1]?.index),
    start: head.index,
    title: head[1],
  }));
}

function cut(version: string) {
  if (!SEMVER.test(version)) die(`\`${version}\` is not a version`);

  const tag = `v${version}`;
  if (git("status", "--porcelain", "--untracked-files=no")) die("the working tree is dirty");
  if (git("tag", "--list", tag)) die(`${tag} already exists`);

  const text = readFileSync(CHANGELOG, "utf8");
  const [next, ...released] = readSections(text);
  if (next.title !== "Next") die("CHANGELOG.md must open with a `# Next` section");

  const notes = next.body.trim();
  if (!notes) die("`# Next` is empty");

  const date = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const beta = version.includes("-") ? `${BETA}\n\n` : "";
  const section = `# ${version} (${date})\n\n${beta}${notes}\n\n---\n\n`;
  writeFileSync(CHANGELOG, `# Next\n\n${section}${text.slice(released[0].start)}`);

  const pkg = readFileSync(PACKAGE, "utf8");
  const bumped = pkg.replace(/^(\s*"version": ")[^"]+(",)$/m, `$1${version}$2`);
  if (bumped === pkg) die("could not find the version field in package.json");
  writeFileSync(PACKAGE, bumped);

  git("add", "CHANGELOG.md", "package.json");
  git("commit", "-m", `chore: ${tag}`);
  git("tag", "-m", tag, tag);

  console.log(`${tag} is committed and tagged. To ship it:\n`);
  console.log("  git push origin main --follow-tags");
}

function notes(tag?: string) {
  const text = readFileSync(CHANGELOG, "utf8");
  const section = readSections(text).find((entry) => /^\d/.test(entry.title));
  if (!section) die("CHANGELOG.md has no released version");

  const version = section.title.split(" ")[0];
  if (tag && tag !== `v${version}`) die(`${tag} is not the top section (${version})`);

  console.log(section.body.replace(/---\s*$/, "").trim());
}

const [command, argument] = process.argv.slice(2);

switch (command) {
  case "cut":
    if (!argument) die("usage: release.ts cut <version>");
    cut(argument);
    break;

  case "notes":
    notes(argument);
    break;

  default:
    die("usage: release.ts <cut|notes> [tag]");
}
