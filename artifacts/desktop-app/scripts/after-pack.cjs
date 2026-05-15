const fs = require("node:fs/promises");
const path = require("node:path");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "linux") return;

  const executableName = context.packager.platformSpecificBuildOptions.executableName ?? "local-ledger-pro";
  const executablePath = path.join(context.appOutDir, executableName);
  const realExecutablePath = path.join(context.appOutDir, `${executableName}-bin`);

  await fs.rename(executablePath, realExecutablePath);
  await fs.writeFile(
    executablePath,
    `#!/bin/sh\nexec "$(dirname "$0")/${executableName}-bin" --no-sandbox --disable-gpu "$@"\n`,
    { mode: 0o755 },
  );

  const apiNodeModulesPath = path.join(context.appOutDir, "resources", "api-server", "node_modules");
  await fs.rm(apiNodeModulesPath, { recursive: true, force: true });
  await fs.symlink("../app.asar.unpacked/node_modules", apiNodeModulesPath, "dir");

  const unpackedNodeModulesPath = path.join(
    context.appOutDir,
    "resources",
    "app.asar.unpacked",
    "node_modules",
  );

  for (const packageName of ["bindings", "file-uri-to-path"]) {
    const packageJsonPath = require.resolve(`${packageName}/package.json`, {
      paths: [context.packager.projectDir],
    });
    const source = await fs.realpath(path.dirname(packageJsonPath));
    const destination = path.join(unpackedNodeModulesPath, packageName);
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(source, destination, { recursive: true });
  }
};
