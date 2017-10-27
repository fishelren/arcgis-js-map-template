require([
	"esri/Map",
    "esri/config", //配置全局属性
    "esri/request",
    "esri/views/MapView",
    "esri/layers/BaseTileLayer",
    "esri/Basemap",
    "esri/widgets/BasemapToggle",
    "esri/widgets/ScaleBar",
    "esri/widgets/Compass",

    "esri/views/2d/draw/Draw",
	"esri/geometry/Point",
	"esri/geometry/Polyline",
	"esri/geometry/Polygon",
	"esri/Graphic",
	"esri/geometry/geometryEngine",
	"dojo/dom",

	"dojo/dom-style",
	"dojo/request",
	"dojo/string",
	"esri/layers/GraphicsLayer",
	"dojo/dom-construct",
	"dojo/on",

    "dojo/domReady!"
],function(Map, esriConfig, esriRequest,
        MapView, BaseTileLayer, Basemap, BasemapToggle, ScaleBar, Compass,
        Draw,Point,Polyline,Polygon,Graphic,geometryEngine,dom,
        domStyle,request,str,GraphicsLayer,domConstruct,on
        ){

	
	/*********************1、地图加载**********************/
	// BaseTileLayer可以用来扩展以创建一个自定义的TileLayer，用来加载第三方（非ESRI）的地图数据
    var customTileLayer = BaseTileLayer.createSubclass({
        // 自定义瓦片图层的属性
        properties: {
            urlTemplate: null //瓦片的url模板
        },
        // 取得指定级别、行、列瓦片的url，重写该方法，将模板替换成实际的url
        getTileUrl: function(level, row, col) {
            return this.urlTemplate.replace("{z}", level).replace("{x}",col).replace("{y}", row);
        },
        // 取得view中指定级别、行、列的瓦片。重写该方法，让瓦片在显示前被预处理。
        fetchTile: function(level, row, col) { //
            //取得指定级别、行、列的瓦片的url
            var url = this.getTileUrl(level, row, col);
            // 根据url请求瓦片
            return esriRequest(url, {
                responseType: "image", //以image的形式返回瓦片
                allowImageDataAccess: true //只在responseType = "image"时有效，允许读取第三方网站（非ESRI）上的image数据
            })
            .then(function(response) {
                var image = response.data; //返回的数据，这里是从服务器获得的图像
                /*
                 BaseTileLayer.tileInfo.size : Number[]
                 eg:
                    sets the height and width of each tile to [ 256, 256 ]
                    tileInfo.size = 256;
                */
                var width = this.tileInfo.size[0]; //瓦片的宽
                var height = this.tileInfo.size[0]; //瓦片的高
                // 用Canvas来绘制瓦片
                var canvas = document.createElement("canvas");
                var context = canvas.getContext("2d");
                canvas.width = width;
                canvas.height = height;
                context.drawImage(image, 0, 0, width, height);
                return canvas;
            }.bind(this)); //绑定then中函数的this为customTileLayer
        }
    });

    // 将自定义图层数据源的服务器添加进支持跨域资源共享的服务器名称数组。使用google地图。
    esriConfig.request.corsEnabledServers.push("http://www.google.cn/");

    // 自定义路线图层
    var roadTileLayer=new customTileLayer({
        urlTemplate: "http://www.google.cn/maps/vt/pb=!1m4!1m3!1i{z}!2i{x}!3i{y}!2m3!1e0!2sm!3i395092375!3m8!2szh-CN!3scn!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m1!1e0"
    });

    // 自定义卫星图层
    var satelliteTileLayer=new customTileLayer({
    	/*
    		lyrs指定瓦片类型
				m：路线图
				t：地形图
				p：带标签的地形图
				s：卫星图
				y：带标签的卫星图
				h：标签层（路名、地名等）
    	*/
    	// 其实lyrs=m也就是roadTileLayer的类型
    	urlTemplate: "http://www.google.cn/maps/vt?lyrs=y@746&gl=cn&x={x}&y={y}&z={z}"
    });

    var roadBaseMap=new Basemap({
    	baseLayers:[roadTileLayer],
    	title:"路线图",
    	id:"roadBaseMap"
    });

    var satelliteBaseMap=new Basemap({
    	baseLayers:[satelliteTileLayer],
    	title:"卫星图",
    	id:"satelliteBaseMap"
    });

	var map=new Map({
		basemap:roadBaseMap
	});

	var location_graphics_layer=new GraphicsLayer(); //用于存放查找结果的标注
	map.layers.add(location_graphics_layer);

	var view=new MapView({
		container: "view-div",
		map: map,
		center: [104.06,30.66],
		zoom: 10
	});

	view.then(function(){
		//底图切换控件
		var basemapToggle=new BasemapToggle({
			view: view,
			nextBasemap: satelliteBaseMap,
			titleVisible: true //显示BaseMap的title
		});
		view.ui.add(basemapToggle, "top-right");

		//比例尺控件
		var scaleBar=new ScaleBar({
			view: view,
			unit:"metric"
		});
		view.ui.add(scaleBar,"bottom-left");

		//指南针控件
		var compass = new Compass({
		  view: view
		});
		view.ui.add(compass, "top-left");
	});

	/************************2、测量功能***************************/ 
	var tool_select_tag=dom.byId("tool-select-tag"); //控制工具下拉菜单显隐的checkbox

	view.then(function(response){ //View实例是一个Promise
		draw=new Draw({
			view:view
		});

		//测面积
		var measureAreaBtn=dom.byId("measure-area");
		measureAreaBtn.addEventListener("click",function(){
			view.graphics.removeAll();
			enableCreateCertainGeometry(draw,view,"polygon");
			tool_select_tag.checked=false; //点击完后收起测量工具列表
		});

		//测距
		var measureLengthBtn=dom.byId("measure-length");
		measureLengthBtn.addEventListener("click",function(){
			view.graphics.removeAll();
			enableCreateCertainGeometry(draw,view,"polyline");
			tool_select_tag.checked=false;
		});

		//清除测量图形
		var clearMeasureBtn=dom.byId("clear-measure");
		clearMeasureBtn.addEventListener("click",function(){
			view.graphics.removeAll();
			tool_select_tag.checked=false;
		});
	});

	//------------测面积
	function drawPolygon(evt){
		var vertices=evt.vertices;
		view.graphics.removeAll(); //实时地清除原有图形，并随后重画，产生一个实时改变的效果
		var polygon=createPolygon(vertices);
		var polygon_graphic=createPolygonGraphic(polygon);
		view.graphics.add(polygon_graphic);
		var area=geometryEngine.geodesicArea(polygon,"square-meters"); //计算面积，单位指定为平方千米
		//这里偶尔遇到了API中geometryEngine.geodesicArea计算出来的面积值为NaN的情况，有待解决？？？是API的bug吗？
		
		if(area<0){
			var simplifiedPolygon=geometryEngine.simplify(polygon); //使拓扑关系正确
			if(simplifiedPolygon){
				area=geometryEngine.geodesicArea(simplifiedPolygon,"square-meters");
			}
		}

		//如果用户以快速双击的形式打下一个点并结束则会出现面积为0的面，显然不合理，这里让用户重新绘制
		if(evt.type==="draw-complete"){ 
			if(area<10e-6){ //如果面积为0（JS中的浮点数是不精确的）
				view.graphics.removeAll();
				enableCreateCertainGeometry(draw,view,"polygon");
			}

			dom.byId("view-div").style.cursor="default";
		}

		if(area>0){ //在打第二个点之前area的值可能是负数，geometryEngine.simplify无法对还没有构成Polygon的几何体使用，不应该标
			labelArea(polygon,area); //为Polygon标上面积
		}
		
	}

	function createPolygon(vertices){
		return new Polygon({
			rings:vertices,
			spatialReference:view.spatialReference
		});
	}

	function createPolygonGraphic(polygon){
		return new Graphic({
			geometry:polygon,
			symbol:{
				type:"simple-fill",
				color:[178, 102, 234, 0.8],
				style:"solid",
				outline:{
					color:[255, 255, 255],
					width:2
				}
			}
		});
	}

	var measure_graphic_symbol={ //长度和面积测量值的符号样式
		type:"text",
		color:"#f97c3e",
		haloColor:"black",
		haloSize:"1px",
		xoffset:3,
		yoffset:3,
		font:{
			size:14,
			family:"sans-serif"
		}
	};

	function labelArea(polygon,area){	
		if(area>1000000){
			measure_graphic_symbol.text=(area*1.0/1000000).toFixed(2)+"平方千米";
		}else{
			measure_graphic_symbol.text=area.toFixed(2)+"平方米";
		}
		var area_graphic=new Graphic({
			geometry:polygon.centroid, //Polygon的面积标在图心处
			symbol:measure_graphic_symbol
		});
		view.graphics.add(area_graphic);
	}

	//--------------测距
	function drawPolyline(evt){
		var vertices=evt.vertices;
		view.graphics.removeAll();
		var polyline=createPolyline(vertices);
		var polyline_graphic=createPolylineGraphic(polyline);
		view.graphics.add(polyline_graphic);
		var length=geometryEngine.geodesicLength(polyline,"meters");
		if(length<0){
			var simplifiedPolyline=geometryEngine.simplify(polyline);
			if(simplifiedPolyline){
				length=geometryEngine.geodesicLength(simplifiedPolyline,"meters");
			}
		}

		//同面积。不应该出现长度为0的线。重画
		if(evt.type==="draw-complete"){
			if(length<10e-6){
				view.graphics.removeAll();
				enableCreateCertainGeometry(draw,view,"polyline");
			}
			dom.byId("view-div").style.cursor="default"; //结束一次绘制，将光标变为默认
		}

		if(length>0){
			labelLength(polyline,length);
		}
		
	}

	function createPolyline(vertices){
		return new Polyline({
			paths:vertices,
			spatialReference:view.spatialReference
		});
	}

	function createPolylineGraphic(polyline){
		return new Graphic({
			geometry:polyline,
			symbol:{
				type:"simple-line",
				color:[178, 102, 234],
				width:2
			}
		});
	}

	function labelLength(polyline,length){
		var last_pt_coordinate=polyline.paths[0][polyline.paths[0].length-1]; //获得最后一个点的坐标对，把长度的测量值放在最后一个点附近
		var last_point=new Point({
			x:last_pt_coordinate[0],
			y:last_pt_coordinate[1],
			spatialReference:view.spatialReference
		});

		if(length>1000){
			measure_graphic_symbol.text=(length*1.0/1000).toFixed(2)+"千米";
		}else{
			measure_graphic_symbol.text=length.toFixed(2)+"米";
		}

		var length_graphic=new Graphic({
			geometry:last_point,
			symbol:measure_graphic_symbol
		});
		view.graphics.add(length_graphic);
	}

	//通用
	function enableCreateCertainGeometry(draw,view,geometry_name){
		var action=draw.create(geometry_name);
		var draw_func=(geometry_name==="polygon")?drawPolygon:drawPolyline;
		action.on("cursor-update",draw_func); //鼠标位置改变
		action.on("vertex-add",draw_func); //添加节点
		action.on("vertex-remove",draw_func); //移除节点
		action.on("draw-complete",draw_func); //绘制完成

		dom.byId("view-div").style.cursor="crosshair"; //将光标变为十字形状，提示用户进行绘制
	}

	/***********************3、查询功能**************************/
	var side_bar=dom.byId("side-bar");
	var side_bar_toggle_btn=dom.byId("side-bar-toggle-btn");
	side_bar_toggle_btn.addEventListener("click",function(){
		side_bar.className=(side_bar.className==="side-bar-show")?"":"side-bar-show"; 
	});

	/* google提供的服务不支持jsonp。此处采用google map api进行地理编码和反向地理编码 */

	var search_text_input=dom.byId("search-text"); //搜索输入框
	var search_btn=dom.byId("search-btn"); //搜索按钮

	var service = new google.maps.places.AutocompleteService(); //模糊查询对象（“自动完成功能”）
	var geocoder = new google.maps.Geocoder(); //精确查询对象

	search_btn.addEventListener("click",function(){
		var search_text=str.trim(search_text_input.value);
		if(search_text===""){ //输入为空不执行查询
			return;
		}
  		executeSearch(search_text);
	});

	// 执行地理编码查询及附加操作
	function executeSearch(search_text){
		auto_complete.innerHTML=""; //收起智能提示

		dom.byId("side-bar-content").innerHTML=""; //清空侧边栏原有地址列表
		//显示侧边栏
		side_bar.className="side-bar-show";
		side_bar_toggle_btn.className="side-bar-toggle-btn-show";

		location_graphics_layer.graphics.removeAll(); //清除原有标注
		
		service.getQueryPredictions({ input: search_text }, function(prediction_results, prediction_status){ //prediction_results：预测对象的数组 ，prediction_status：相应的状态码
  			
  			//若查询不到结果时给予提示
  			if(prediction_status===google.maps.places.PlacesServiceStatus.ZERO_RESULTS){
  				var adress_not_found_hint=domConstruct.create("div",{
  					id:"adress-not-found-hint"
  				},dom.byId("side-bar-content"),"last");

  				domConstruct.create("span",{
  					id:"adress-not-found-hint-txt",
  					innerHTML:"未找到您查找的内容"
  				},adress_not_found_hint,"last");

  				domConstruct.create("img",{
  					src:"image/address-not-found.png"
  				},adress_not_found_hint,"last");

  				return;
  			}

  			if(prediction_status==="OK"){
  				var address_graphics=[]; //所有地址的Graphic数组
  				var address_items=[]; //侧边栏中所有地址列表项的数组
  				prediction_results.forEach(function(addressObj){
  					var promise=new Promise(function(resolve,reject){ 
  						var place_id=addressObj["place_id"]; //google map中地点唯一的标识
	  					var main_text=addressObj["structured_formatting"]["main_text"]; //地点的缩略名称
	  					var description=addressObj["description"]; //地点的详细名称
	  					var lon=null;
	  					var lat=null;
	  					//将模糊查询service.getQueryPredictions得到的结果通过placeId进行精确查询，得到经纬度坐标
	  					geocoder.geocode({"placeId": place_id},function(exact_results, exact_status){ //因为这里是按placeId查，而不是按address查，所以exact_results数组中只会有一个结果
	  						//
	  						//因为谷歌对地理编码的查询有时间间隔的限制（上面的模糊查询没有时间间隔的限制），
	  						//所以如果快速连续点击查询按钮进行查询可能只能查到模糊查询中的一部分结果，
	  						//快速连续进行地理编码查询状态码可能为 OVER_QUERY_LIMIT
	  						//
	  						if(exact_status==="OK"){
	  							lon=exact_results[0]["geometry"]["location"].lng();
	  							lat=exact_results[0]["geometry"]["location"].lat();
	  						
		  						resolve({
			  						place_id:place_id,
			  						main_text:main_text,
			  						description:description,
			  						lon:lon,
			  						lat:lat
			  					});
			  				}
	  					});
  					});
  					
  					promise.then(function(obj){
  						var address_graphic=new Graphic({
							attributes:{
								place_id:obj.place_id,
								main_text:obj.main_text,
								description:obj.description,
								selected: false
							},
							geometry:{
								type:"point",
								longitude:obj.lon,
								latitude:obj.lat,
								spatialReference:view.spatialReference
							},
							symbol:{
								type: "picture-marker",
								width: "23px",
								height: "34px",
								url: "image/blue-location.png" //相对于根目录而言的路径
							}
						});
						
						address_graphics.push(address_graphic); //将地址要素添加到数组中保存

						//地址栏目
						var address_item=domConstruct.create("div",{
							class:"address-item"
						},dom.byId("side-bar-content"),"last");

						//名称
						domConstruct.create("span",{
							class: "address-item-title",
							innerHTML: address_graphic.attributes.main_text,
							title: address_graphic.attributes.main_text
						},address_item,"last");

						//地址
						domConstruct.create("span",{
							class: "address-item-address",
							innerHTML: address_graphic.attributes.description,
							title: address_graphic.attributes.description
						},address_item,"last");

						address_items.push(address_item);

						//address_graphics和address_items下标对应

						//得到完整的地址Graphic数组和侧边栏列表项DOM数组后
						if(address_graphics.length==prediction_results.length){
							location_graphics_layer.graphics.addMany(address_graphics);
							view.goTo(location_graphics_layer.graphics);
							
							address_items.forEach(function(address_item,index){

								//鼠标在地址栏目上移动时标注高亮
								address_item.addEventListener("mouseenter",function(){ 
									address_graphics[index].symbol.url="image/red-location.png";
									//更改后不刷新，要移动地图才会刷新，移动到原来的位置
									view.goTo(view.center,{
										animate: false //不以动画的形式移动，否则图标的改变会有延时
									});
								});

								address_item.addEventListener("mouseleave",function(){ 
									if(!address_graphics[index]["attributes"]["selected"]){
										address_graphics[index].symbol.url="image/blue-location.png";
										view.goTo(view.center,{
											animate: false
										});
									}
								});

								//点击地址栏目时缩放到标注位置
								address_item.addEventListener("click",function(){ 
									address_graphics.forEach(function(tmp_address_graphic,i){
										if(tmp_address_graphic["attributes"]["selected"]){
											address_items[i].style.backgroundColor="#fff";
											tmp_address_graphic.symbol.url="image/blue-location.png";
											tmp_address_graphic["attributes"]["selected"]=false;
										}
									});
									this.style.backgroundColor="#E2E2E2";
									address_graphics[index].symbol.url="image/red-location.png";
									address_graphics[index]["attributes"]["selected"]=true;
									view.goTo({
										target: address_graphics[index].geometry,
										zoom: 15
									});
								});
							});	
						}
  					});
  				});			
  			}
  		});
	}
	
	//清空输入框
	var search_input_clear_btn=dom.byId("search-input-clear");
	search_input_clear_btn.addEventListener("click",function(){
		//收起侧边栏
		side_bar.className="";
		side_bar_toggle_btn.className="";

		location_graphics_layer.graphics.removeAll(); //清除原有标注

		search_text_input.value="";
		search_input_clear_btn.style.visibility="hidden"; //input事件不响应脚本带来的改变

		auto_complete.innerHTML="";
	});

	//搜索内容智能提示
	var auto_complete=dom.byId("auto-complete");
	search_text_input.addEventListener("input",function(evt){

		auto_complete.innerHTML=""; //输入内容发生变化实时刷新地址提示
		var rt_search_content=str.trim(this.value); //实时输入内容

		if(rt_search_content!=""){
			search_input_clear_btn.style.visibility="visible"; //显示清除输入按钮

			var checked_is_empty_promise=new Promise(function(resolve,reject){
				//根据输入执行模糊查询
				service.getPlacePredictions({ input: rt_search_content },function(rt_results,rt_status){
					if(rt_status===google.maps.places.PlacesServiceStatus.OK){

						rt_results.forEach(function(rt_address_obj){
							var rt_address_name=rt_address_obj["structured_formatting"]["main_text"];
							
							//创建智能提示项插入DOM树中
							var rt_address_auto_complete_item=domConstruct.create("div",{
								class: "auto-complete-item",
								innerHTML: rt_address_name
							},auto_complete,"last");

							//点击智能提示地址项后立即执行查询
							rt_address_auto_complete_item.addEventListener("click",function(){
								search_text_input.value=this.innerHTML;
								auto_complete.innerHTML="";
								executeSearch(search_text_input.value); //耗时操作放在最后执行
							});
						});
					}
					resolve();
				});
			});

			//解决由于回调函数延时执行造成的手动删除完输入框内容之后智能提示不消失的问题
			checked_is_empty_promise.then(function(){
				var tmp_rt_search_content=str.trim(search_text_input.value);
				if(tmp_rt_search_content===""){
					auto_complete.innerHTML="";
				}
			});
		}else{
			search_input_clear_btn.style.visibility="hidden"; //隐藏清除输入按钮
			//收起侧边栏
			side_bar.className="";
			side_bar_toggle_btn.className="";

			location_graphics_layer.graphics.removeAll(); //移除已有地址标注

			auto_complete.innerHTML=""; //收起智能提示
		}
	});

	//点击map-content（id）或其子元素都会让地址提示消失
	dom.byId("map-content").addEventListener("click",function(){
		auto_complete.innerHTML="";
	});

	//反向地理编码查询
	dom.byId("search-address-by-location").addEventListener("click",function(){
		tool_select_tag.checked=false; //收起工具条
		dom.byId("view-div").style.cursor="help"; //改变光标样式，提示用户进行图查属性

		on.once(view,"click",function(evt){ //只绑定事件一次
			geocoder.geocode({
				location: {
					lat: evt.mapPoint.latitude,
					lng: evt.mapPoint.longitude
				}
			},function(reverse_results,reverse_status){
				if(reverse_status==="OK"){
					var reverse_graphics=[];
					reverse_results.forEach(function(reverse_result){

						var reverse_address_name=reverse_result["formatted_address"];
						//出现了例如：Unnamed Road, XX县XX市XX省中国的情况，将"Unnamed Road"替换为"未知道路"
						if(reverse_address_name.indexOf("Unnamed Road")!=-1){
							reverse_address_name=reverse_address_name.replace("Unnamed Road","未知道路");
						}
						var reverse_address_lon=reverse_result["geometry"]["location"].lng();
						var reverse_address_lat=reverse_result["geometry"]["location"].lat();

						//由于会返回很多结果，有的结果没有什么意义，这里选择名称大于11个字符较详细的地址展示
						if(reverse_address_name.length>11){
							var reverse_graphic=new Graphic({
								attributes: {
									reverse_address_name: reverse_address_name,
									reverse_address_lon: reverse_address_lon.toFixed(4),
									reverse_address_lat: reverse_address_lat.toFixed(4)
								},
								geometry: new Point({
									longitude: reverse_address_lon,
									latitude: reverse_address_lat
								}),
								popupTemplate: {
									title: "{reverse_address_name}",
									content: "当前坐标：[{reverse_address_lon},{reverse_address_lat}]"
								}
							});
							reverse_graphics.push(reverse_graphic);
						}
					});
					view.popup.open({ //打开弹出框
						features : reverse_graphics,
						location : evt.mapPoint,
						dockOptions: {
							position: "bottom-center"
						}
					});
				}
			});
			dom.byId("view-div").style.cursor="default";
		});
	});
});


