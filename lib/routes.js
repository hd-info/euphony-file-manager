var fs = require('co-fs');
var path = require('path');
var views = require('co-views');
var origFs = require('fs');
var koaRouter = require('koa-router');
var bodyParser = require('koa-bodyparser');
var formParser = require('co-multiparty');
var proc = require('child_process');

var Tools = require('./tools');
var FilePath = require('./fileMap').filePath;
var FileManager = require('./fileManager');

var router = new koaRouter();
var render = views(path.join(__dirname, './views'), {map: {html: 'ejs'}});

var index = require('./index');
var GLOBAL_JOBS;

router.get('/', function *() {
  this.redirect('files');
});

router.get('/files', function *() {
  this.body = yield render('files', {jobs: GLOBAL_JOBS});
});

router.get('/api/(.*)', Tools.loadRealPath, Tools.checkPathExists, function *() {
  var p = this.request.fPath;
  var stats = yield fs.stat(p);
  if (stats.isDirectory()) {
    this.body = yield * FileManager.list(p);
  }
  else {
    // this.body = yield fs.createReadStream(p);
    this.body = origFs.createReadStream(p);
  }
});

router.post('/umount/(.*)', Tools.loadRealPath, Tools.checkPathExists, function *() {
	  var p = this.request.fPath;
	  p = p.substring(0, p.length-1);
	  var mounted;
	  try {	  
	      mounted = proc.execSync('mount | grep " '+p+' "').toString('utf8');
	  } catch (error) {
		  this.body = error.message;
	  }
	  if(mounted) {
		  var usbDevice;
		  try {	  
			  usbDevice = proc.execSync('lsblk -J -o KNAME,LABEL,VENDOR,MODEL,SIZE,TYPE,MOUNTPOINT,TRAN | grep "'+p+'"').toString('utf8');
		  } catch (error) {
		  }
		  var result = proc.execSync('umount "'+p+'"').toString('utf8');
		  if(usbDevice) {
			  if(!result) {
				  result = "Umount completed. Device is unlinked and can be safely removed";
			  }
		  } else {
			  result = "Umount completed. Device will be re-linked upon reboot. If you wan't to remove it permanently go to euphony Settings.";
		  } 
		  this.body = result;
		  
	  } else {
		  this.body = "There is no device mounted at this path: "+p;
	  }
});

router.get('/info/(.*)', Tools.loadRealPath, Tools.checkPathExists, function *() {
  var p = this.request.fPath;
  var stats = yield fs.stat(p);
  if (stats.isDirectory()) {
	  var countFiles = Number(proc.execSync('find "'+p+'" | wc -l').toString('ascii'))-1;
	  var sizeOutput = proc.execFileSync('du', ['-s', '-h', p]).toString('utf8');
	  p = p.substring(0, p.length-1);
	  var result = {
			    name: p,
			    size: sizeOutput.split(/\t/)[0],
			    count: countFiles,
				mtime: stats.mtime.getTime()
			  }; 
	  var mounted;
	  try {	  
	      mounted = proc.execSync('mount | grep " '+p+' "').toString('utf8');
	  } catch (error) {
	  }
	  if(mounted) {
		  var usbDevice;
		  try {	  
			  usbDevice = proc.execSync('lsblk -J -o KNAME,LABEL,VENDOR,MODEL,SIZE,TYPE,MOUNTPOINT,TRAN | grep "'+p+'"').toString('utf8').trim();
		  } catch (error) {
		  }
		  if(usbDevice) {
			  var lastChar = usbDevice.substr(usbDevice.length - 1);
			  if(lastChar === ',')
				  usbDevice = usbDevice.substring(0, usbDevice.length-1);
			  var devjson = JSON.parse(usbDevice);
			  result.type=devjson.type;
			  result.dev = devjson.kname;
			  result.label = devjson.label;
			  if(result.type === 'part') {
				  result.type = 'partition';
				  result.partsize = devjson.size;
				  var dev = result.dev.substring(0, 3); 
				  usbDevice = proc.execSync('lsblk -J -o KNAME,LABEL,VENDOR,MODEL,SIZE,TYPE,MOUNTPOINT,TRAN | grep '+dev+' | grep disk').toString('utf8').trim();
				  lastChar = usbDevice.substr(usbDevice.length - 1);
				  if(lastChar === ',')
					  usbDevice = usbDevice.substring(0, usbDevice.length-1);
				  devjson = JSON.parse(usbDevice);
			  } 
			  result.devsize = devjson.size;
			  result.vendor = devjson.vendor;
			  result.model = devjson.model;
			  result.usb = devjson.tran;
		  } else {
			  result.networkpath = mounted.substring(0, mounted.indexOf(" on"));
			  result.sharetype = mounted.substring(mounted.indexOf("type")+5, mounted.indexOf(" ("));
		  }
		  var mount_opts = mounted.substring(mounted.indexOf(" (")+2, mounted.indexOf(")")).split(',');
		  result.rw = mount_opts[0]==='rw'?'Read/Write':'Read only';  
	  }

	  this.body = JSON.stringify(result); 
  }
});

router.get('/api2/(.*)', Tools.loadRealPath, Tools.checkPathExists, function *() {
	var p = this.request.fPath;
	var stats = yield fs.stat(p);
	if (stats.isDirectory()) {
	   this.body = yield * FileManager.listDirs(p);
	}
});

router.del('/api/(.*)', Tools.loadRealPath, Tools.checkPathExists, function *() {
/*
  var p = this.request.fPath;
  yield * FileManager.remove(p);
  this.body = 'Delete Succeed!';
  */
});

router.put('/api/(.*)', Tools.loadRealPath, Tools.checkPathExists, bodyParser(), function* () {
  var type = this.query.type;
  var p = this.request.fPath;

  try {
  
  var errors = "";  
  if (!type) {
    this.status = 400;
    this.body = 'Lack Arg Type'
  }
  else if (type === 'DELETE') {
	    var src = this.request.body.src;
	    if (!src || ! (src instanceof Array)) return this.status = 400;
	    var src = src.map(function (relPath) {
	      return FilePath(relPath);
	    });
		  for (var i=0; i<src.length; ++i) {
			  (function(iter){
			  proc.execFile('rm', ['-r', src[iter]], (error, stdout, stderr) => {
				  if (error) {
					    index.getIOSocket().sockets.emit("message", "ERROR: "+stderr);
						  errors+=stderr+"   ";
				  } 
				  if(iter==src.length-1){
					  var er = "!";
					  if(errors.length>0)
						  er = " with errors.";
					  index.getIOSocket().sockets.emit("message", "Delete completed"+er);
					  GLOBAL_JOBS = "";
				  }
				});
			   })(i); // Capture i
		      }
		  GLOBAL_JOBS = 'Delete in progress...';
	    this.body = 'Delete in progress...';
  }
  else if (type === 'COPY') {
    var src = this.request.body.src;
    if (!src || ! (src instanceof Array)) return this.status = 400;
    var src = src.map(function (relPath) {
      return FilePath(relPath);
    });
   	var dest = p;
    var freeAtDest = Number(proc.execSync("df -k '"+dest+"' | awk '{print $4\"000\"}'| tail -1").toString());
	C.logger.info("freeAtDest: "+ freeAtDest);
    GLOBAL_JOBS = 'Copy in progress...';
    for (var i=0; i<src.length; ++i) {
		  var fileStats = yield fs.stat(src[i]);
		  var basename= "";
		  if(!fileStats.isDirectory()) {
			  var basename = path.basename(src[i]);
		  }
		  (function(iter, basename){
			  var fullDest = path.join(dest, basename);
			  var toCopy = proc.execFileSync('du', ['-b', '-s', src[iter]]).toString('utf8').split(/\t/)[0];
			  C.logger.info("to Copy: "+ toCopy);
			  if(Number(toCopy) >= freeAtDest) {
				  index.getIOSocket().sockets.emit("message", "ERROR: Not enough space available to copy: "+src[iter]);
				  errors+="ERROR: Not enough space available!";
				  if(iter==src.length-1){
					  GLOBAL_JOBS = "";
					  var er = "!";
					  if(errors.length >0)
						  er = " with errors.";
					  setTimeout(function() {index.getIOSocket().sockets.emit("message", "Copy completed"+er);}, 1000);
				  }
			  } else {
				  freeAtDest-=toCopy;
				  proc.execFile('cp', ['-r', '-n', src[iter], fullDest], (error, stdout, stderr) => {
					  if (error) {
						  index.getIOSocket().sockets.emit("message", "ERROR: "+stderr);
						  errors+=stderr+"   ";
					  } 
					  if(iter==src.length-1){
						  GLOBAL_JOBS = "";
						  var er = "!";
						  if(errors.length >0)
							  er = " with errors.";
						  setTimeout(function() {index.getIOSocket().sockets.emit("message", "Copy completed"+er);}, 1000);
					  }
				  });
			  }
		   })(i, basename); // Capture i
	  }
    this.body = 'Copy in progress...';
  }
  else if (type === 'MOVE') {
    var src = this.request.body.src;
    if (!src || ! (src instanceof Array)) return this.status = 400;
    var src = src.map(function (relPath) {
      return FilePath(relPath);
    });

   	var dest = p;
	var freeAtDest = Number(proc.execSync("df -k '"+dest+"' | awk '{print $4\"000\"}'| tail -1").toString());
	C.logger.info("freeAtDest: "+ freeAtDest);
	GLOBAL_JOBS = 'Move in progress...';
	for (var i=0; i<src.length; ++i) {
		  var fileStats = yield fs.stat(src[i]);
		  var basename= "";
		  if(!fileStats.isDirectory()) {
			  var basename = path.basename(src[i]);
		  }
		  (function(iter, basename){
			  var fullDest = path.join(dest, basename);
			  var toCopy = proc.execFileSync('du', ['-b', '-s', src[iter]]).toString('utf8').split(/\t/)[0];
			  C.logger.info("to Move: "+ toCopy);
			  if(Number(toCopy) >= freeAtDest) {
				  index.getIOSocket().sockets.emit("message", "ERROR: Not enough space available to move: "+src[iter]);
				  errors+="ERROR: Not enough space available!";
				  if(iter==src.length-1){
					  GLOBAL_JOBS = "";
					  var er = "!";
					  if(errors.length >0)
						  er = " with errors.";
					  setTimeout(function() {index.getIOSocket().sockets.emit("message", "Move completed"+er);}, 1000);
				  }
			  } else {
				  freeAtDest-=toCopy;
				  proc.execFile('mv', ['-n', src[iter], fullDest], (error, stdout, stderr) => {
					  if (error) {
						  index.getIOSocket().sockets.emit("message", "ERROR: "+stderr);
						  errors+=stderr+"   ";
					  } 
					  if(iter==src.length-1){
						  GLOBAL_JOBS = "";
						  var er = "!";
						  if(errors.length >0)
							  er = " with errors.";
						  setTimeout(function() {index.getIOSocket().sockets.emit("message", "Move completed"+er);}, 1000);
					  }
				  });
			  }
		   })(i, basename); // Capture i
	}
    this.body = 'Move in progress...';
  }
  else if (type === 'RENAME') {
    var target = this.request.body.target;
    if (!target) return this.status = 400;
    yield * FileManager.rename(p, FilePath(target));
    this.body = 'Rename completed!';
  }
  else {
    this.status = 400;
    this.body = 'Arg Type Error!';
  }
  } catch (error) {
	  this.status = 400;  
	  this.body = error.message;
	  console.error(error);
  }
  
});

router.post('/api/(.*)', Tools.loadRealPath, Tools.checkPathNotExists, function *() {
  var type = this.query.type;
  var p = this.request.fPath;
  try {
  if (!type) {
    this.status = 400;
    this.body = 'Lack Arg Type!';
  }
  else if (type === 'CREATE_FOLDER') {
    yield * FileManager.mkdirs(p);
    this.body = 'Create folder completed!';
  }
  else if (type === 'UPLOAD_FILE') {
/*
 * var form = new multiparty.Form();
 * 
 * form.parse(this.req, function(err, fields, files) { var writeStream =
 * origFs.createWriteStream(p); files.upload[0].pipe(writeStream); this.body =
 * 'Upload File Succeed!'; });
 * 
 */

  var formData = yield formParser.parse(this.req); 
  if (formData.files[0]){
	  console.log(formData.files[0].path);
	console.log(p);
	proc.spawn('mv', [formData.files[0].path, p]);
	 this.body = 'Upload file completed!'; 
   } else { 
   this.status = 400; 
   this.body =  'No Upload File!'; 
   }
 
  }
  else {
    this.status = 400;
    this.body = 'Arg Type Error!';
  }
  
  } catch (error) {
	  this.status = 400;  
	  this.body = error.message;
  }

  
});

module.exports = router.middleware();