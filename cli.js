#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";

const runCommand = (command) => {
  try {
    execSync(command, { stdio: "inherit" });
  } catch (error) {
    console.error(`Failed to execute command: ${command}`);
    process.exit(1);
  }
};

const repoName = process.argv[2];

if (!repoName) {
  console.error("Please provide a name for the project.");
  process.exit(1);
}

const gitCheckoutCommand = `git clone --depth 1 https://github.com/Seventh-Triangle-Consulting/S7C_Node_App_Starter.git ${repoName}`;
const installDepsCommand = `cd ${repoName} && npm install`;
const gitInitCommand = `cd ${repoName} && git init`;

console.log("Cloning the repository with the name", repoName);
runCommand(gitCheckoutCommand);

// Remove .git folder to unlink from original repository
const gitPath = `./${repoName}/.git`;
if (fs.existsSync(gitPath)) {
  fs.rmSync(gitPath, { recursive: true, force: true });
  console.log("Removed .git folder to unlink from original repository.");
}

// Initialize new git repository
console.log("Initializing new git repository...");
runCommand(gitInitCommand);

// Delete .npmignore if it exists
const npmignorePath = `./${repoName}/.npmignore`;
if (fs.existsSync(npmignorePath)) {
  fs.unlinkSync(npmignorePath);
  console.log("Removed .npmignore from the cloned project.");
}

console.log("Installing dependencies... for the repository", repoName);
runCommand(installDepsCommand);

console.log("Installation successful for the repository", repoName);
console.log(
  "Congratulations! You are ready. Follow the following commands to start your project"
);
console.log("cd", repoName);
console.log("npm run dev");
console.log("");
console.log("To add to GitHub:");
console.log("git add .");
console.log("git commit -m 'Initial commit'");
console.log("git remote add origin <your-github-repo-url>");
console.log("git push -u origin main");
