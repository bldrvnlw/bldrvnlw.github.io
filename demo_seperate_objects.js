/*jslint plusplus: true */
/*jslint todo: true */
/*jslint bitwise: true*/

// This code was created by standing on the shoulders of giants, 
// falling off at regular intervals, and then slowly clambering my way back up. :-)
// All credit goes to them, the mistakes are all my own.
// B. van Lew Feb 2015.

// TODO split class definitions into separate files
// TODO reduce number of globals
// 



var atlasTable = null;

// Model
var ontologyData = null;

var voxelData = null;

var tsneMap = null;

var activeAnnotations = [];
var activeAnnotationsColor = [];

var annotationsOn = {};

var multiView = null;

var selectTable = null;

var ControlValues = function () {
	'use strict';
	this.selectionRadius = 0.4;
};

var selectionGui;

var selectionValues;

var displayBrain = false;

var tsneRenderer = false;

var mapTree = null;

//<Class definition for the BrainRenderer>
// BrainRenderer uses the XTK 3D renderer to render a set of labeled
// points in three dimensions. This rendering can be used to locate 
// physical position of the selected tSNE map points. 
function BrainRenderer() {
	// The constructor loads the JSON data for the (mouse) brain
	// the path for the data could be passed as an argument
	'use strict';
	var self = this,
		json_data,
		i = 0;
	$.getJSON("coords.json", function (data) {
		self.brainCoords = data.coords;
		self.brainRenderer = new X.renderer3D();
		// TODO pass container location as parameter to constructor.
		self.brainRenderer.container = document.getElementById("BrainLocator");
		self.brainRenderer.init();
		self.colors = voxelData.voxel_props.colors;
		self.brainObject = new X.object();
		self.brainObject.pointsize = 6;
		self.brainObject.type = 'POINTS';
		self.brainObject.points = new X.triplets(self.brainCoords.length * 3);
		self.brainObject.normals = new X.triplets(self.brainCoords.length * 3);
		self.brainObject.colors = new X.triplets(self.brainCoords.length * 3);
		var cx = 0,
			cy = 0,
			cz = 0,
			vector = new X.vector(0, 0, 0);
		for (i = 0; i < self.brainCoords.length; i++) {
			cx += self.brainCoords[i][0];
			cy += self.brainCoords[i][1];
			cy += self.brainCoords[i][2];
		}
		cx = cx / self.brainCoords.length;
		cy = cy / self.brainCoords.length;
		cz = cz / self.brainCoords.length;
		self.brainCentroid = [cx, cy, cz];
		for (i = 0; i < self.brainCoords.length; i++) {
			var point = self.brainCoords[i],
				centeredPoint = [point[0] - cx, point[1] - cy, point[2] - cz],
				color = self.colors[i],
				red = ((color >> 16) & 0xFF) / 0xFF,
				green = ((color >> 8) & 0xFF) / 0xFF,
				blue = (color & 0xFF) / 0xFF;
			// unit normals pointing from center (gives 3d lighting effect)
			self.brainObject.normals.add(centeredPoint[0], centeredPoint[1], centeredPoint[2]);
			self.brainObject.points.add(centeredPoint[0], centeredPoint[1], centeredPoint[2]);
			self.brainObject.colors.add(red, green, blue);
		}
		self.brainObject.opacity = 1;
		self.brainObject.modified();
		self.brainRenderer.add(self.brainObject);
		self.brainCubes = []; // will store a stack of array of cubes for undo
		self.brainRenderer.render();
	});
}

BrainRenderer.prototype.selectInBrainAtlas = function (indexes) {
	'use strict';
	var i = 0,
		newCubes = [];
	// remove option
	if (indexes.length === 0) {
		return;
	}
	for (i = 0; i < indexes.length; i++) {
		var newCube = new X.cube();
		var point = this.brainCoords[indexes[i]];
		newCube.center = [point[0] - this.brainCentroid[0], point[1] - this.brainCentroid[1], point[2] - this.brainCentroid[2]];
		newCube.lengthX = newCube.lengthY = newCube.lengthZ = 0.2;
		newCube.color = [1, 1, 1];
		newCube.opacity = 1;
		this.brainRenderer.add(newCube);
		newCubes.push(newCube);
	}
	this.brainCubes.push(newCubes);
	this.brainObject.opacity = 0.2;
	this.brainObject.modified();
};

BrainRenderer.prototype.undoSelectInBrainAtlas = function() {
	'use strict';
	var cubes = this.brainCubes.pop(),
		i = 0;
	if (!cubes) {
		return;
	}
	for (i=0; i<cubes.length; i++) {
		this.brainRenderer.remove(cubes[i]);
	}
	this.brainObject.modified();	
};

BrainRenderer.prototype.clearSelectInBrainAtlas = function() {
	'use strict';
	var allBrainCubes = [].concat.apply([],this.brainCubes);
	for (var i=0; i<allBrainCubes.length; i++) {
		this.brainRenderer.remove(allBrainCubes[i]);
	}
	allBrainCubes = [];
	this.brainCubes = [];
	this.brainObject.opacity = 1;
	this.brainObject.modified();	
};
//</Class definition for the BrainRenderer>

var brainRenderer = null; 

// Some polyfill for findIndex see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/findIndex#Browser_compatibility
if (!Array.prototype.findIndex) {
  Array.prototype.findIndex = function(predicate) {
    if (this === null) {
      throw new TypeError('Array.prototype.findIndex called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return i;
      }
    }
    return -1;
  };
}

// code from http://forum.webix.com/discussion/978/how-to-get-multiline-text-in-cells-in-datatable
webix.extend(webix.ui.datatable,
	{myAdjustRowHeight:function(id, silent, rId){
		function processRow(that,obj){
			var h =  [that.config.rowHeight], config;
			for(var i=0;i<id.length;i++){
				config = that.getColumnConfig(id[i]);
				d.style.width = config.width+"px";
				d.innerHTML = that.getText(obj.id, config.id);
				h.push(d.scrollHeight);
			}
			obj.$height = Math.max.apply(null,h);
		}

		if(typeof id == 'string') id=[id];

		var d = webix.html.create("DIV",{"class":
		"webix_table_cell webix_measure_size webix_cell"},"");
		d.style.cssText = "height:1px; visibility:hidden; position:absolute; top:0px; left:0px; overflow:hidden;";
		this.$view.appendChild(d);

		if(rId){
			var obj = this.getItem(rId);
			processRow(this,obj);
		}
		else{
			this.data.each(function(obj){
				processRow(this,obj);
			}, this);
		}

		d = webix.html.remove(d);
		if (!silent)
			this.refresh();
	}
});

//<Class definition for the tSNEMap3DRender>
function tSNEMap3DRender() {
	this.xtkRenderer = new X.renderer3D();
	this.xtkRenderer.config.PICKING_ENABLED = true;  

	this.xtkRenderer.container = "3DtsneMap";
	this.xtkRenderer.init();
	
	this.selectionListStack = [];
	this.selectionCubesStack = [];
	this.selectionCubes = [];
	this.selectionList = [];
	this.ontologyObjects = {};
	var self = this;


	// create a mesh and associate it to the VTK Point Data
	// use mesh if you want to use the vtk reader - JSON is more flexible
	//var p = new X.mesh(); 
	//p.file = '/tsne.vtk';


	// the onShowtime function gets called automatically, just before the first
	// rendering happens
	this.xtkRenderer.onShowtime = function() {
		// animate! (on each rendering call)
		self.xtkRenderer.onRender = function() {

			$("#loading").css('display','none');

			// rotate the camera in X-direction
			//xtkRenderer.camera.rotate([1, 0]);
		};
	};
	
	function pointEpsilonCompare(point, element, index, array) {
		if ((Math.abs(point[0] - element[0]) < 0.5) &&
			(Math.abs(point[1] - element[1]) < 0.5) &&
			(Math.abs(point[2] - element[2]) < 0.1)) {
			return true;
		}
		return false;
	}
	
	function getNearbyPoints(point, radius) {
		// To do kd-tree (see https://github.com/mikolalysenko/static-kdtree or https://github.com/ubilabs/kd-tree-javascript)
		var indexes = [];
		var nearestPoints = mapTree.nearest({x:point[0], y:point[1], z:point[2]}, 1000, radius);
		for (var i=0; i<nearestPoints.length; i++) {
			indexes.push(nearestPoints[i][0].id);
		}
/*		for (var i=0; i<tsneMap.tsneMap.length; i++) {
			// brute force search in bounding box for speed
			if ((Math.abs(point[0] - tsneMap.tsneMap[i][0]) < radius) &&
				(Math.abs(point[1] - tsneMap.tsneMap[i][1]) < radius) &&
				(Math.abs(point[2] - tsneMap.tsneMap[i][2]) < radius)) {
				indexes.push(i);
			}
		}	 */
		
		return indexes;
	}	
  
	this.xtkRenderer.interactor.onMouseDown = function(left, middle, right) {
		// only observe right mouse clicks        
		//if (!right) return;
		// always complete the last open
		// grab the current mouse position
		var _pos = self.xtkRenderer.interactor.mousePosition;
		var evt = this.mousemoveEvent; //is global
		var ctrlPressed =evt.ctrlKey;
		
		if (right) {
			// pick the current object
			var _id = self.xtkRenderer.pick(_pos[0], _pos[1]);
			var structureObject = self.xtkRenderer.get(_id);
			if (structureObject) {
				var annotation_id = structureObject.annotation;
				// must be visible to check the box - (there may be another way to do this)
				var checkBoxId = '#singleSelectCheckbox_' + annotation_id;
				atlasTable.openAll();
				atlasTable.showItem(annotation_id);

				// use jQuery to trigger a mouse click on the checkbox
				$( checkBoxId ).trigger( "click" );
			}
			return;
		}
	};

	this.xtkRenderer.interactor.onKey = function (event) {
		// Defined key functions when the renderer has the focus
		//		select points - s
		//		clear all - c
		//		undo selection - ctrl-z
		var threeDarray;
		var twoDarray;
		if (!brainRenderer) {
			return;
		}
		if (event.keyCode != 83 && event.keyCode != 67 && event.keyCode != 90) {
			return;
		}	
		if(event.keyCode == 83) {
			var _pos = self.xtkRenderer.interactor.mousePosition;
			var dimensionality = tsneRenderer.dimensionality;
			if (dimensionality == 3) {
				threeDarray = self.xtkRenderer.pick3d(_pos[0], _pos[1], 0.05, 0.15);
				if (threeDarray) {
					//var selectedIndex = tsneMap.tsneMap.findIndex(pointEpsilonCompare.bind(null,threeDarray));
					var indexes = getNearbyPoints(threeDarray, selectionValues.selectionRadius);
					//var pindexes = getNearbyPointsParallel(threeDarray, selectionValues.selectionRadius);
					//var coord = tsneMap.tsneMap[selectedIndex];
					var newCubes = [];
					var newPoints = [];
					if (indexes.length > 1) {
						var sphere = new X.sphere();
						sphere.center = [threeDarray[0], threeDarray[1], threeDarray[2]];
						sphere.opacity = 0.5;
						sphere.color = [0.7, 0.7, 0.7];
						sphere.radius = selectionValues.selectionRadius;
						self.xtkRenderer.add(sphere);
						self.selectionCubes.push(sphere);						
						newCubes.push(sphere);
						for (var i=0; i<indexes.length; i++) {
							if (self.selectionList.indexOf(indexes[i]) > -1) {
								continue;
							}
							self.selectionList.push(indexes[i]);
							newPoints.push(indexes[i]);
						}
						self.selectionListStack.push(newPoints);
						self.selectionCubesStack.push(newCubes);						
					}
				
				}
			}
			else {
				twoDarray = self.xtkRenderer.pick(_pos[0], _pos[1]);
				threeDarray = self.xtkRenderer.pick3d(_pos[0], _pos[1]);
				//console.log(twoDarray);				
			}
			if (brainRenderer) {
				brainRenderer.selectInBrainAtlas(self.selectionList);
			}
		}
		else if (event.keyCode == 67) {
			self.clearSelection();
		}
		else if (event.keyCode == 90) {
			// selection undo code
			var ctrlPressed =event.ctrlKey;
			if (!ctrlPressed) {
				return;
			}
			if (self.selectionCubesStack.length === 0) {
				return;
			}
			self.undoSelection();
		}
	}; 
}

tSNEMap3DRender.prototype.clearSelection = function() {
	if (brainRenderer) {
		brainRenderer.clearSelectInBrainAtlas();
	}
	for (var i=0; i<this.selectionCubes.length; i++) {
		this.xtkRenderer.remove(this.selectionCubes[i]);
	}
	this.selectionListStack = [];
	this.selectionCubesStack = [];
	this.selectionCubes = [];
	this.selectionList = [];
};

tSNEMap3DRender.prototype.undoSelection = function() {
	var removeCubes = this.selectionCubesStack.pop();
	if (removeCubes === undefined) {
		return;
	}
	this.selectionListStack.pop();
	for (var i=0; i<removeCubes.length; i++) {
		this.xtkRenderer.remove(removeCubes[i]);
	}
	if (brainRenderer) {
		brainRenderer.undoSelectInBrainAtlas();
	}
	this.selectionCubes = [].concat.apply([],this.selectionCubesStack);
	this.selectionList = [].concat.apply([],this.selectionListStack);
};

tSNEMap3DRender.prototype.add = function(id, object) {
	this.xtkRenderer.add(object);
	this.ontologyObjects[id] = object;
};

tSNEMap3DRender.prototype.get = function(id) {
	return this.xtkRenderer.get(id);
};

tSNEMap3DRender.prototype.remove = function(object) {
	this.xtkRenderer.remove(object);
};

tSNEMap3DRender.prototype.render = function() {
	this.xtkRenderer.render();
};

tSNEMap3DRender.prototype.orientVolume = function(volume) {
	this.xtkRenderer.orientVolume(volume);
};

tSNEMap3DRender.prototype.destroy = function() {
	this.xtkRenderer.destroy();
	this.ontologyObjects = {};
	this.selectionListStack = [];
	this.selectionCubesStack = [];
	this.selectionCubes = [];
	this.selectionList = [];
};

tSNEMap3DRender.prototype.itemsChecked = function(checked) {

	var annotation = voxelData.voxel_props.annotation, i, xtkObject;
	if (checked.length === 0) {
		for (i=0; i<activeAnnotations.length; i++) {
			if (!annotationsOn[activeAnnotations[i]]) {
				//xtkObject = this.get(this.ontologyObjects[activeAnnotations[i]]);
				xtkObject = this.ontologyObjects[activeAnnotations[i]];
				xtkObject.color = [0.3, 0.3, 0.3];	
				xtkObject.opacity = 0.3;
				xtkObject.modified();
			}
		}
	}
	else {
		for (i=0; i<activeAnnotations.length; i++) {
		// default dark gray
			var colArray = [0.3, 0.3, 0.3];
			var opacity = 0.3;
			//xtkObject = this.get(this.ontologyObjects[activeAnnotations[i]]);
			xtkObject = this.ontologyObjects[activeAnnotations[i]];
			var curAnnot = xtkObject.annotation;
			if (checked.indexOf(curAnnot) > -1 || annotationsOn[curAnnot]) {
				colArray = xtkObject.rgbColor;
				opacity = 1.0;
			}
			xtkObject.color = colArray;	 
			xtkObject.opacity = opacity;
			xtkObject.modified();
		}
	}
};

tSNEMap3DRender.prototype.rowChecked = function(id, status, checked) {
	//var xtkObject = this.get(this.ontologyObjects[id]);
	var xtkObject = this.ontologyObjects[id];
	if (status || (checked.indexOf(id) > -1)) {
		xtkObject.color = xtkObject.rgbColor;
		xtkObject.opacity = 1.0;
	}
	else {
		xtkObject.color = [0.3, 0.3, 0.3];
		xtkObject.opacity = 0.3;
	}
	xtkObject.modified();
};

//</Class definition for the tSNEMap3DRender>

function getStyleSheet(unique_title) {
  for(var i=0; i<document.styleSheets.length; i++) {
    var sheet = document.styleSheets[i];
    if(sheet.title == unique_title) {
      return sheet;
    }
  }
}

//<Class definition for the d3ScatterPlotRender>
function d3ScatterPlotRender() {
	var tsneMap = $("#3DtsneMap");
	this.svgWindowsSize = Math.max(Math.min(window.innerHeight, window.innerWidth) - 200, 500);
	this.plotSize = 1000;
	this.svg = d3.select($("#3DtsneMap")[0])
			.append("svg")
			.attr("id", "svgChart")
			.attr("width", this.svgWindowsSize)  //try Math.max(Math.min(window.innerHeight, window.innerWidth) - 100, 500) for the width and height
			.attr("height", this.svgWindowsSize)
			.attr("viewBox", "0 0 " + this.plotSize + " " + this.plotSize); //viewbox defines a mapping between svg coords (0-width, 0-height) and the viewBox size
	var chart = $("#svgChart");
	$(window).on("resize", function() {
		var targetWidth = Math.max(Math.min(window.innerHeight, window.innerWidth) - 200, 500); //chart.parent().width();
		chart.attr("width", targetWidth);
		chart.attr("height", targetWidth);
	});
	
	// tooltips are held in their own overlapping div
	this.div = d3.select($("#3DtsneMap")[0]).append("div")
		.attr("class", "tooltip")
		.style("opacity", 0);
		
	this.selectionList = [];
	this.selectionListStack = [];
	
	d3.select("body").on("keydown", key);
	 
	var self = this;
	function key() {
		if (d3.event.keyCode == 67) {
			self.clearSelection();
		}
		else if (d3.event.keyCode == 90) {
			// selection undo code
			var ctrlPressed =d3.event.ctrlKey;
			if (!ctrlPressed) {
				return;
			}
			if (self.selectionListStack.length === 0) {
				return;
			}
			self.undoSelection();
		}
	}	
	
}


d3ScatterPlotRender.prototype.setJsonData= function(jsonData) {
	this.jsonData = jsonData;
};

d3ScatterPlotRender.prototype.render= function() {
	$("#loading").css('display','none');
	
	var xScale = d3.scale.linear()
                     .domain([d3.min(this.jsonData, function(d) { return d.x; }), d3.max(this.jsonData, function(d) { return d.x; })])
                     .range([0, this.plotSize]);
					 
	var xInvScale = d3.scale.linear()
                     .domain([0, this.plotSize])
                     .range([d3.min(this.jsonData, function(d) { return d.x; }), d3.max(this.jsonData, function(d) { return d.x; })]);	

	var yScale = d3.scale.linear()
                     .domain([d3.min(this.jsonData, function(d) { return d.y; }), d3.max(this.jsonData, function(d) { return d.y; })])
                     .range([0, this.plotSize]);
					 
	var yInvScale = d3.scale.linear()
                     .domain([0, this.plotSize])
                     .range([d3.min(this.jsonData, function(d) { return d.y; }), d3.max(this.jsonData, function(d) { return d.y; })]);

	var yRange =  d3.max(this.jsonData, function(d) { return d.y; }) - d3.min(this.jsonData, function(d) { return d.y; });
	var radiusScale = function(x) {return (x/this.plotSize) * (yRange); }; 
					
	var self = this;	

	this.selectionStart = [0,0];
	this.selectionRadius = 0;	
	this.scatter = this.svg.selectAll("circle") //point
						.data(self.jsonData)
						.enter()
						.append("circle") //path
						.attr("class", "point")					
						.attr("cx", function(d) {return xScale(d.x);}) // circle x coord
						.attr("cy", function(d) {return yScale(d.y);}) //circle y coord
						.attr("r", function(d) {return 2;})
						.attr("class", function(d) {return "ann_" + d.id;})
						.on("mousedown", self.pointMouseHandler)
						.on("mouseover", function(d) {
							self.div.transition()
									.duration(200)
									.style("opacity", 0.9);
							self.div.html(d.acro)  
									.style("left", (d3.event.pageX + 10) + "px")     
									.style("top", (d3.event.pageY - 38) + "px");
						})
							// d3.select(window).on('keydown', self.keyHandler);
						// })                
						.on("mouseout", function(d) {       
							self.div.transition()        
									.duration(500)      
									.style("opacity", 0);
							d3.select(window).on('keydown', null);
						});
						//.on("keypress", self.keyHandler());	
		
	// from http://bl.ocks.org/lgersman/5310854 see also http://bl.ocks.org/lgersman/5311083
	
	var svg = this.svg;
	this.svg
	.on( "mousedown", function() {
		if (!brainRenderer) {
			return;
		}
		if (svg.select( ".selection")) {
			svg.select( ".selection").remove();
		}
		var p = d3.mouse( this);

		svg.append( "circle")
		.attr({
			"r"		: 2,
			"class"	: "selection",
			"cx"	: p[0],
			"cy"	: p[1]
		});
		self.selectionStart = [p[0], p[1]];
	})
	.on( "mousemove", function() {
		var s = svg.select( "circle.selection");
		if( !s.empty()) {
			var p = d3.mouse( this),

				d = {
					cx		: parseInt( s.attr( "cx"), 10),
					cy		: parseInt( s.attr( "cy"), 10),
					r		: parseInt( s.attr( "r"), 10)
				},
				move = {
					r : Math.sqrt(Math.pow(p[0] - d.cx,2) + Math.pow(p[1] - d.cy, 2))
				}
			;
			if (move.r < 150) {
				d.r = move.r;
				self.selectionRadius = move.r;
				s.attr( d);
			}
			//console.log( d);
		}
	})
	.on( "mouseup", function() {
		svg.select( ".selection").remove();
		self.selected = mapTree.nearest({x:xInvScale(self.selectionStart[0]), y:yInvScale(self.selectionStart[1])}, 1000, radiusScale(self.selectionRadius));
		var selectionIds = [];
		for (var i=0; i<self.selected.length; i++) {
			var id = self.selected[i][0].id;
			if (self.selectionList.indexOf(id) < 0) {
				selectionIds.push(id);
			}
		}
		self.addSelection(selectionIds);	
	});
	// the x and y axes are meaningless - this is just a pretty picture :-)
	
};

d3ScatterPlotRender.prototype.addSelection= function(selectionIds) {
	if (brainRenderer && selectionIds.length > 0) {
		brainRenderer.selectInBrainAtlas(selectionIds);	
		this.svg.append( "circle")
		.attr({
			"r"	: this.selectionRadius,
			"class"	: "selected_circle",
			"cx"	: this.selectionStart[0],
			"cy"	: this.selectionStart[1],
			"id"	: "selected_circle_" + this.selectionListStack.length
		});		
		this.selectionListStack.push(selectionIds);
		this.selectionList = [].concat.apply([],this.selectionListStack);		
	}
};
d3ScatterPlotRender.prototype.refresh= function() {
	var annSheet = getStyleSheet("Main");	
	var oldRules = annSheet.cssRules;

	// While it is possible to change the fill attribute in the svg
	// elements - changing a smaller number of css rules makes for a quicker refresh
	for(var i=0; i<this.activeAnnotations.length; i++) {
		var ann = this.activeAnnotations[i];
		var color = this.getColorId(ann, this.activeAnnotationsColor[i]);
		oldRules[i].style.fill = color;
	}
};

d3ScatterPlotRender.prototype.keyHandler= function() {
	if (!d3.event) {
		return;
	}
	//console.log("Hit: " + d3.event.keyCode);
};

d3ScatterPlotRender.prototype.pointMouseHandler= function() {
	if (!d3.event) {
		return;
	}
	//var _pos = self.xtkRenderer.interactor.mousePosition;
	var evt = this.mousemoveEvent; //is global
	var left =  d3.event.which == 1;
	var middle =  d3.event.which == 2;
	var right =  d3.event.which == 3;
	
	if (right) {
		// pick the current object
		var annotation_id = arguments[0].id;
		// must be visible to check the box - (there may be another way to do this)
		var checkBoxId = '#singleSelectCheckbox_' + annotation_id;
		atlasTable.openAll();
		atlasTable.showItem(annotation_id);
		// use jQuery to trigger a mouse click on the checkbox
		$( checkBoxId ).trigger( "click" );
	}
};

d3ScatterPlotRender.prototype.getColor= function(d) {
	return this.getColorId(d.id, d.color);
};

d3ScatterPlotRender.prototype.getColorId= function(id, anncolor) {
	var settings = this.annotationSettings[id];
	color = "#555555"; // darkgrey
	if (settings.checked || settings.on) {
		color = anncolor;
	}
	return color;
};

d3ScatterPlotRender.prototype.getOpacity= function(d) {
	var settings = this.annotationSettings[d.id];
	opacity = 0.3; 
	if (settings.checked || settings.on) {
		opacity = 1.0;
	}
	return opacity;
};

d3ScatterPlotRender.prototype.destroy= function() {
	$("#3DtsneMap").html("");
	this.svg = {};
	this.jsonData = {};
	this.scatter = {};
	this.scatterAttributes = {};
	if (brainRenderer) {
		brainRenderer.clearSelectInBrainAtlas();
	}
	// cleanup the style sheet
	var annSheet = getStyleSheet("Main");
	for (var i=0; i< this.numRulesAdded; i++) {
		annSheet.deleteRule(0);
	}
};

d3ScatterPlotRender.prototype.clearSelection = function() {
	for (var i=0; i<this.selectionListStack.length; i++) {
		$("#selected_circle_" + i).remove();
	}
	this.selectionListStack = [];
	this.selectionList = [];
	if (brainRenderer) {
		brainRenderer.clearSelectInBrainAtlas();
	}
};

d3ScatterPlotRender.prototype.undoSelection = function() {
	this.selectionListStack.pop();
	var selcirc = $("#selected_circle_" + this.selectionListStack.length); 
	$("#selected_circle_" + this.selectionListStack.length).remove();
	this.selectionList = [].concat.apply([],this.selectionListStack);	
	if (brainRenderer) {
		brainRenderer.undoSelectInBrainAtlas();
	}
};

d3ScatterPlotRender.prototype.itemsChecked = function(checked) {
	
	var strChecked = [];
	// convert to strings to match the string keys for ease of lookup
	checked.every(function(el, id, array) {strChecked.push(el.toString()); return true;});
	
	for (var key in this.annotationSettings) {
		var setting = this.annotationSettings[key];
		setting.checked = (strChecked.indexOf(key) > -1);
		setting.on = false;
		if (key in annotationsOn) {
			setting.on = annotationsOn[key];
		}
	}
	this.refresh();
};

d3ScatterPlotRender.prototype.setActiveAnnotations = function(activeAnnotations, activeAnnotationsColor) {
	this.annotationSettings = {}; // a list of the annotation settings keyed by id as string
	this.activeAnnotations = activeAnnotations;
	this.activeAnnotationsColor = activeAnnotationsColor;
	var annSheet = getStyleSheet("Main");	
	var oldRules = annSheet.cssRules;
	
	
	// Points are colored via CSS
	this.numRulesAdded = 0;
	for (var i=0; i<activeAnnotations.length; i++) {
		setting = {};
		setting.checked = true;
		setting.on = true;
		this.annotationSettings[activeAnnotations[i]] = setting;
		annSheet.insertRule("circle.ann_" + activeAnnotations[i] + "{ fill: " + activeAnnotationsColor[i]  + ";}",i);
		this.numRulesAdded++;
	}
};

d3ScatterPlotRender.prototype.rowChecked = function(id, status, checked) {
	var setting = this.annotationSettings[id];
	if (!setting) {
		return; // ontology row not in voxels
	}
	setting.on = status;
	this.annotationSettings[id] = setting;
	this.refresh();
	//var allAnn = d3.selectAll("[class=ann_" + id + "]"); 
	//console.log("ann " + id);
	//allAnn.style("fill", this.getColor(allAnn[0][0].__data__));
};

//</Class definition for the d3ScatterPlotRender>



function loadMap(mapFilePath, voxelFilePath, title) {
	var tsnePoints;
	var colors;
	var dimensionality;
	// simple 3D Euclidean distance for the kdtree
	function distance3D(a, b) {
		var dx = a.x-b.x;
		var dy = a.y-b.y;
		var dz = a.z-b.z;
		return dx*dx + dy*dy + dz*dz;
	}
	
	// simple 2D Euclidean distance for the kdtree
	function distance2D(a, b) {
		var dx = a.x-b.x;
		var dy = a.y-b.y;
		return dx*dx + dy*dy;
	}
	
	function makeAnnotationObject3D(value1, value2, set) {
		// Find the points belonging to this annotation
		// and make a display object for them with the 
		// annotation color.
		// Some objects may be empty because not all regions 
		// have data points.
		

		var colorIndex = -1;
		var annotations = voxelData.voxel_props.annotation;
		var pointsForAnnotation = [];
		for (var i=0; i<tsnePoints.length; i++) {
			if (annotations[i] == value1) {
				pointsForAnnotation.push(i);
				colorIndex = i;
			}
		}
		// if an annotation object has sample points make
		// an xtkObject to represent it.
		if (pointsForAnnotation.length > 0) {
			activeAnnotations.push(value1);
			var xtkObject = new X.object();
			xtkObject.pointsize = 6;
			//xtkObject.linewidth = 1;
			//xtkObject.reslicing = true;
			//xtkObject.visible = true;
			//xtkObject.borders = false;
			xtkObject.volumeRendering = true;
			xtkObject.type = 'POINTS';
			xtkObject.points = new X.triplets(pointsForAnnotation.length * 3);
			xtkObject.normals = new X.triplets(pointsForAnnotation.length * 3);
			var objColor = colors[colorIndex];
			var red = ((objColor >> 16) & 0xFF)/0xFF;
			var green = ((objColor >> 8) & 0xFF)/0xFF;
			var blue = (objColor & 0xFF)/0xFF;		
			for (i=0; i<pointsForAnnotation.length; i++) {
				var point = tsnePoints[pointsForAnnotation[i]];
				// unit normals pointing from center (gives 3d lighting effect)
				var invLen = 1/Math.sqrt(point[0]*point[0] + point[1]*point[1] + point[2]*point[2]);
				if (dimensionality == 3) {
					xtkObject.normals.add(point[0] * invLen, point[1] * invLen, point[2] * invLen);
				} 
				else
				{
					xtkObject.normals.add(0,0,1);
				}
				xtkObject.points.add(point[0], point[1], point[2]);
				xtkObject.color = [red, green, blue];
			}
			xtkObject.indexZ = 0;
			xtkObject.rgbColor = [red, green, blue];
			xtkObject.annotation = value1;
			xtkObject.acronym = voxelData.voxel_props.acronym[colorIndex];
			xtkObject.caption = xtkObject.acronym;

			tsneRenderer.add(value1, xtkObject);
		}
	}
	
	var kdPoints = [];
	// Cleanup any rendering objects
	if (tsneRenderer) {
		tsneRenderer.destroy();
	}
	activeAnnotations = [];
	activeAnnotationsColor = [];

	// parallel retrieval of tsne info for speed
	$.when($.getJSON(voxelFilePath).fail(getJSONFail), 
		$.getJSON(mapFilePath)).then(gotVoxelData, notGotVoxelData);
 
	function gotVoxelData(voxel, tsne) {
		voxelData = voxel[0];
		tsneMap = tsne[0];
		colors = voxelData.voxel_props.colors;
		dimensionality = tsneMap.tsneMap[0].length;

		if (dimensionality == 2) {
			// for (var i=0; i<tsneMap.tsneMap.length; i++) {
				// tsneMap.tsneMap[i].push(0.0);
			// }
			// Try D3 (svg based)
			tsneRenderer = new d3ScatterPlotRender();
			// try RGraph (canvas based)
			//tsneRenderer = new RGraphScatterPlotRender();
		}
		else {
			tsneRenderer = new tSNEMap3DRender();
		}	
		tsneRenderer.dimensionality = dimensionality;

		tsnePoints = tsneMap.tsneMap;
		var point;
		var i;
		if (dimensionality == 3) {
			for (i=0; i<tsnePoints.length; i++) {
				point = {x: tsnePoints[i][0], y: tsnePoints[i][1], z: tsnePoints[i][2], id: i};
				kdPoints.push(point);
			}
			mapTree = new kdTree(kdPoints, distance3D, ["x", "y", "z"]);
		}
		else {
			for (i=0; i<tsnePoints.length; i++) {
				point = {x: tsnePoints[i][0], y: tsnePoints[i][1], id: i};
				kdPoints.push(point);
			}
			mapTree = new kdTree(kdPoints, distance2D, ["x", "y"]);		
		}
		var annotationSet = new Set(voxelData.voxel_props.annotation);
		//console.log("Voxel colors : " + colors.length + "tsne length" + tsnePoints.length);

		// Make one object for each annotation value
		// Build a map from annotation value to object
		// and from id to object?
		
		function d2h(d) { return '#' + ('000000' + (+d).toString(16)).slice(-6); }
		// TODO move these to the 2D renderers
		function plotDataForD3JS(tsnePoints, voxelData) {
			var jsonTsnePlotData = [];
			for (var i=0; i < tsnePoints.length; i++) {
				point = {};
				point.x = tsnePoints[i][0];
				point.y = tsnePoints[i][1];
				point.id = voxelData.annotation[i];
				point.acro = voxelData.acronym[i];
				point.color = d2h(voxelData.colors[i]);
				jsonTsnePlotData.push(point);
				if (activeAnnotations.indexOf(point.id) == -1) {
					activeAnnotations.push(point.id);
					activeAnnotationsColor.push(point.color);
				}
			}	
			return jsonTsnePlotData;
		}
		
		function plotDataForRGraph(tsnePoints, voxelData) {
			var jsonTsnePlotData = [];
			for (var i=0; i < tsnePoints.length; i++) {
				point = [];
				point.push(tsnePoints[i][0]);
				point.push(tsnePoints[i][1]);
				point.push(d2h(voxelData.colors[i]));
				point.push(voxelData.acronym[i]);
				point.push(voxelData.annotation[i]);
				jsonTsnePlotData.push(point);
				if (activeAnnotations.indexOf(point[4]) == -1) {
					activeAnnotations.push(point[4]);
					activeAnnotationsColor.push(point[2]);
				}
			}
			return jsonTsnePlotData;
		}
		
		function makeAnnotationObject2D(tsnePoints, voxelData) {

			var jsonTsnePlotData = plotDataForD3JS(tsnePoints, voxelData);
			//var jsonTsnePlotData = plotDataForRGraph(tsnePoints, voxelData);
			tsneRenderer.setJsonData(jsonTsnePlotData);
		}
		
		if (dimensionality == 2) {
			makeAnnotationObject2D(tsnePoints, voxelData.voxel_props);
			tsneRenderer.setActiveAnnotations(activeAnnotations, activeAnnotationsColor);
		}
		else {
			annotationSet.forEach(makeAnnotationObject3D);
		}
		
		tsneRenderer.render();
		$("#title").text(title);

	}
	function notGotVoxelData(voxel, tsne) {
		alert("Failed to get data!");
	}
	function getJSONFail(jqXHR, textStatus, errorThrown) {
		alert('getJSON request failed! ' + textStatus + ": " + errorThrown.message + ": " + jqXHR.responseText.slice(1,50));
	}
}

webix.ready(function() {
	defineControls();
	//setup_tSNEMapRender();
	// The ontology JSON can be loaded together with the tSNE map
	var json_data;
	$.getJSON( "ontology.json", function( data ) {
		displayOntologyData(data);
	});
});

webix.event(window, "resize", function(){ atlasTable.adjust(); });

function css_color_from_hextriplet(hex_triplet) {
	var textCol = (parseInt("0x"+hex_triplet, 16) > 0xffffff/2) ? 'black':'white';
	var backCol = "#"+hex_triplet;
	return {"color":textCol, "background-color":backCol}; 
}

function style_from_hextriplet(hex_triplet) {
	var obj = css_color_from_hextriplet(hex_triplet);
	var styleString = " style=\"";
	for (var property in obj) {
		if (obj.hasOwnProperty(property)) {
			styleString = styleString + property + ":" + obj[property] + "; ";
		}
	}	
	styleString = styleString + "\" ";
	return styleString;
}

// make a lockup table from 
function ontologyToLookup(tree, lookup) {
	for(var i=0; i<tree.length; i++) {
		lookup[tree[i].id] = tree[i].color_hex_triplet;
		if (tree[i].children.length > 0) {
			ontologyToLookup(tree[i].children);
		}
	}
}

function defineControls() {
    selectionValues = new ControlValues();
	selectionGui = new dat.GUI({autoPlace: false, width: 400 });
	selectionGui.domElement.style.position = 'absolute';
	selectionGui.domElement.style.top = '1px';
	selectionGui.domElement.style.left = '1px';
	$("#control_gui_container").append(selectionGui.domElement);
	
	var brainViewObj = { brainLocator:function(){
		document.getElementById("BrainLocator").style.display = displayBrain ? 'none' :'block';
		document.getElementById("AtlasOntology").style.display = displayBrain ? 'block' :'none';
		displayBrain = !displayBrain;			
		if (displayBrain && !brainRenderer && voxelData) {
			brainRenderer = new BrainRenderer();
		}
	}};
	
	var clearSelectObj = { clearSelect:function(){
		if (tsneRenderer) {
			tsneRenderer.clearSelection();
		}
	}};	
	
	var undoSelectObj = { undoSelect:function(){
		if (tsneRenderer) {
			tsneRenderer.undoSelection();
		}
	}};	
	
	selectionGui.add(selectionValues, 'selectionRadius', 0.1, 3.0).name('Set selection radius (for 3D)');
	selectionGui.add(brainViewObj, 'brainLocator').name('Toggle Ontology/Brain View');
	selectionGui.add(clearSelectObj, 'clearSelect').name('Clear selection');	
	selectionGui.add(undoSelectObj, 'undoSelect').name('Undo last selection');		
	selectionGui.open();
	
	var columns = [
		{ id:"id",	header:"id", sort: "integer", width:60},
		{ id:"acronym", sort:"string",	header:["Acronym (hierarchy select)", {content:"textFilter"}],	width:270,
			template:"{common.space()}{common.icon()}{common.treecheckbox()}{common.folder()}   #acronym#" }
	];
	
	
	function fontweight_checkbox(obj, common, value){
		if (value) {
			return "<div class='webix_table_checkbox checked' id='singleSelectCheckbox_" + obj.id + "'" + style_from_hextriplet(obj.color_hex_triplet) + ">" + obj.name + "</div>";
		}
		else {
			return "<div class='webix_table_checkbox unchecked' id='singleSelectCheckbox_" + obj.id + "'" + style_from_hextriplet(obj.color_hex_triplet) + ">" + obj.name + "</div>";
		}
	}
	
	columns.push({id:"checked", header:"Name (single select)", width:200, template:fontweight_checkbox, editor:"inline-checkbox"});
	

	atlasTableDef = {
		id: "atlasTableId",
		//container:"AtlasOntology",
		select:true,
		view:"treetable",
		css:"ontology_style",
		scrollY: true,
		threeState: true,
		columns: columns,
		fixedRowHeight:false,
		autowidth:true,
		autoConfig:true,	
		resizeColumn:true,
		checkboxRefresh:true,
		on:{
			onAfterLoad:function(){
				webix.delay(function(){
					this.adjustRowHeight("name", true); 
					this.render();
				}, this);
			},
			onColumnResize:function(){
				this.adjustRowHeight("name", true);
				this.render();
			}
		}
	};
		
	selectTableDef = {
		id: "selectTableId",
		view:"datatable",
		columns:[
			{ id:"map",   header:"Name",    width:80, template:"<p>#map#<p>"},
			{ id:"ontology",    header:"Ontology" , width:80, template:"<p>#ontology#<p>"},
			{ id:"description",   header:"Description",  width:230, template:"<p>#description#<p>"},
			{ id:"file",   header:"File",  width:100, template:"<p style='word-wrap: break-word'>#file#<p>"}			
		],
		autowidth:false,
		fixedRowHeight:false,  
		rowLineHeight:25, 
		rowHeight:25,  
		select:"row",
		multiselect:false,
		on:{
			// resize the row hight based on the biggest column
			"onResize":webix.once(function() {
				this.myAdjustRowHeight(['map', 'ontology', 'description', 'file'], true);
				this.render();
			}),
			onSelectChange:function(){
				var obj = this.getSelectedItem();
				$$("toolTabs").setValue("atlasTableId");
				$("#loading").css('display','inline');
				$("#loading_prompt").text("Loading:  " + obj.map);				
				loadMap(obj.file, obj.voxel_file, obj.map);
			}			
		},	
		// some data for testing
		data: [
			{id:1, map:"Mouse coronal t0.7 p32 2D", ontology:"Mouse Brain Atlas", description:"A 2D tSNE map generated with perplexity 32, theta 0.7 on 61164 voxels with 4345 gene expression values", file:"tsnemap2D_mouse_p32_t0_7.json", voxel_file: "voxel.json"},
			{id:2, map:"Mouse coronal t0.7 p64 2D", ontology:"Mouse Brain Atlas", description:"A 2D tSNE map generated with perplexity 64, theta 0.7 on 61164 voxels with 4345 gene expression values", file:"tsnemap2D_mouse_p64_t0_7.json", voxel_file: "voxel.json"},
			{id:3, map:"Mouse coronal t0.7 p128 2D", ontology:"Mouse Brain Atlas", description:"A 2D tSNE map generated with perplexity 128, theta 0.7 on 61164 voxels with 4345 gene expression values", file:"tsnemap2D_mouse_p128_t0_7.json", voxel_file: "voxel.json"},
			{id:4, map:"Mouse coronal t0.7 p256 2D", ontology:"Mouse Brain Atlas", description:"A 2D tSNE map generated with perplexity 256, theta 0.7 on 61164 voxels with 4345 gene expression values", file:"tsnemap2D_mouse_p256_t0_7.json", voxel_file: "voxel.json"},		
			{id:5, map:"Mouse coronal t0.7 p32 3D", ontology:"Mouse Brain Atlas", description:"A 2D tSNE map generated with perplexity 32, theta 0.7 on 61164 voxels with 4345 gene expression values", file:"tsnemap_mouse_p32_t0_7.json", voxel_file: "voxel.json"},
			{id:6, map:"Mouse coronal t0.7 p64 3D", ontology:"Mouse Brain Atlas", description:"A 2D tSNE map generated with perplexity 64, theta 0.7 on 61164 voxels with 4345 gene expression values", file:"tsnemap_mouse_p64_t0_7.json", voxel_file: "voxel.json"},
			{id:7, map:"Mouse coronal t0.7 p128 3D", ontology:"Mouse Brain Atlas", description:"A 2D tSNE map generated with perplexity 128, theta 0.7 on 61164 voxels with 4345 gene expression values", file:"tsnemap_mouse_p128_t0_7.json", voxel_file: "voxel.json"},
			{id:8, map:"Mouse coronal t0.7 p256 3D", ontology:"Mouse Brain Atlas", description:"A 2D tSNE map generated with perplexity 256, theta 0.7 on 61164 voxels with 4345 gene expression values", file:"tsnemap_mouse_p256_t0_7.json", voxel_file: "voxel.json"}			
		]
	};
	
	webix.ui({
		type: "space",
		container: "AtlasOntology",
		padding:8,
		rows:[
			{view:"tabbar", id:"toolTabs", multiview:true, height:50, optionWidth:100,  align:"center", options: []
			},
			{view:"multiview", id:"multiViewCellsId", cells:[
				{view:"template", id:"tpl", template:"Placeholder"} //multiview should have at least one cell
			]}					
		]
	});	
	
	// add the controls one by one to the multiview and the tabbar
	// First the ontology navigator
	var atlasId= $$("multiViewCellsId").addView(atlasTableDef);
	var toolTabs = $$("toolTabs");
	toolTabs.addOption(atlasId, "Navigate ontology", true);
	
	
	// Then the map selector
	var formId= $$("multiViewCellsId").addView(selectTableDef);
	toolTabs.addOption(formId, "Load map", true);
	
	atlasTable = $$(atlasId);	
	atlasTable.attachEvent("onItemCheck", atlasItemsChecked);
	atlasTable.attachEvent("onCheck", atlasItemCheck); 

}


function displayOntologyData(json_data){
	ontologyData = json_data.msg[0].children[0];
	// We are currently using the color table from the voxel data 
	// not from the ontology - there are slight differences which need
	// to be checked.
	//lookup = {}
	//ontologyToLookup([ontologyData], lookup);
	var rootId = ontologyData.id;
 
	// It would be better if we could define the child function 
	// dynamically  based on the ontology schema
	
	//atlasTable.clearAll();
	var myjson = webix.DataDriver.myjson = webix.copy(webix.DataDriver.json);
	myjson.child=function(obj){
		return obj.children;
	};
	atlasTable.parse(ontologyData, "myjson");
	atlasTable.render();
	atlasTable.checkItem(rootId);	
}

function atlasItemsChecked(id) {
	//webix.message("Click checkbox: "+id);
	var checked = atlasTable.getChecked();
	//webix.message("Total checked: " + checked.length + checked);
	if (!tsneMap) {
		return;
	}
	tsneRenderer.itemsChecked(checked);
}

function atlasItemCheck (row, column, state){
	item = atlasTable.getItem(row);
	var checked = atlasTable.getChecked();
	//webix.message("Single check : " + item.name + " acronym check " + item.acronym) + " state: " + state;

	annotationsOn[row] = (state == 1 ) ? true: false;
	tsneRenderer.rowChecked(row, annotationsOn[row], checked);
}

function on_checked_change(row, col, state) {
	//webix.message("row: " + row + " col: " + col + " state: " + state );    
}

