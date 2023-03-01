const core = require("@actions/core");
const github = require("@actions/github");
const exec = require("@actions/exec");
const fs = require("fs");
const util = require("util");
const Mustache = require("mustache");

const writeFile = util.promisify(fs.writeFile);
const readFile = util.promisify(fs.readFile);
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

function getValueFiles(files) {
  let fileList;
  if (typeof files === "string") {
    try {
      fileList = JSON.parse(files);
    } catch (err) {
      // Assume it's a single string.
      fileList = [files];
    }
  } else {
    fileList = files;
  }
  if (!Array.isArray(fileList)) {
    return [];
  }
  return fileList.filter(f => !!f);
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
    const context = github.context;

    const release = getInput("release", required);
    const namespace = getInput("namespace", required);
    const chart = chartName(getInput("chart", required));
    const version = getInput("version");
    const values = getValues(getInput("values"));
    const valueFiles = getValueFiles(getInput("value_files"));
    const timeout = getInput("timeout");
    const repository = getInput("repository");
    const dryRun = core.getInput("dry-run");
    const atomic = getInput("atomic") || false;

    core.debug(`param: release = "${release}"`);
    core.debug(`param: appName = "${appName}"`);
    core.debug(`param: namespace = "${namespace}"`);
    core.debug(`param: chart = "${chart}"`);
    core.debug(`param: version = "${version}"`);
    core.debug(`param: values = "${values}"`);
    core.debug(`param: dryRun = "${dryRun}"`);
    core.debug(`param: valueFiles = "${JSON.stringify(valueFiles)}"`);
    core.debug(`param: timeout = "${timeout}"`);
    core.debug(`param: repository = "${repository}"`);
    core.debug(`param: atomic = "${atomic}"`);

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
      args.push(`--version=${chartVersion}`);
    }
    if (timeout) {
      args.push(`--timeout=${timeout}`);
    }
    if (repository) {
      args.push(`--repo=${repository}`);
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
