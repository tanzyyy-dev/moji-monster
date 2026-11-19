const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

test("serve.py uses ThreadingHTTPServer and handles concurrent requests", () => {
  const result = spawnSync(
    "python3",
    ["-m", "unittest", "tests.test_serve", "-v"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(
    result.status,
    0,
    `python unittest failed:\n${result.stdout}\n${result.stderr}`,
  );
  assert.match(result.stdout + result.stderr, /OK/);
});

test("serve.py prints Local and Network URLs", () => {
  const result = spawnSync("python3", ["-u", "serve.py", "8123"], {
    cwd: root,
    encoding: "utf8",
    timeout: 1500,
  });
  const output = (result.stdout || "") + (result.stderr || "");
  assert.match(output, /Local:\s+http:\/\/localhost:8123/);
  assert.match(output, /Network:\s+http:\/\/.+:8123/);
});
