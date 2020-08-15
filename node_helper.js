var NodeHelper = require("node_helper");

module.exports = NodeHelper.create({

	init(){
		console.log("init module helper: MMM-MieleAtHome");
	},

	start() {
		console.log('Starting module helper: ' + this.name);		
	},

	stop(){
		console.log('Stopping module helper: ' + this.name);
	},

	// handle messages from our module// each notification indicates a different messages
	// payload is a data structure that is different per message.. up to you to design this
	socketNotificationReceived(notification, payload) {
		console.log(this.name + " received a socket notification: " + notification + " - Payload: " + payload);

		switch(notification){
			case "CONFIG":
				// save payload config info
				this.config=payload

				setConfig(payload);
				createMieleAtHome(payload);

				this.sendSocketNotification("STARTUP", "<span class='logo'><span>Geräte werden geladen...</span></span>");

				// wait 0 milliseconds, send a message back to module
				//setTimeout(()=> { this.sendSocketNotification("message_from_helper",test)}, 0)
				break;

			case "UPDATEREQUEST":
				getUpdatedHTML(this);

				//this.sendSocketNotification("MMM-MieleAtHome_Update", html);					
				break;

			case "HTML":
				console.log(this.name + " HTML changed to: " + payload);
				break;
		}
	},
});

var mieleathome = require('./utilities/mieleathome.js');
const { wrap } = require("lodash");
var tokenAvailable = false;
var _config;

function setConfig(config){
	_config = config;
}

function createMieleAtHome(config) {
	if(!!config){
			if (config.userName != "" && 
			config.password != "" && 
			config.client_ID != "" && 
			config.client_Secret != "" ){

			mieleathome = new mieleathome(config);
			
			mieleathome.ReadToken(function waitForToken() {
				tokenAvailable = true;
			});
		}
	}
}

function getUpdatedHTML(self) {
	updateMieleInfos(function waitForHTML(html) {
		self.sendSocketNotification("MMM-MieleAtHome_Update", html);
	});	
}

var deviceData;

function updateMieleInfos(callback) {
	var err;
	//https://wordtohtml.net/
	var wrapper = "";

	if(tokenAvailable){
		mieleathome.NGetDevices(function returnedDevices(err, data) {
			deviceData = data;		

			//Get All necessarc Device Infos
			var devices = getDeviceInfos(deviceData);

			devices.forEach(function (device) {
				var isIgnoreDevice = false;
				_config.ignoreDevices.forEach(function (itemOnIgnoreList) {
					if(device.deviceID == itemOnIgnoreList){
						isIgnoreDevice = true;						
					}
				});

				if(!isIgnoreDevice){
					wrapper = generateDeviceContainerHTML(wrapper, device);
				}
				
			});

			//If there is no device then tell it
			if(wrapper == ""){
				wrapper = "<span class='logo'><span>Kein aktives Gerät</span></span>";
			}

			callback(wrapper);

			//Devices += key + " -> " + deviceData[key] + "\n"
			//console.log(key + " -> " + deviceData[key]);			
		});
	}
	else{
		return "Token missing...";
	}
}

function generateDeviceContainerHTML(wrapper, device){

	//Check if Device should be ignored

	var IsSkipDevice = false;
	if(_config.showAlwaysAllDevices == false && device.StatusID == 1){

		IsSkipDevice = true;

		if(_config.showDeviceIfDoorIsOpen && device.DoorOpen){
			IsSkipDevice = false;
		}

		if(_config.showDeviceIfFailure && device.Failure){
			IsSkipDevice = false;
		}
				
		if(_config.showDeviceIfInfoIsAvailable && device.Failure){
			IsSkipDevice = false;
		}
	}

	if(!IsSkipDevice){
		var StatusString = device.Status;

		if(device.ProgramID != "") { StatusString += " | " + device.ProgramID; }

		if(device.ProgramPhase != "") { StatusString += " | " + device.ProgramPhase; }

		if(device.DoorOpen){ StatusString += " - Tür geöffnet"; }

		if(device.Light > 0){ StatusString += " - device.Light"; }

		var Image;

		switch(device.TypeNumber){
			case 18:
				Image = "Icon_018.png";
			break;

			case 21:
				Image = "Icon_021.png";
			break;

			case 27:
				Image = "Icon_027.png";
			break;

			case 31:
				Image = "Icon_031.png";
			break;

			default:
				Image = "Icon_000.png";
			break;
		}

		var DeviceName = device.Name;
		if(_config.useIndividualNames && device.TypeNumber){
			DeviceName = device.NameManual;
		}

		var container = "<div class='deviceContainer'>"
							+"<img src='/modules/MMM-MieleAtHome/Icons/" + Image + "' />"
							+"<div>"
							+"<div>"
								+"<span Class='deviceName'>" + DeviceName + "</span>"
							+"</div>"
							+"<div>"
								+"<span Class='deviceStatus'>${Status}</span>"
							+"</div>";

		//Add Timebar if there is remaining Time
		if(device.RemainingTime_Hours != 0 | device.RemainingTime_Minutes != 0){
			var StartTime = device.StartTime_Hours * 60 + device.StartTime_Minutes;
			var RemainingTime = device.RemainingTime_Hours * 60 + device.RemainingTime_Minutes;
			var ElapsedTime = device.ElapsedTime_Hours * 60 + device.ElapsedTime_Minutes;

			var ProgressBarLength = 250; //Progressbarlength from CSS
			var TimeBar = Math.round((ElapsedTime / (RemainingTime + ElapsedTime)) * 100);

			if(TimeBar > 100){ TimeBar = 100; }

			StatusString += " - fertig in " + (device.RemainingTime_Hours + device.StartTime_Hours).pad() + ":" + (device.RemainingTime_Minutes + device.StartTime_Minutes).pad() + "h";

			container+="<div>"
				+"<div Class='deviceProgress_Base'>"
					+"<div Class='deviceProgress' style='width:" + TimeBar + "%'></div>"
				+"</div>"
			+"</div>"
		}

		container+="</div>"
				 +"</div>";


		container = container.replace("${Status}", StatusString);

		if(wrapper == ""){
			wrapper=container;
		}
		else{
			wrapper+=container;
		}
	}

	return wrapper;

}

Number.prototype.pad = function(size) {
    var s = String(this);
    while (s.length < (size || 2)) {s = "0" + s;}
    return s;
}

function getDeviceInfos(data) {
	var devices = [];

	for(var deviceID in data){
		var deviceInfos = data[deviceID]

		var device = new Object();
		device.deviceID = deviceID;

		for(var deviceInfo in deviceInfos){
			switch(deviceInfo){
				case "ident":
					var deviceIdentifications = deviceInfos[deviceInfo]

					for(var deviceDetail in deviceIdentifications){
						switch(deviceDetail){
							case "type":
								var typeInformation = deviceIdentifications[deviceDetail]

								for(var typeDetail in typeInformation){
									switch(typeDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.Name = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "deviceName":
								device.NameManual = deviceIdentifications[deviceDetail];
							break;
						}
					}
				break;

				case "state":
					var deviceStatus = deviceInfos[deviceInfo]
					
					for(var deviceStat in deviceStatus){
						switch(deviceStat){							
							case "status":
								var statusInformation = deviceStatus[deviceStat]

								for(var statusDetail in statusInformation){
									switch(statusDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											device.StatusID = statusInformation[statusDetail];
											//device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.Status = statusInformation[statusDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "ProgramID":
								var statusInformation = deviceStatus[deviceStat]

								for(var statusDetail in statusInformation){
									switch(statusDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											//device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.ProgramID = statusInformation[statusDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "programType":
								var statusInformation = deviceStatus[deviceStat]

								for(var statusDetail in statusInformation){
									switch(statusDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											//device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.ProgramType = statusInformation[statusDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "programPhase":
								var statusInformation = deviceStatus[deviceStat]

								for(var statusDetail in statusInformation){
									switch(statusDetail){
										case "key_localized":
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_raw":
											//device.TypeNumber = typeInformation[typeDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
										case "value_localized":
											device.ProgramPhase = statusInformation[statusDetail];
											//console.log(typeDetail + ": " + typeInformation[typeDetail]);
											break;
									}
								}
							break;

							case "remainingTime":
								var statusInformation = deviceStatus[deviceStat]

								device.RemainingTime_Hours = statusInformation[0];
								device.RemainingTime_Minutes = statusInformation[1];
							break;

							case "startTime":
								var statusInformation = deviceStatus[deviceStat]

								device.StartTime_Hours = statusInformation[0];
								device.StartTime_Minutes = statusInformation[1];
							break;

							case "elapsedTime":
								var statusInformation = deviceStatus[deviceStat]

								device.ElapsedTime_Hours = statusInformation[0];
								device.ElapsedTime_Minutes = statusInformation[1];
							break;

							case "signalDoor":
								device.DoorOpen = deviceStatus[deviceStat];
							break;

							case "signalFailure":
								device.Failure = deviceStatus[deviceStat];
							break;

							case "signalInfo":
								device.InfoAvailable = deviceStatus[deviceStat];
							break;

							case "light":
								device.Light = deviceStatus[deviceStat];
							break;
						}
					}
				break;
			}			
		}

		devices.push(device);
	}

	return devices;
}