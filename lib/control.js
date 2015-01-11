'use strict';

var uuid = require('node-uuid');
var path = require('path');
var fs = require('fs-extra');
var mkdirp = require('mkdirp');
var shell = require('shelljs');
var configGenerator = require('./config_generator');

exports.start = function(config) {
  // the nginx config and log files will go to a temporary location
  // that needs to be unique. The tmpDir should be made available to the
  // caller for inspection of logs etc.
  var tmpDir = path.join('/tmp/proxrox', uuid.v4());
  mkdirp.sync(tmpDir);

  // create the config and write it to the previously generated dir
  var configPath = path.join(tmpDir, 'nginx.conf');
  var nginxConf = configGenerator.generate(config);
  fs.writeFileSync(configPath, nginxConf);

  // we need to ensure that the log directory is existing
  var logDir;
  if (isRelative(config.logDir)) {
    logDir = path.join(tmpDir, config.logDir);
  } else {
    logDir = config.logDir;
  }
  mkdirp.sync(logDir);

  // the mime types are referenced by the nginx config and need to be located
  // on the relative nginx path (which is the tmpDir).
  fs.copySync(
    path.join(__dirname, 'mime.types'),
    path.join(tmpDir, 'mime.types')
  );

  var code = shell.exec('nginx -c ' + configPath + ' -p ' + tmpDir).code;
  if (code !== 0) {
    throw new Error('Failed to start the server');
  }

  var pidFile = path.join(logDir, 'nginx.pid');
  var pid = parseInt(fs.readFileSync(pidFile, {encoding: 'utf8'}).trim());
  return {
    path: tmpDir,
    pid: pid
  };
};


exports.stop = function() {
  return shell.exec('pkill -f "nginx: master process"').code === 0;
};

function isRelative(p) {
  var normal = path.normalize(p);
  var absolute = path.resolve(p);
  return normal !== absolute;
}