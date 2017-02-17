/* eslint max-len: 0 */
'use strict';

const Module = require('module');
const fs = require('fs');
const path = require('path');
const tap = require('tap');
const temp = require('temp');

temp.track();

const FileSystemBlobStore_mock = require('./FileSystemBlobStore-mock');
const nativeCompileCache = require('../NativeCompileCache');

let cachedFiles;
let fakeCacheStore;

tap.beforeEach(cb => {
  fakeCacheStore = new FileSystemBlobStore_mock();
  cachedFiles = fakeCacheStore._cachedFiles;
  nativeCompileCache.setCacheStore(fakeCacheStore);
  nativeCompileCache.setV8Version('a-v8-version');
  nativeCompileCache.install();
  cb();
});

tap.afterEach(cb => {
  nativeCompileCache.restorePreviousModuleCompile();
  cb();
});

tap.test('writes and reads from the cache storage when requiring files', t => {
  let fn1 = require('./fixtures/file-1');
  const fn2 = require('./fixtures/file-2');

  t.equal(cachedFiles.length, 2);

  t.equal(cachedFiles[0].key, require.resolve('./fixtures/file-1'));
  t.type(cachedFiles[0].buffer, Uint8Array);
  t.ok(cachedFiles[0].buffer.length > 0);
  t.equal(fn1(), 1);

  t.equal(cachedFiles[1].key, require.resolve('./fixtures/file-2'));
  t.type(cachedFiles[1].buffer, Uint8Array);
  t.ok(cachedFiles[1].buffer.length > 0);
  t.equal(fn2(), 2);

  delete Module._cache[require.resolve('./fixtures/file-1')];
  fn1 = require('./fixtures/file-1');
  t.equal(cachedFiles.length, 2);
  t.equal(fn1(), 1);

  t.end();
});

tap.test('when v8 version changes it updates the cache of previously required files', t => {
  nativeCompileCache.setV8Version('version-1');
  let fn4 = require('./fixtures/file-4');

  t.equal(cachedFiles.length, 1);
  t.equal(cachedFiles[0].key, require.resolve('./fixtures/file-4'));
  t.type(cachedFiles[0].buffer, Uint8Array);
  t.ok(cachedFiles[0].buffer.length > 0);
  t.equal(fn4(), 'file-4');

  nativeCompileCache.setV8Version('version-2');
  delete Module._cache[require.resolve('./fixtures/file-4')];
  fn4 = require('./fixtures/file-4');

  t.equal(cachedFiles.length, 2);
  t.equal(cachedFiles[1].key, require.resolve('./fixtures/file-4'));
  t.notEqual(cachedFiles[1].invalidationKey, cachedFiles[0].invalidationKey);
  t.type(cachedFiles[1].buffer, Uint8Array);
  t.ok(cachedFiles[1].buffer.length > 0);

  t.end();
});

tap.test('deletes previously cached code when the cache is an invalid file', t => {
  fakeCacheStore.has = () => true;
  fakeCacheStore.get = () => new Buffer('an invalid cache');
  let deleteWasCalledWith = null;
  fakeCacheStore.delete = arg => { deleteWasCalledWith = arg; };

  const fn3 = require('./fixtures/file-3');

  t.equal(deleteWasCalledWith, require.resolve('./fixtures/file-3'));
  t.equal(fn3(), 3);

  t.end();
});

tap.test('when a previously required and cached file changes removes it from the store and re-inserts it with the new cache', t => {
  const tmpDir = temp.mkdirSync('native-compile-cache-test');
  const tmpFile = path.join(tmpDir, 'file-5.js');
  fs.writeFileSync(tmpFile, 'module.exports = () => `file-5`;');

  let fn5 = require(tmpFile);

  t.equal(cachedFiles.length, 1);
  t.equal(cachedFiles[0].key, require.resolve(tmpFile));
  t.type(cachedFiles[0].buffer, Uint8Array);
  t.ok(cachedFiles[0].buffer.length > 0);
  t.equal(fn5(), 'file-5');

  delete Module._cache[require.resolve(tmpFile)];
  fs.appendFileSync(tmpFile, '\n\n');
  fn5 = require(tmpFile);

  t.equal(cachedFiles.length, 2);
  t.equal(cachedFiles[1].key, require.resolve(tmpFile));
  t.notEqual(cachedFiles[1].invalidationKey, cachedFiles[0].invalidationKey);
  t.type(cachedFiles[1].buffer, Uint8Array);
  t.ok(cachedFiles[1].buffer.length > 0);

  t.end();
});