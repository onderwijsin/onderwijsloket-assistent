const formatEnabled = process.env.DISABLE_PRE_COMMIT_FORMAT !== "true";
const lintEnabled = process.env.DISABLE_PRE_COMMIT_LINT !== "true";

/**
 * Quote staged paths before composing commands for lint-staged.
 *
 * @param {string} file - The staged file path.
 * @returns {string} A shell-safe single-quoted path.
 */
const quotePath = (file) => `'${file.replaceAll("'", "'\\''")}'`;

/**
 * Build a lint-staged command with explicit file arguments.
 *
 * @param {string} command - The command to execute.
 * @param {string[]} files - The staged files matched by the glob.
 * @returns {string} The complete command.
 */
const task = (command, files) => `${command} ${files.map(quotePath).join(" ")}`;

export default {
  /**
   * Build formatting tasks for staged data and documentation files.
   * @param files - Staged paths matched by the data and documentation glob.
   * @returns The formatting command, or no tasks when formatting is disabled.
   */
  "*.{json,jsonc,md,mdc,yaml,yml}": (files) =>
    formatEnabled ? [task("oxfmt --no-error-on-unmatched-pattern", files)] : [],
  /**
   * Build enabled formatting and lint tasks for staged source files.
   * @param files - Staged paths matched by the source glob.
   * @returns Commands for the enabled formatting and lint checks.
   */
  "*.{js,cjs,mjs,ts,cts,mts,jsx,tsx,vue}": (files) => {
    const tasks = [];

    if (formatEnabled) {
      tasks.push(task("oxfmt --no-error-on-unmatched-pattern", files));
    }

    if (lintEnabled) {
      tasks.push(task("oxlint --fix", files));
    }

    return tasks;
  }
};
