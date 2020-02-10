/* 2017-11-30 16:56:24 | 修改 木遥（QQ：346819890） */
//模块：
mars3d.widget.bindClass(mars3d.widget.BaseWidget.extend({
    options: {
        //弹窗
        view: {
            type: "window",
            url: "view.html",
            windowOptions: {
                width: 320,
                height: 400
            }
        },
    },
    //初始化[仅执行1次]
    create: function () {


    },
    viewWindow: null,
    //每个窗口创建完成后调用
    winCreateOK: function (opt, result) {
        this.viewWindow = result;
    },
    //激活插件
    activate: function () {

    },
    //释放插件
    disable: function () {
        this.viewWindow = null;
        this.destroyAll();
    },
    openTerrainDepthTest: function () {
        this._last_depthTestAgainstTerrain = this.viewer.scene.globe.depthTestAgainstTerrain;
        this.viewer.scene.globe.depthTestAgainstTerrain = true;
    },
    resetTerrainDepthTest: function () {
        if (Cesium.defined(this._last_depthTestAgainstTerrain)) {
            this.viewer.scene.globe.depthTestAgainstTerrain = this._last_depthTestAgainstTerrain;
            delete this._last_depthTestAgainstTerrain
        }
    },

    destroyAll: function () {
        this.destroyRZFX()//日照分析
        this.destroyTSFX()//通视分析
        this.destroyKSY()//可视域分析

        this.destroyFLFX()//方量分析
        this.destroyDXKW() //地形开挖 
        this.destroyDBTM()//地表透明

        this.destroyMXPQ()//模型剖切
        this.destroyMXYP()//模型压平
        this.destroyMXCJ()//模型裁剪 
    },



    //=========日照分析========
    createRZFX: function () {
        this.viewer.clock.onTick.addEventListener(this.showNowTimeRZFX, this);
    },
    destroyRZFX: function () {
        this.viewer.clock.clockRange = Cesium.ClockRange.UNBOUNDED;
        this.viewer.clock.multiplier = 1;

        this.viewer.clock.onTick.removeEventListener(this.showNowTimeRZFX, this);
        this.viewer.shadows = false;
    },
    showNowTimeRZFX: function () {
        if (!this.viewWindow || !this.viewer.clock.shouldAnimate) return;

        var currentTime = this.viewer.clock.currentTime;
        var date = Cesium.JulianDate.toDate(currentTime);
        this.viewWindow.setRZFXNowTime(date);
    },
    clearRZFX: function () {//停止 
        this.viewer.shadows = false;
        this.viewer.clock.shouldAnimate = false;
    },
    startPlayRZFX: function (startDate, endDate) {
        if (this.stopTime) {
            this.viewer.clock.currentTime = this.stopTime;
        }

        this.viewer.clock.startTime = Cesium.JulianDate.fromDate(startDate);
        this.viewer.clock.currentTime = Cesium.JulianDate.fromDate(startDate);
        this.viewer.clock.stopTime = Cesium.JulianDate.fromDate(endDate);

        this.viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP;
        this.viewer.clock.multiplier = 1600;
        this.viewer.clock.shouldAnimate = true;

        this.viewer.shadows = true;
    },
    pauseRZFX: function () {
        if (this.viewer.clock.shouldAnimate) {
            this.stopTime = this.viewer.clock.currentTime;
            this.viewer.clock.shouldAnimate = false;
        } else {
            this.viewer.clock.currentTime = this.stopTime || this.viewer.clock.currentTime;
            this.viewer.clock.shouldAnimate = true;
        }
        return this.viewer.clock.shouldAnimate
    },

    //=========通视分析========
    createTSFX: function () {
        if (this.sightline) return;
        this.openTerrainDepthTest();

        this.sightline = new mars3d.analysi.Sightline(this.viewer);
    },
    destroyTSFX: function () {
        if (!this.sightline) return;
        this.resetTerrainDepthTest();

        this.clearTSFX();
        this.sightline.destroy();
        delete this.sightline;
    },
    clearTSFX: function () {
        if (!this.sightline) return;

        this.viewer.mars.draw.deleteAll();
        this.sightline.clear();

        for (var i = 0, len = this.arrTsfxPoint.length; i < len; i++) {
            this.viewer.entities.remove(this.arrTsfxPoint[i]);
        }
        this.arrTsfxPoint = [];
    },
    drawTSFXLine: function () {
        var that = this;
        this.viewer.mars.draw.deleteAll();
        this.viewer.mars.draw.startDraw({
            type: "polyline",
            config: {
                maxPointNum: 2
            },
            style: {
                color: "#55ff33",
                width: 3,
            },
            success: function (entity) { //绘制成功后回调  
                var positions = entity.polyline.positions.getValue();
                that.sightline.add(positions[0], positions[1]);

                that.createTsfxPoint(positions[0], true);
                that.createTsfxPoint(positions[1], false);
                that.viewer.mars.draw.deleteAll();
            }
        });
    },
    arrTsfxPoint: [],
    createTsfxPoint: function (position, isFirst) {
        var point = this.viewer.entities.add({
            position: position,
            point: {
                color: new Cesium.Color.fromCssColorString("#3388ff"),
                pixelSize: 6,
                outlineColor: new Cesium.Color.fromCssColorString("#ffffff"),
                outlineWidth: 2,
                scaleByDistance: new Cesium.NearFarScalar(1.5e2, 1.0, 8.0e6, 0.2),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
                text: isFirst ? "观察位置" : "目标点",
                font: 'normal small-caps normal 17px 楷体',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                fillColor: Cesium.Color.AZURE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -20),   //偏移量   
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0.0, 2000000),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
        });
        this.arrTsfxPoint.push(point);
        return point;
    },

    //=========可视域分析========
    createKSY: function () {
        //不开启抗锯齿，可视域会闪烁
        this.viewer.scene.postProcessStages.fxaa.enabled = true;

        //不加无法投射到地形上
        this.openTerrainDepthTest();
    },
    destroyKSY: function () {
        this.clearKSY();
        this.resetTerrainDepthTest();
    },
    clearKSY: function () {
        for (var i = 0, len = this.arrKsyList.length; i < len; i++) {
            this.arrKsyList[i].destroy();
        }
        this.arrKsyList = [];
        delete this.lastViewField;
    },
    arrKsyList: [],
    getLastKSY: function () {
        return this.lastViewField || {};
    },
    addKSY: function (options) {
        var that = this;

        var thisViewField = new mars3d.analysi.ViewShed3D(this.viewer, {
            horizontalAngle: options.horizontalAngle,
            verticalAngle: options.verticalAngle,
            distance: options.distance,
            calback: function (distance) {
                if (that.viewWindow)
                    that.viewWindow.updateKsyDistance(distance);
            }
        });
        this.lastViewField = thisViewField;
        this.arrKsyList.push(thisViewField);
    },

    //=========方量分析========
    createFLFX: function () {
        if (this.measureObj) return;

        var that = this;
        this.measureObj = new mars3d.analysi.MeasureVolume(viewer, {
            heightLabel: true,
            offsetLabel: false,
            onStart: function () {
                haoutil.loading.show({ type: "loader-bar" });
            },
            onStop: function () {
                haoutil.loading.hide();
                that.viewWindow.showFLFXHeightRg(that.measureObj);
            }
        });
    },
    destroyFLFX: function () {
        if (!this.measureObj) return;

        this.measureObj.destroy();
        delete this.measureObj;
    },
    clearFLFX: function () {
        if (!this.measureObj) return;

        this.measureObj.clear();
    },

    //=========地形开挖========
    createDXKW: function () {
        this.openTerrainDepthTest();
    },
    startDrawDXKW: function () {
        var that = this;

        viewer.mars.popup.enable = false;
        viewer.mars.tooltip.enable = false;

        viewer.mars.draw.startDraw({
            type: "polygon",
            style: {
                color: "#29cf34",
                opacity: 0.5,
                clampToGround: true
            },
            success: function (entity) { //绘制成功后回调

                viewer.mars.popup.enable = true;
                viewer.mars.tooltip.enable = true;

                var positions = viewer.mars.draw.getPositions(entity);
                viewer.mars.draw.deleteAll();
                that.showDXKWClippingPlanes(positions);
            }
        });
    },
    destroyDXKW: function () {
        this.clearDXKW();
        this.resetTerrainDepthTest();
    },
    clearDXKW: function () {
        if (this.TerrainClip) {
            this.TerrainClip.destroy();
            delete this.TerrainClip;
        }
        if (this.TerrainClip2) {
            this.TerrainClip2.destroy();
            delete this.TerrainClip2;
        }

        // //同时有模型时，清除模型裁剪
        // this.clearMXCJ();
    },
    showDXKWClippingPlanes: function (positions) {
        this.clearDXKW();

        // //同时有模型时，进行模型裁剪
        // this.addMxcjPoly(positions)   


        var height = this.viewWindow.getDXKWNowHeight();

        // marsgis扩展的地形开挖【存在问题：鼠标无法穿透地表，地下管网的popup无法展示】
        this.TerrainClip = new mars3d.analysi.TerrainClip(viewer, {
            positions: positions,
            height: height,
            wall: true,
            splitNum: 50, //wall边界插值数
            wallImg: this.path + 'img/textures/excavationregion_top.jpg',
            bottomImg: this.path + 'img/textures/excavationregion_side.jpg'
        });


        //cesium原生的clip组成的【存在问题：不稳定，时而不生效，转cesium原生接口的plan组成】
        this.TerrainClip2 = new mars3d.analysi.TerrainClipPlan(viewer, {
            positions: positions,
            height: height,
            wall: false, 
        });


    },
    updateDXKWHeight: function (nowValue) {
        if (this.TerrainClip)
            this.TerrainClip.height = nowValue;
    },

    //=========地表透明========
    createDBTM: function () {
        this.openTerrainDepthTest();
        this.viewer.scene.globe.baseColor = new Cesium.Color.fromCssColorString("rgba(0,0,0.0,0.5,1.0)"); //地表背景色

        this.underObj = new mars3d.analysi.Underground(viewer, {
            depth: 500, //允许相机地下深度(相对于地表海拔)
            alpha: 0.5,
            enable: false,
        });

        //加控制，只在相机高度低于10000时才开启地表透明 
        viewer.scene.camera.changed.addEventListener(this.cameraChangeHandler, this);

    },
    destroyDBTM: function () {
        if (!this.underObj) return;

        this.resetTerrainDepthTest();

        this.underObj.destroy();
        delete this.underObj;
        viewer.scene.camera.changed.removeEventListener(this.cameraChangeHandler, this);
    },
    clearDBTM: function () {


    },
    cameraChangeHandler: function () {
        if (!this.viewWindow) return;
        if (viewer.camera.positionCartographic.height < 10000) {
            var val = this.viewWindow.getDbtmEnable();
            if (val != this.underObj.enable)
                this.underObj.enable = val;
            this.viewWindow.updateDbtmVisible(true);
        } else {
            this.underObj.enable = false;
            this.viewWindow.updateDbtmVisible(false);
        }
    },

    //=========模型剖切======== 
    selectedPQMX: function () {
        var that = this;

        viewer.mars.popup.enable = false;
        viewer.mars.tooltip.enable = false;

        viewer.mars.draw.startDraw({
            type: "point",
            style: {
                color: "#007be6",
            },
            success: function (entity) { //绘制成功后回调
                var positions = viewer.mars.draw.getPositions(entity);

                viewer.mars.draw.deleteAll();

                viewer.mars.popup.enable = true;
                viewer.mars.tooltip.enable = true;

                var tileset = mars3d.tileset.pick3DTileset(viewer, positions);//拾取绘制返回的模型
                if (!tileset) {
                    haoutil.msg("请单击选择模型");
                    return;
                }
                that.clipTileset = new mars3d.tiles.TilesClipPlan(tileset);

                var radius = tileset.boundingSphere.radius / 2;
                that.viewWindow.setClipDistanceRange(radius, tileset.name);
            }
        });
    },
    destroyMXPQ: function () {
        if (!this.clipTileset) return;

        this.clipTileset.destroy();
        delete this.clipTileset;
    },
    clearMXPQ: function () {
        if (!this.clipTileset) return;

        this.clipTileset.clear();
    },

    //=========模型压平========
    createMXYP: function () {

    },
    destroyMXYP: function () {
        this.clearMXYP();

    },
    clearMXYP: function () {
        if (!this.flatObj) return;

        this.flatObj.destroy();
        delete this.flatObj;
    },
    drawMxypPoly: function (flatHeight) {
        this.clearMXYP();

        var that = this;
        viewer.mars.draw.startDraw({
            type: "polygon",
            style: {
                color: "#007be6",
                opacity: 0.5,
            },
            success: function (entity) { //绘制成功后回调
                var positions = viewer.mars.draw.getPositions(entity);

                viewer.mars.draw.deleteAll();
                var tileset = mars3d.tileset.pick3DTileset(viewer, positions);//拾取绘制返回的模型
                if (!tileset) {
                    haoutil.msg("请单击选择模型");
                    return;
                }
                that.flatObj = new mars3d.tiles.TilesFlat({
                    viewer: that.viewer,
                    tileset: tileset,
                    positions: positions,
                    flatHeight: flatHeight
                });

            }
        });
    },
    //=========模型裁剪========
    createMXCJ: function () {

    },
    destroyMXCJ: function () {
        this.clearMXCJ();
    },
    clearMXCJ: function () {
        if (!this.tilesetClip) return;

        this.tilesetClip.destroy();
        delete this.tilesetClip;
    },
    drawMxcjPoly: function (clipOutSide) {
        this.clearMXCJ();

        var that = this;
        viewer.mars.draw.startDraw({
            type: "polygon",
            style: {
                color: "#007be6",
                opacity: 0.5,
            },
            success: function (entity) { //绘制成功后回调
                var positions = viewer.mars.draw.getPositions(entity);

                viewer.mars.draw.deleteAll();
                var isAdd = that.addMxcjPoly(positions, clipOutSide)
                if (!isAdd) {
                    haoutil.msg("请单击选择模型");
                }
            }
        });
    },
    addMxcjPoly: function (positions, clipOutSide) {
        this.clearMXCJ();

        var tileset = mars3d.tileset.pick3DTileset(this.viewer, positions);//拾取绘制返回的模型
        if (!tileset) {
            return false;
        }

        this.tilesetClip = new mars3d.tiles.TilesClip({
            viewer: this.viewer,
            tileset: tileset,
            positions: positions,
            clipOutSide: clipOutSide
        });

        return true;
    },





}));