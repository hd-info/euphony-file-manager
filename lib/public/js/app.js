var FMApp = angular.module('FMApp', [ 'ur.file','angular-loading-bar' ]).config(['cfpLoadingBarProvider', function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
}])

FMApp.controller('OrderByController', function($scope) {
	$scope.predicate = 'name';
	$scope.reverse = false;
	$scope.order = function(predicate) {
		$scope.reverse = ($scope.predicate === predicate) ? !$scope.reverse : false;
		$scope.predicate = predicate;
	};
});

FMApp.controller('FileManagerCtr', [ '$scope', '$http', '$location', function($scope, $http, $location) {
	var FM = this;
	FM.curHashPath = '#/'; // hash in browser url
	FM.curFolderPath = '/'; // current relative folder path
	FM.curBreadCrumbPaths = []; // items in breadcrumb list, for each level
	// folder
	FM.curFiles = []; // files in current folder

	FM.selecteAll = false; // if select all files
	FM.selection = []; // selected files
	FM.renameName = ''; // new name for rename action
	FM.uploadFile = null; // will upload file
	FM.newFolderName = '';
	FM.successData = '__init__';
	FM.inprogressData = '__init__';
	FM.errorData = '__init__';
	FM.folders4Choose = [];
	FM.folders4ChooseFlag = false;
	FM.folderSelection = null;
	FM.curFolderBreadCrumbPaths = [];
	FM.copymoveFlag = 'Copy';
	FM.folderInfo = {};
	FM.copymoveTarget = "/Music";

	var socket = io.connect();
	socket.on('connect', function() {
		console.log('Websocket connected to server.');
	});
	socket.on('message', function(data) {
		console.log('Received data:', data);
		if(data.indexOf("ERROR") == 0) {
			FM.errorData = data;
			$scope.$apply();
		} else {
			FM.successData = data;
			$scope.$apply();
			handleHashChange(FM.curHashPath);
			setFolders(FM.copymoveTarget);
			setTimeout(function() {
				FM.successData = "__init__";
				$scope.$apply();
				$('#successAlert').hide();
			}, 2000);
		}
	});
	socket.on('disconnect', function() {
		console.log('Disconnected from server.');
	});
	
	var hash2paths = function(relPath) {
		var paths = [];
		var names = relPath.split('/');
		var path = '#/';
		paths.push({
			name : 'Home',
			path : path
		});
		for ( var i = 0; i < names.length; ++i) {
			var name = names[i];
			if (name) {
				path = path + name + '/';
				paths.push({
					name : name,
					path : path
				});
			}
		}
		return paths;
	};

	var folder2paths = function(relPath) {
		var paths = [];
		var names = relPath.split('/');
		var path = '/';
		paths.push({
			name : 'Home',
			relPath : path
		});
		for ( var i = 0; i < names.length; ++i) {
			var name = names[i];
			if (name) {
				path = path + name + '/';
				paths.push({
					name : name,
					relPath : path
				});
			}
		}
		return paths;
	};

	var humanSize = function(size) {
		var hz;
		if (size < 1024)
			hz = size + ' B';
		else if (size < 1024 * 1024)
			hz = (size / 1024).toFixed(2) + ' KB';
		else if (size < 1024 * 1024 * 1024)
			hz = (size / 1024 / 1024).toFixed(2) + ' MB';
		else
			hz = (size / 1024 / 1024 / 1024).toFixed(2) + ' GB';
		return hz;
	};

	var setCurFiles = function(relPath) {
		FM.curFiles = [];
		FM.inprogressData = "Reading contents of: "+relPath;
		$http.get('api' + relPath).success(function(data) {
			var files = [];
			data.forEach(function(file) {
				if (file.name.indexOf(".") != 0) {

					file.relPath = relPath + file.name;
					if (file.folder) 
						file.relPath += '/';
					else
						file.humanSize = humanSize(file.size);
					file.selected = false;
					files.push(file);
				}
			});
			FM.curFiles = files;
			$('#inprogressAlert').hide();
			FM.inprogressData = '__init__';
		}).error(function(data, status) {
			alert('Error: ' + status + " : " + data);
		});
	};

	var setFolders = function(relPath) {
		FM.curFolderBreadCrumbPaths = folder2paths(unescape(relPath));
		FM.copymoveTarget = relPath;
		$http.get('api2' + relPath).success(function(data) {
			var folders = [];
			data.forEach(function(file) {
				if (file.name !== '.cover-art-cache') {
					file.relPath = relPath + file.name;
					file.selected = false;
					file.relPath += '/';
					folders.push(file);
				}
			});
			FM.folders4Choose = folders;
			FM.folders4ChooseFlag = true;
		}).error(function(data, status) {
			alert('Error: ' + status + data);
		});
	};

	var handleHashChange = function(hash) {
		if (!hash) {
			return $location.path('/');
		}
		console.log('Hash change: ' + hash);
		var relPath = hash.slice(1);
		FM.curHashPath = hash;
		FM.curFolderPath = unescape(relPath);
		FM.curBreadCrumbPaths = hash2paths(unescape(relPath));
		setCurFiles(relPath);
		if (!FM.folders4ChooseFlag) {
			setFolders("/Music");
		}
	};

	$scope.$watch(function() {
		return location.hash;
	}, function(val) {
		handleHashChange(val);
	});

	// listening on file checkbox
	$scope.$watch('FM.curFiles|filter:{selected:true}', function(nv) {
		FM.selection = nv.map(function(file) {
			return file;
		});
	}, true);

	$scope.$watch('FM.selectAll', function(nv) {
		FM.curFiles.forEach(function(file) {
			file.selected = nv;
		});
	});

	$scope.$watch('FM.successData', function() {
		console.log('FM.successData changed: '+FM.successData);
		if (FM.successData === '__init__')
			return;
		$('#inprogressAlert').hide();
		$('#successAlert').show();
		checkSpinner(FM.successData);
		FM.inprogressData = '__init__';
	});

	$scope.$watch('FM.inprogressData', function() {
		if (FM.inprogressData === '__init__')
			return;
		$('#inprogressAlert').show();
	});

	$scope.$watch('FM.errorData', function() {
		if (FM.errorData === '__init__')
			return;
		$('#inprogressAlert').hide();
		$('#errorAlert').show();
		FM.inprogressData = '__init__';
	});

	var httpRequest = function(method, url, params, data, config) {
		FM.successData = '__init__';

		FM.inprogressData = (params ? params.type : method) + " in progress...";
		var conf = {
			method : method,
			url : url,
			params : params,
			data : data,
			timeout : 3000000
		};
		for ( var k in config) {
			if (config.hasOwnProperty(k)) {
				conf[k] = config[k];
			}
		}
		console.log('request url', url);
		$http(conf).success(function(data) {
			FM.successData = data;
			checkSpinner(data);
			//handleHashChange(FM.curHashPath);
		}).error(function(data, status) {
			FM.errorData = ' ' + status + ': ' + data;
		});
	};

	var downloadFile = function(file) {
		window.open('api' + file.relPath);
	};
	
	var checkSpinner = function(msg) {
		if(msg.indexOf('in progress') != -1) {
			$('#spinner').show();
		} else if(msg.indexOf('completed') != -1) {
			$('#spinner').hide();
		}
	}

	FM.refresh = function() {
		handleHashChange(FM.curHashPath);
	}
	
	FM.copymovePrepare = function(cm)
	{
		FM.copymoveFlag = cm;
		$("#copymoveModal").modal();
	}

	FM.clickFile = function(file) {
		if (file.folder) {
			// open folder by setting url hash
			$location.path(unescape(file.relPath));
		} else {
			// download file
			// NOT downloadFile(file);
		}
	};

	FM.clickInfo = function(file) {
		FM.folderInfo = {};
		if (file.folder) {
			$("#folderInfoModal").modal();
			$http.get('info' + file.relPath).success(function(data) {
				data.name = unescape(file.relPath);
				FM.folderInfo = data;
			}).error(function(data, status) {
				alert('Error: ' + status + data);
				$("#folderInfoModal").modal('hide');
			});
			
		} else {
			// download file
			// NOT downloadFile(file);
		}
	};
	FM.umount = function() {
		$http.post('umount' + FM.folderInfo.name).success(function(data) {
			$("#folderInfoModal").modal('hide');
			FM.successData = data;
			handleHashChange(FM.curHashPath);
		}).error(function(data, status) {
			alert('Error: ' + status + data);
		});
	}

	FM.clickFolder = function(folder) {
		if (folder.relPath)
			setFolders(folder.relPath);
		else
			setFolders(folder);
	};

	FM.closeErrorAlert = function() {
		$('#errorAlert').hide();
		FM.errorData = '__init__';
	}

	FM.closeSuccessAlert = function() {
		$('#successAlert').hide();
		FM.errorData = '__init__';
	}

	FM.delConfirm = function() {
		$('#deleteConfirmationModal').modal();
	}
	
	FM.download = function() {
		for ( var i in FM.selection) {
			downloadFile(FM.selection[i]);
		}
	};

	FM.del = function() {
		var url = 'api/';
		var src = FM.selection.map(function(file) {
			return unescape(file.relPath);
		});
		httpRequest('PUT', url, {
			type : 'DELETE'
		}, {
			src : src
		});
	};

	FM.copymove = function(target) {
		if(FM.successData.indexOf('progress') != -1) {
			alert('Please wait while previous operation is finished');
			return;
		}
		var url = 'api' + target;
		var src = FM.selection.map(function(file) {
			return unescape(file.relPath);
		});
		httpRequest('PUT', url, {
			type : FM.copymoveFlag.toUpperCase()
		}, {
			src : src
		});
	}

	FM.rename = function(newName) {
		var url = 'api' + FM.selection[0].relPath;
		var target = FM.curFolderPath + newName;
		console.log('rename target', target);
		httpRequest('PUT', url, {
			type : 'RENAME'
		}, {
			target : target
		});
	};

	FM.createFolder = function(folderName) {
		var url = 'api' + FM.curFolderPath + folderName;
		httpRequest('POST', url, {
			type : 'CREATE_FOLDER'
		}, null);
	};

	FM.upload = function() {

		for ( var i = 0; i < FM.uploadFiles.length; i++) {
			console.log('Upload File:', FM.uploadFiles[i]);
			var formData = new FormData();
			formData.append('upload', FM.uploadFiles[i]);
			var url = 'api' + FM.curFolderPath + FM.uploadFiles[i].name;
			httpRequest('POST', url, {
				type : 'UPLOAD_FILE'
			}, formData, {
				transformRequest : angular.identity,
				headers : {
					'Content-Type' : undefined
				}
			});
		}
		/*
		 * console.log('Upload File:', FM.uploadFile); var formData = new
		 * FormData(); formData.append('upload', FM.uploadFile); var url = 'api' +
		 * FM.curFolderPath + FM.uploadFile.name; httpRequest('POST', url,
		 * {type: 'UPLOAD_FILE'}, formData, { transformRequest:
		 * angular.identity, headers: {'Content-Type': undefined} });
		 */
	};

	FM.btnDisabled = function(btnName) {
		switch (btnName) {
			case 'download':
				if (FM.selection.length === 0)
					return true;
				else {
					for ( var i in FM.selection) {
						if (FM.selection[i].folder)
							return true;
					}
					return false;
				}
			case 'delete':
			case 'copy':
			case 'move':
				return FM.selection.length === 0;
			case 'rename':
				return FM.selection.length !== 1;
			case 'upload_file':
			case 'create_folder':
				return false;
			default:
				return true;
		}
	}
	if(GLOBAL_JOBS)
		FM.successData = GLOBAL_JOBS;
} ]);
