var fs = require('co-fs');
var co = require('co');
var fse = require('co-fs-extra');
//var fse = require('fs-extra');
var path = require('path');

var proc = require('child_process');

var FileManager = {};

var humanTime = function(t) {
	return t.getHours()+":"+(t.getMinutes()<10?'0'+t.getMinutes():t.getMinutes());
};

var humanDate = function(t) {
	return t.getFullYear()+"-"+(t.getMonth()+1)+"-"+t.getDate();
};

FileManager.getStats = function *(p) {
  try {	
	  var stats = yield fs.stat(p);
	  var mtime = stats.mtime.getTime();
	  return {
		  folder: stats.isDirectory(),
		  size: stats.size,
		  humanTime: humanTime(stats.mtime),
		  humanDate:  humanDate(stats.mtime),
		  mtime:stats.mtime.getTime() 
	  }
  } catch(error) {
	  var stats = yield fs.lstat(p);
	  var mtime = stats.mtime.getTime();
	  return {
		  folder: stats.isDirectory(),
		  size: stats.size,
		  humanTime: humanTime(stats.mtime),
		  humanDate:  humanDate(stats.mtime),
		  mtime:stats.mtime.getTime() 
	  }
  }
};

FileManager.list = function *(dirPath) {
  var files = yield fs.readdir(dirPath);
  var stats = [];
  for (var i=0; i<files.length; ++i) {
    var fPath = path.join(dirPath, files[i]);
    var stat = yield FileManager.getStats(fPath);
    stat.name = files[i];
    stats.push(stat);
  }
  return stats;
};

FileManager.listDirs = function *(dirPath) {
	var files = yield fs.readdir(dirPath);
	var stats = [];
	for (var i=0; i<files.length; ++i) {
	    var fPath = path.join(dirPath, files[i]);
	    var fileStats = yield fs.stat(fPath);
	    if(!fileStats.isDirectory())
	    	continue;
	    var stat = {size: fileStats.size, mtime: fileStats.mtime.getTime(), name: files[i] };
	    stats.push(stat);
	}
    return stats;
};

FileManager.remove = function *(p) {
  yield fse.remove(p);
};

FileManager.mkdirs = function *(dirPath) {
  yield fse.mkdirs(dirPath);
};

FileManager.move = function *(srcs, dest) {
  try {
	  for (var i=0; i<srcs.length; ++i) {
		  var fileStats = yield fs.stat(srcs[i]);
		  var basename= "";
		  if(!fileStats.isDirectory()) {
			  var basename = path.basename(srcs[i]);
		  }
		  var result = proc.spawnSync('mv', [srcs[i], path.join(dest, basename)]);
		  C.logger.info("move" + srcs[i]+" "+path.join(dest, basename)+" "+ result);
		  //yield fse.move(srcs[i], path.join(dest, basename), {clobber:true});
	  }
  } catch (err) {
	 console.error(err)
  }
};

FileManager.copy = function *(srcs, dest) {
	try {
		  for (var i=0; i<srcs.length; ++i) {
			  var fileStats = yield fs.stat(srcs[i]);
			  var basename= "";
			  if(!fileStats.isDirectory()) {
				  var basename = path.basename(srcs[i]);
			  }
			  proc.spawnSync('cp', [srcs[i], path.join(dest, basename)]);
		    //yield fse.copy(srcs[i], path.join(dest, basename), {clobber:true});
			  }
	} catch (err) {
		  console.error(err)
		}
};

FileManager.rename = function *(src, dest) {
  yield fse.move(src, dest);
};
module.exports = FileManager;
