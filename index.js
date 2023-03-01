const core = require("@actions/core");
const exec = require("@actions/exec");
const fs = require("fs");
const util = require("util");
const process = require("process");

const writeFile = util.promisify(fs.writeFile);
const required = { required: true };

function getValues(values) {
  if (!values) {
    return "{}";
  }
  if (typeof values === "object") {
    return JSON.stringify(values);
  }
  return values;
}

function getList(x) {
  let items = [];
  if (typeof x === "string") {
    try {
      items = JSON.parse(x);
    } catch (err) {
      // Assume it's a single string.
      items = [x];
    }
  } else {
    items = x;
  }
  if (!Array.isArray(items)) {
    return [];
  }
  return items.filter(f => !!f);
}

function getInput(name, options) {
  let val = core.getInput(name.replace("_", "-"), {
    ...options,
    required: false
  });
  if (options && options.required && !val) {
    throw new Error(`Input required and not supplied: ${name}`);
  }
  return val;
}

/**
 * Run executes the helm deployment.
 */
async function run() {
  try {
    const release = getInput("release", required);
    const namespace = getInput("namespace", required);
    const chart = getInput("chart", required);
    const version = getInput("version");
    const values = getValues(getInput("values"));
    const valueFiles = getList(getInput("value_files"));
    const timeout = getInput("timeout");
    const repo = getInput("repo");
    const repositories = getList(getInput("repositories"));
    const dryRun = core.getInput("dry-run");
    const atomic = getInput("atomic") || false;

    core.debug(`param: release = "${release}"`);
    core.debug(`param: namespace = "${namespace}"`);
    core.debug(`param: chart = "${chart}"`);
    core.debug(`param: version = "${version}"`);
    core.debug(`param: values = "${values}"`);
    core.debug(`param: dryRun = "${dryRun}"`);
    core.debug(`param: valueFiles = "${JSON.stringify(valueFiles)}"`);
    core.debug(`param: timeout = "${timeout}"`);
    core.debug(`param: repo = "${repo}"`);
    core.debug(`param: repositories = "${repositories}"`);
    core.debug(`param: atomic = "${atomic}"`);

    // Add the helm repositories listed
    for (const repo in repositories) {
      await exec.exec('helm', 'repo', 'add', repo.name, repo.url)
    }

    // Setup command options and arguments.
    const args = [
      "upgrade",
      release,
      chart,
      "--install",
      "--wait",
      `--namespace=${namespace}`,
    ];

    if (version) {
      args.push(`--version=${version}`);
    }
    if (timeout) {
      args.push(`--timeout=${timeout}`);
    }
    if (repo) {
      args.push(`--repo=${repo}`);
    }
    if (atomic === true) {
      args.push("--atomic");
    }
    valueFiles.forEach(f => args.push(`--values=${f}`));

    await writeFile("./values.yml", values);
    args.push("--values=./values.yml");

    core.debug(`env: KUBECONFIG="${process.env.KUBECONFIG}"`);

    await exec.exec('helm', args);
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  }
}

run();
