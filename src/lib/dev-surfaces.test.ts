// The switch itself (SAK-445). Two rules and no third: the variable says yes,
// or this is not a production build. Everything else about the dev surfaces
// hangs off this one answer, so both rules and both of their falses are held
// here rather than inferred from a page test.

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { devSurfacesOn } from "./dev-surfaces.ts";

const env = process.env as Record<string, string | undefined>;
const SAVED_SWITCH = env.SAKU_DEV_SURFACES;
const SAVED_NODE_ENV = env.NODE_ENV;

const restore = (key: string, was: string | undefined) => {
  if (was === undefined) delete env[key];
  else env[key] = was;
};

beforeEach(() => {
  delete env.SAKU_DEV_SURFACES;
});

afterEach(() => {
  restore("SAKU_DEV_SURFACES", SAVED_SWITCH);
  restore("NODE_ENV", SAVED_NODE_ENV);
});

test("a production server with nothing set: off", () => {
  env.NODE_ENV = "production";
  assert.equal(devSurfacesOn(), false);
});

test("a production build told to serve them (the e2e suite): on", () => {
  env.NODE_ENV = "production";
  env.SAKU_DEV_SURFACES = "1";
  assert.equal(devSurfacesOn(), true);
});

test("local development, with nothing set: on", () => {
  env.NODE_ENV = "development";
  assert.equal(devSurfacesOn(), true);
});

test("only the exact 1 counts, so a stray value cannot turn them on in production", () => {
  env.NODE_ENV = "production";
  for (const value of ["", "0", "true", "yes", "2"]) {
    env.SAKU_DEV_SURFACES = value;
    assert.equal(devSurfacesOn(), false, `SAKU_DEV_SURFACES=${JSON.stringify(value)} should not open the dev surfaces`);
  }
});
