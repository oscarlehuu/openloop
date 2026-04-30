#!/usr/bin/env node
import { Command } from "commander";
import { OpenLoopError, toErrorMessage } from "../shared/errors.js";
import {
  authLoginCommand,
  authLogoutCommand,
  doctorCommand,
  generateIdeasCommand,
  generateImagesCommand,
  initCommand,
  newRunCommand,
  projectAddCommand,
  projectListCommand,
  projectRemoveCommand,
  renderCommand,
  resumeRunCommand,
  runCommand,
  scanCommand,
  showRunCommand,
  validateCommand,
  workflowHelp
} from "./command-handlers.js";

const program = new Command();

program.name("openloop").description("Local marketing slideshow generator").version("0.1.0");

const ADVANCED_PLATFORM_HELP =
  "output preset: portrait, tiktok, instagram-reel, instagram-story, instagram-post, square, storyboard-2-3, storyboard-16-9, app-store-iphone-6-9, app-store-iphone-6-5, app-store-ipad-13, app-store-ipad-12-9";
const PLANNER_HELP = "campaign planner: codex or local";

program.command("init").option("--force", "overwrite config").action((options) => run(() => initCommand(options.force)));

program
  .command("run:new")
  .requiredOption("--name <name>", "campaign name")
  .option("--project <path>", "target project path")
  .option("--workflow <workflow>", workflowHelp())
  .action((options) => run(() => newRunCommand(options.name, options.project, options.workflow)));

program.command("doctor").action(() => run(doctorCommand));

program
  .command("project:add")
  .requiredOption("--path <path>", "project path")
  .option("--name <name>", "display name")
  .option("--tags <tags>", "comma-separated tags")
  .action((options) => run(() => projectAddCommand(options.path, options.name, options.tags)));

program.command("project:list").action(() => run(projectListCommand));

program
  .command("project:remove")
  .argument("<idOrPath>", "project id or path")
  .action((idOrPath) => run(() => projectRemoveCommand(idOrPath)));

program
  .command("slides")
  .description("generate social slide assets")
  .requiredOption("--project <path>", "target project path")
  .option("--name <name>", "slide set name", "slides")
  .option("--planner <planner>", PLANNER_HELP, "codex")
  .action((options) => run(() => runCommand({ ...options, workflow: "social-carousel" })));

program
  .command("app-store")
  .description("generate App Store screenshot assets")
  .requiredOption("--project <path>", "target project path")
  .option("--name <name>", "screenshot set name", "app-store")
  .option("--screenshots <dir>", "directory with real app screenshots")
  .option("--planner <planner>", PLANNER_HELP, "codex")
  .action((options) => run(() => runCommand({ ...options, workflow: "app-store-screenshot" })));

program
  .command("app-ads")
  .description("generate mobile app ad storyboard assets")
  .requiredOption("--project <path>", "target project path")
  .option("--name <name>", "app ad set name", "app-ads")
  .option("--screenshots <dir>", "directory with real app screenshots")
  .option("--planner <planner>", PLANNER_HELP, "codex")
  .action((options) => run(() => runCommand({ ...options, workflow: "app-ads" })));

program
  .command("run")
  .requiredOption("--project <path>", "target project path")
  .option("--name <name>", "campaign name", "campaign")
  .option("--workflow <workflow>", workflowHelp())
  .option("--platform <platform>", ADVANCED_PLATFORM_HELP)
  .option("--aspect <ratio>", "custom output aspect ratio, for example 9:16")
  .option("--screenshots <dir>", "directory with real app screenshots for App Store workflow")
  .option("--planner <planner>", PLANNER_HELP, "codex")
  .action((options) => run(() => runCommand(options)));

program
  .command("run:resume")
  .requiredOption("--run <path>", "existing run path")
  .option("--workflow <workflow>", workflowHelp())
  .option("--platform <platform>", ADVANCED_PLATFORM_HELP)
  .option("--aspect <ratio>", "custom output aspect ratio, for example 9:16")
  .option("--force-images", "regenerate images that already exist")
  .action((options) => run(() => resumeRunCommand(options)));

program
  .command("scan")
  .requiredOption("--project <path>", "target project path")
  .option("--run <path>", "existing run path")
  .option("--name <name>", "campaign name", "campaign")
  .option("--workflow <workflow>", workflowHelp())
  .action((options) => run(() => scanCommand(options.project, options.run, options.name, options.workflow)));

program
  .command("generate:ideas")
  .requiredOption("--run <path>", "run path")
  .option("--workflow <workflow>", workflowHelp())
  .option("--planner <planner>", PLANNER_HELP, "codex")
  .action((options) => run(() => generateIdeasCommand(options.run, options)));

program
  .command("auth:login")
  .argument("<provider>", "auth provider, currently codex")
  .option("--import-codex", "import existing Codex CLI credentials into OpenLoop auth store")
  .action((provider, options) => run(() => authLoginCommand(provider, options.importCodex)));

program
  .command("auth:logout")
  .argument("[provider]", "auth provider, currently codex", "codex")
  .action((provider) => run(() => authLogoutCommand(provider)));

program
  .command("generate:images")
  .requiredOption("--run <path>", "run path")
  .option("--force", "regenerate images that already exist")
  .action((options) => run(() => generateImagesCommand(options.run, options)));

program
  .command("render")
  .requiredOption("--run <path>", "run path")
  .option("--platform <platform>", ADVANCED_PLATFORM_HELP)
  .option("--aspect <ratio>", "custom output aspect ratio, for example 9:16")
  .action((options) => run(() => renderCommand(options.run, options)));

program
  .command("validate")
  .requiredOption("--run <path>", "run path")
  .action((options) => run(() => validateCommand(options.run)));

program
  .command("run:show")
  .requiredOption("--run <path>", "run path")
  .action((options) => run(() => showRunCommand(options.run)));

program.parseAsync(process.argv);

async function run(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof OpenLoopError) {
      console.error(`error: ${error.message}`);
      if (error.hint) console.error(`hint: ${error.hint}`);
    } else {
      console.error(`error: ${toErrorMessage(error)}`);
    }
    process.exitCode = 1;
  }
}
