const core = require("@actions/core");
const exec = require("@actions/exec");
const fs = require("fs");
const os = require("os");
const path = require("path");
const util = require("util");
const process = require("process");
const yaml = require("js-yaml")

const writeFile = util.promisify(fs.writeFile);
const required = { required: true };

function yamlDumpAll(docs) {
  return docs.map(doc => yaml.dump(doc)).join('---\n');
}

function getList(x) {
  let items = [];
  if (typeof x === "string") {
    try {
      items = yaml.load(x);
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

async function extractCRDs(chart, version, repo) {
  const templateArgs = [
    'template',
    chart,
    '--dependency-update',
    '--include-crds',
  ];
  if (version) {
    templateArgs.push(`--version=${version}`);
  }
  if (repo) {
    templateArgs.push(`--repo=${repo}`);
  }
  let crds = [];
  const output = await exec.getExecOutput('helm', templateArgs, {silent: true});
  yaml.loadAll(output.stdout, doc => {
    if (doc && doc.kind == 'CustomResourceDefinition') {
      core.debug(`found CRD ${doc.metadata.name}`);
      crds.push(doc);
    }
  });
  return crds;
}

/**
 * Run executes the helm deployment.
 */
async function run() {
  const runnerTempDir = process.env.RUNNER_TEMP || os.tmpdir();
  let outputsDir;
  try {
    outputsDir = fs.mkdtempSync(path.join(runnerTempDir, 'helm-action-'));
    const release = getInput("release", required);
    const namespace = getInput("namespace", required);
    const chart = getInput("chart", required);
    const version = getInput("version");
    const values = getInput("values");
    const valueFiles = getList(getInput("value_files"));
    const timeout = getInput("timeout");
    const repo = getInput("repo");
    const repositories = getList(getInput("repositories"));
    const dryRun = core.getInput("dry-run");
    const atomic = getInput("atomic") || false;
    const upgradeCRDs = getInput("upgrade-crds") || false;

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
      await exec.exec('helm', ['repo', 'add', repo.name, repo.url])
    }

    // Setup command options and arguments.
    const args = [
      "upgrade",
      release,
      chart,
      "--install",
      "--wait",
      "--create-namespace",
      `--namespace=${namespace}`,
    ];

    if (version) {
      args.push(`--version=${version}`);
    }
    if (repo) {
      args.push(`--repo=${repo}`);
    }
    if (timeout) {
      args.push(`--timeout=${timeout}`);
    }
    if (atomic === true) {
      args.push("--atomic");
    }
    valueFiles.forEach(f => args.push(`--values=${f}`));

    if (values) {
      const valuesFile = `${outputsDir}/values.yml`;
      await writeFile(valuesFile, values);
      args.push("--values", valuesFile);
    }

    core.debug(`env: KUBECONFIG="${process.env.KUBECONFIG}"`);

    // Run helm template to get the full set of resources, and then filter
    // to just the CRDs.
    // Output the CRDs to a new file and then kubectl apply them.
    if (upgradeCRDs) {
      const crds = await extractCRDs(chart, version, repo);
      if (crds.length != 0) {
        const crdsFile = `${outputsDir}/crds.yml`;
        const crdsYAML = yamlDumpAll(crds);
        await writeFile(crdsFile, crdsYAML);
        // Server-side applied needed to avoid long annotations on CRDs
        await exec.exec('kubectl', ['apply', '--server-side=true', '-f', crdsFile])
      } else {
        core.debug('no CRDs to upgrade');
      }
    }

    // perform the actual helm upgrade
    await exec.exec('helm', args);
  } catch (error) {
    core.error(error);
    core.setFailed(error.message);
  } finally {
    fs.rmSync(outputsDir, {recursive: true}, )
  }
}

run();
