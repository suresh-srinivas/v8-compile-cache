'use strict';

const path = require('path');
const os = require('os');

const FileSystemBlobStore = require('./FileSystemBlobStore');
const NativeCompileCache = require('./native-compile-cache');

const cacheDir = path.join(os.tmpdir(), 'v8-compile-cache');
const blobStore = FileSystemBlobStore.load(cacheDir);

NativeCompileCache.setCacheStore(blobStore)
NativeCompileCache.setV8Version(process.versions.v8)
NativeCompileCache.install()

process.on('exit', (code) => {
  blobStore.save();
});